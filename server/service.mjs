// PassBCH.cash game service: every money move happens in one SQL transaction with row locks.
import { randomBytes } from 'node:crypto';
import * as E from './engine.mjs';
import { tx, db } from './db.mjs';
import { getCandle, priceAt } from './price.mjs';
import { PF, cleanPrompt, playMatch, groqAsk, firstCommit } from './promptfight.mjs';

export class UserError extends Error { constructor(m, status = 400) { super(m); this.status = status; } }
const nowS = () => Math.floor(Date.now() / 1000);
const HOUSE_SECRET = () => process.env.HOUSE_SECRET || 'dev-house-secret';

async function playerByToken(c, token, lock = false) {
  if (!token) throw new UserError('not signed in', 401);
  const { rows } = await c.query(`select * from players where token_hash = $1${lock ? ' for update' : ''}`, [E.tokenHash(token)]);
  if (!rows[0]) throw new UserError('unknown player', 401);
  return rows[0];
}
const pub = (p) => ({ id: p.id, name: p.name, refCode: p.ref_code, bonus: Number(p.bonus), cash: Number(p.cash),
  wins: p.wins, losses: p.losses, draws: p.draws, wonSats: Number(p.won_sats), wagered: Number(p.wagered ?? 0) });

export async function createPlayer({ name, ref, ipHash }) {
  const clean = E.cleanName(name);
  if (!clean) throw new UserError('pick a name of 2–20 letters');
  const token = E.newToken();
  return tx(async (c) => {
    await c.query('lock table bonus_grants in exclusive mode'); // keeps the global bonus cap exact
    const referrer = ref ? (await c.query('select * from players where ref_code = $1 and not is_house', [String(ref).toUpperCase()])).rows[0] : null;
    // At most 3 bonus signups per network address (friends on one Wi-Fi are fine; tab farming is not).
    const ipUsed = ipHash ? (await c.query('select count(*)::int n from players where ip_hash = $1', [ipHash])).rows[0].n >= 3 : false;
    const { rows: [{ n }] } = await c.query('select count(*)::int n from bonus_grants');
    const grants = ipUsed ? [] : E.signupGrants({ hasReferrer: !!referrer, grantsSoFar: n });
    let code; do { code = randomBytes(4).toString('hex').toUpperCase().slice(0, 6); } while ((await c.query('select 1 from players where ref_code=$1', [code])).rowCount);
    const { rows: [p] } = await c.query('insert into players (token_hash, name, ref_code, referred_by, ip_hash) values ($1,$2,$3,$4,$5) returning *',
      [E.tokenHash(token), clean, code, referrer?.id ?? null, ipHash ?? null]);
    for (const g of grants) {
      const who = g.to === 'self' ? p.id : referrer.id;
      await c.query('update players set bonus = bonus + $1 where id = $2', [g.sats, who]);
      await c.query('insert into bonus_grants (player_id, sats, reason) values ($1,$2,$3)', [who, g.sats, g.to === 'self' ? (referrer ? 'signup+referral' : 'signup') : `referred ${p.id}`]);
    }
    const me = (await c.query('select * from players where id=$1', [p.id])).rows[0];
    return { token, player: pub(me), bonusGiven: grants.find((g) => g.to === 'self')?.sats ?? 0, referrer: referrer?.name ?? null };
  });
}

export async function me(token) {
  const c = await db();
  const p = await playerByToken(c, token);
  const { rows } = await c.query(`select id, stake, created_s, joined_s, result, winner, a_player, b_player, vs_bot, settled_at from duels
    where (a_player=$1 or b_player=$1) and settled_at is null order by created_s desc limit 10`, [p.id]);
  const { rows: [{ got }] } = await c.query('select coalesce(sum(sats),0)::bigint got from bonus_grants where player_id=$1', [p.id]);
  return { player: pub(p), openDuels: rows, withdraw: E.withdrawAllowed({ wagered: Number(p.wagered), bonusReceived: Number(got) }) };
}

/** Create a duel: the move is sent only as a commitment; the salt stays on the player's device. */
export async function createDuel(token, { stake, commit, vsBot }) {
  stake = Number(stake);
  if (!/^[0-9a-f]{64}$/.test(commit ?? '')) throw new UserError('bad commitment');
  return tx(async (c) => {
    const p = await playerByToken(c, token, true);
    let split; try { split = E.takeStake({ bonus: Number(p.bonus), cash: Number(p.cash) }, stake); } catch (e) { throw new UserError(e.message); }
    const id = randomBytes(16).toString('hex');
    await c.query('update players set bonus = bonus - $1, cash = cash - $2, wagered = wagered + $1 + $2 where id = $3', [split.fromBonus, split.fromCash, p.id]);
    await c.query(`insert into duels (id, stake, a_player, a_commit, a_from_bonus, a_from_cash, vs_bot, created_s) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, stake, p.id, commit, split.fromBonus, split.fromCash, !!vsBot, nowS()]);
    if (vsBot) await joinAs(c, id, 'house');
    return { id };
  });
}

async function joinAs(c, id, who, move) {
  const { rows: [d] } = await c.query('select * from duels where id=$1 for update', [id]);
  if (!d) throw new UserError('no such duel', 404);
  if (E.duelStatus(d, nowS()) !== 'open') throw new UserError('this duel is no longer open');
  let b;
  if (who === 'house') {
    b = (await c.query('select * from players where is_house for update')).rows[0];
    move = E.botMove(HOUSE_SECRET(), id);
  } else {
    b = who;
    if (b.id === d.a_player) throw new UserError("you can't join your own duel — send the link to a friend");
    if (!E.isMove(move)) throw new UserError('pick rock, paper or scissors');
  }
  let split; try { split = E.takeStake({ bonus: Number(b.bonus), cash: Number(b.cash) }, d.stake); } catch (e) { throw new UserError(e.message); }
  await c.query('update players set bonus = bonus - $1, cash = cash - $2, wagered = wagered + $1 + $2 where id = $3', [split.fromBonus, split.fromCash, b.id]);
  await c.query(`update duels set b_player=$1, b_move=$2, b_from_bonus=$3, b_from_cash=$4, joined_s=$5, bot_commit=$6 where id=$7`,
    [b.id, move, split.fromBonus, split.fromCash, nowS(), who === 'house' ? E.botSeedCommit(HOUSE_SECRET(), id) : null, id]);
}

export async function joinDuel(token, { id, move }) {
  return tx(async (c) => { const p = await playerByToken(c, token, true); await joinAs(c, id, p, move); return { id }; });
}

async function finish(c, d, { result, aMove, reason }) {
  const a = { fromBonus: d.a_from_bonus, fromCash: d.a_from_cash }, b = { fromBonus: d.b_from_bonus, fromCash: d.b_from_cash };
  for (const cr of E.settle(result, d.stake, a, b)) {
    const pid = cr.side === 'a' ? d.a_player : d.b_player;
    await c.query('update players set bonus = bonus + $1, cash = cash + $2 where id = $3', [cr.bonus, cr.cash, pid]);
  }
  const winner = result === 1 ? d.a_player : result === 2 ? d.b_player : null;
  const loser = result === 1 ? d.b_player : result === 2 ? d.a_player : null;
  if (winner) {
    await c.query('update players set wins = wins + 1, won_sats = won_sats + $1 where id = $2', [d.stake, winner]);
    await c.query('update players set losses = losses + 1 where id = $1', [loser]);
  } else await c.query('update players set draws = draws + 1 where id = any($1)', [[d.a_player, d.b_player]]);
  await c.query('update duels set a_move=$1, result=$2, winner=$3, settled_at=now(), settle_reason=$4 where id=$5', [aMove ?? null, result, winner, reason, d.id]);
  return { result, winner };
}

/** Creator opens the commitment. Wrong move/salt is rejected, not counted. */
export async function reveal(token, { id, move, salt }) {
  return tx(async (c) => {
    const p = await playerByToken(c, token);
    const { rows: [d] } = await c.query('select * from duels where id=$1 for update', [id]);
    if (!d || d.a_player !== p.id) throw new UserError('not your duel', 404);
    if (d.settled_at) return { already: true, result: d.result };
    if (!d.b_player) throw new UserError('nobody has joined yet');
    if (!E.checkReveal(d.a_commit, move, salt)) throw new UserError('that move does not match your commitment');
    if (E.duelStatus(d, nowS()) === 'reveal_timeout') return finish(c, d, { result: 2, reason: 'reveal timeout' });
    await c.query('update duels set a_salt=$1 where id=$2', [salt, d.id]);
    return finish(c, d, { result: E.outcome(move, d.b_move), aMove: move, reason: 'revealed' });
  });
}

/** Lazy housekeeping on every read: refund expired duels, award reveal timeouts to the joiner. */
export async function sweep() {
  const c = await db();
  const t = nowS();
  const { rows } = await c.query(`select id from duels where settled_at is null and ((b_player is null and created_s < $1) or (b_player is not null and joined_s < $2)) limit 20`,
    [t - E.RULES.openTimeoutS, t - E.RULES.revealTimeoutS]);
  for (const { id } of rows) {
    await tx(async (k) => {
      const { rows: [d] } = await k.query('select * from duels where id=$1 for update', [id]);
      if (!d || d.settled_at) return;
      if (!d.b_player) {
        await k.query('update players set bonus = bonus + $1, cash = cash + $2 where id = $3', [d.a_from_bonus, d.a_from_cash, d.a_player]);
        await k.query("update duels set settled_at=now(), settle_reason='expired, refunded' where id=$1", [id]);
      } else await finish(k, d, { result: 2, reason: 'reveal timeout' });
    });
  }
  return rows.length;
}

/** The creator cancels their own unjoined duel: the stake goes straight back. */
export async function cancelDuel(token, id) {
  return tx(async (k) => {
    const p = await playerByToken(k, token);
    const { rows: [d] } = await k.query('select * from duels where id=$1 for update', [id]);
    if (!d) throw new UserError('no such duel', 404);
    if (d.a_player !== p.id) throw new UserError('only the creator can cancel');
    if (d.b_player || d.settled_at) throw new UserError('this duel already started or ended');
    await k.query('update players set bonus = bonus + $1, cash = cash + $2 where id = $3', [d.a_from_bonus, d.a_from_cash, d.a_player]);
    await k.query("update duels set settled_at=now(), settle_reason='cancelled, refunded' where id=$1", [id]);
    return { ok: true, refunded: Number(d.a_from_bonus) + Number(d.a_from_cash) };
  });
}

export async function getDuel(id) {
  const c = await db();
  const { rows: [d] } = await c.query(`select d.*, pa.name a_name, pb.name b_name from duels d join players pa on pa.id=d.a_player left join players pb on pb.id=d.b_player where d.id=$1`, [id]);
  if (!d) throw new UserError('no such duel', 404);
  const status = E.duelStatus(d, nowS());
  return { id: d.id, stake: d.stake, status, vsBot: d.vs_bot, aName: d.a_name, bName: d.b_name, aCommit: d.a_commit,
    aMove: d.a_move, bMove: d.settled_at || d.b_player ? d.b_move : null, result: d.result, winner: d.winner, aPlayer: d.a_player, bPlayer: d.b_player,
    revealDeadline: d.joined_s ? Number(d.joined_s) + E.RULES.revealTimeoutS : null, settleReason: d.settle_reason, recordTxid: d.record_txid,
    botProof: d.vs_bot && d.settled_at ? { seedCommit: d.bot_commit } : null };
}

export async function openDuels() {
  const c = await db();
  const { rows } = await c.query(`select d.id, d.stake, d.created_s, p.name from duels d join players p on p.id=d.a_player where d.b_player is null and d.settled_at is null order by d.created_s desc limit 20`);
  return rows;
}

export async function leaderboard() {
  const c = await db();
  // Everything below is derived from settled duels only, so the header, W-L-D and the list always agree.
  const top = (await c.query(`with s as (select * from duels where settled_at is not null and b_player is not null),
      side as (select a_player pid, case when result = 1 then 'w' when result = 0 then 'd' else 'l' end r, case when result = 1 then stake else 0 end won from s
               union all select b_player, case when result = 2 then 'w' when result = 0 then 'd' else 'l' end, case when result = 2 then stake else 0 end from s)
    select p.name, count(*) filter (where r='w')::int wins, count(*) filter (where r='l')::int losses, count(*) filter (where r='d')::int draws, sum(won)::bigint won_sats
    from side join players p on p.id = side.pid where not p.is_house group by p.name order by won_sats desc, wins desc limit 25`)).rows.map((r) => ({ ...r, won_sats: Number(r.won_sats) }));
  const feed = (await c.query(`select d.id, d.stake, d.result, d.a_move, d.b_move, d.settle_reason, d.record_txid, d.settled_at, pa.name a_name, pb.name b_name, w.name winner_name
    from duels d join players pa on pa.id=d.a_player left join players pb on pb.id=d.b_player left join players w on w.id=d.winner
    where d.settled_at is not null and d.b_player is not null order by d.settled_at desc limit 30`)).rows;
  const { rows: [s] } = await c.query(`select count(*)::int duels, coalesce(sum(stake*2),0)::bigint volume from duels where settled_at is not null and b_player is not null`);
  return { top, feed, stats: { duels: s.duels, volumeSats: Number(s.volume) } };
}

/** Reserve a withdrawal (cash only). The chain send happens after commit; status tracks it. */
export async function requestWithdrawal(token, { address, amount }) {
  if (!/^(bchtest|bitcoincash):[qp][0-9a-z]{40,}$/.test(address ?? '')) throw new UserError('enter a valid BCH address');
  return tx(async (c) => {
    const p = await playerByToken(c, token, true);
    const { rows: [{ got }] } = await c.query('select coalesce(sum(sats),0)::bigint got from bonus_grants where player_id=$1', [p.id]);
    const rule = E.withdrawAllowed({ wagered: Number(p.wagered), bonusReceived: Number(got) });
    if (!rule.ok) throw new UserError(`play ${rule.left.toLocaleString()} more sats first: free bonus must be played ${E.WAGER_MULTIPLE}x before withdrawing`);
    let q; try { q = E.withdrawQuote(Number(p.cash), Number(amount)); } catch (e) { throw new UserError(e.message); }
    await c.query('update players set cash = cash - $1 where id = $2', [q.amount, p.id]);
    const { rows: [w] } = await c.query('insert into withdrawals (player_id, address, amount, fee) values ($1,$2,$3,$4) returning id', [p.id, address, q.amount, q.fee]);
    return { ...q, withdrawalId: w.id, address };
  });
}
export async function markWithdrawal(id, { txid, status }) { await (await db()).query('update withdrawals set txid=$1, status=$2 where id=$3', [txid, status, id]); }
export async function refundWithdrawal(id) {
  return tx(async (c) => {
    const { rows: [w] } = await c.query("select * from withdrawals where id=$1 and status='pending' for update", [id]);
    if (!w) return;
    await c.query('update players set cash = cash + $1 where id=$2', [w.amount, w.player_id]);
    await c.query("update withdrawals set status='failed' where id=$1", [id]);
  });
}

/** Credit new deposit UTXOs exactly once (primary key on txid:vout). */
export async function creditDeposits(token, utxos) {
  return tx(async (c) => {
    const p = await playerByToken(c, token, true);
    let added = 0;
    for (const u of utxos) {
      const r = await c.query('insert into deposits (txid, vout, player_id, sats) values ($1,$2,$3,$4) on conflict do nothing', [u.txid, u.vout, p.id, Number(u.satoshis)]);
      if (r.rowCount) added += Number(u.satoshis);
    }
    if (added) await c.query('update players set cash = cash + $1 where id=$2', [added, p.id]);
    return { added };
  });
}
export async function playerId(token) { return (await playerByToken(await db(), token)).id; }
export async function setRecordTx(id, txid) { await (await db()).query('update duels set record_txid=$1 where id=$2', [txid, id]); }
export async function unrecorded(limit = 5) {
  return (await (await db()).query(`select id, result, stake, a_move, b_move, a_commit from duels where settled_at is not null and b_player is not null and record_txid is null
    and (record_try_at is null or record_try_at < now() - interval '30 seconds') order by settled_at limit $1`, [limit])).rows;
}
export async function markRecordTry(id) { await (await db()).query('update duels set record_try_at = now() where id=$1', [id]);
}

// ---------- Up / Down ----------
export async function placeBet(token, { side, stake }) {
  stake = Number(stake);
  if (side !== 'up' && side !== 'down') throw new UserError('pick up or down');
  const entryTs = nowS();
  const entry = await priceAt(entryTs);
  if (!entry) throw new UserError('price feed unavailable, try again in a moment');
  return tx(async (c) => {
    const p = await playerByToken(c, token, true);
    let split; try { split = E.takeStake({ bonus: Number(p.bonus), cash: Number(p.cash) }, stake); } catch (e) { throw new UserError(e.message); }
    const id = randomBytes(16).toString('hex');
    await c.query('update players set bonus = bonus - $1, cash = cash - $2, wagered = wagered + $1 + $2 where id = $3', [split.fromBonus, split.fromCash, p.id]);
    await c.query('insert into bets (id, player_id, side, stake, from_bonus, from_cash, round_start, open_price, price_source) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [id, p.id, side, stake, split.fromBonus, split.fromCash, entryTs, entry.price, entry.source]);
    return { id, roundStart: entryTs, roundEnd: E.betEnds(entryTs), entryPrice: entry.price };
  });
}

/** Settle every bet whose 60 s are up, using the public trade price at exactly entry + 60 s. */
export async function settleBets() {
  const c = await db();
  const { rows } = await c.query('select * from bets where settled_at is null and round_start <= $1 order by round_start limit 10', [nowS() - E.UPDOWN.roundS - E.UPDOWN.settleDelayS]);
  let n = 0;
  for (const b of rows) {
    const exit = await priceAt(E.betEnds(Number(b.round_start)));
    if (!exit) continue; // retry on the next read
    const open = Number(b.open_price);
    const result = E.candleResult(open, exit.price);
    await tx(async (k) => {
      const { rows: [cur] } = await k.query('select * from bets where id=$1 and settled_at is null for update', [b.id]);
      if (!cur) return;
      const s2 = E.settleBet(cur.side, result, cur.stake, { fromBonus: cur.from_bonus, fromCash: cur.from_cash });
      await k.query('update players set bonus = bonus + $1, cash = cash + $2 where id=$3', [s2.bonus, s2.cash, cur.player_id]);
      if (s2.outcome === 'win') await k.query('update players set wins = wins + 1, won_sats = won_sats + $1 where id=$2', [s2.cash - cur.stake, cur.player_id]);
      if (s2.outcome === 'lose') await k.query('update players set losses = losses + 1 where id=$1', [cur.player_id]);
      await k.query('update bets set close_price=$1, price_source=$2, result=$3, outcome=$4, payout=$5, settled_at=now() where id=$6',
        [exit.price, exit.source, result, s2.outcome, s2.bonus + s2.cash, cur.id]);
      n++;
    });
  }
  return n;
}

export async function myBets(token) {
  const c = await db();
  const p = await playerByToken(c, token);
  return (await c.query('select id, side, stake, round_start, open_price, close_price, result, outcome, payout, record_txid from bets where player_id=$1 order by created_at desc limit 8', [p.id])).rows;
}
export async function betFeed() {
  return (await (await db()).query(`select b.id, b.side, b.stake, b.round_start, b.open_price, b.close_price, b.result, b.outcome, b.payout, b.record_txid, p.name
    from bets b join players p on p.id=b.player_id order by b.created_at desc limit 20`)).rows;
}
export async function unrecordedBets(limit = 5) {
  return (await (await db()).query(`select id, side, result, stake, round_start, open_price, close_price from bets where settled_at is not null and record_txid is null
    and (record_try_at is null or record_try_at < now() - interval '30 seconds') order by settled_at limit $1`, [limit])).rows;
}
export async function setBetRecord(id, txid) { await (await db()).query('update bets set record_txid=$1 where id=$2', [txid, id]); }
export async function markBetRecordTry(id) { await (await db()).query('update bets set record_try_at=now() where id=$1', [id]); }

// ---------- AI Pass or Fail ----------
async function modelRecord(c, model) {
  const { rows: [r] } = await c.query("select count(*) filter (where pass)::int pass, count(*)::int n from ai_rounds where model=$1 and status='done'", [model]);
  return r;
}

/** Runner opens the next round; the exercise comes from the latest block hash. */
export async function aiOpenRound({ tasks, tip }) {
  return tx(async (c) => {
    await c.query('lock table ai_rounds in exclusive mode');
    const busy = (await c.query("select id from ai_rounds where status in ('open','running')")).rows[0];
    if (busy) return { busy: busy.id };
    const { rows: [{ n }] } = await c.query('select count(*)::int n from ai_rounds');
    const modelIdx = n % E.AI.models.length;
    const id = randomBytes(16).toString('hex');
    const taskIdx = E.drawTask(id, tip.hash, tasks.length);
    const t = nowS();
    await c.query('insert into ai_rounds (id, model, model_idx, task_idx, slug, block_height, block_hash, opened_s, bet_close_s) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [id, E.AI.models[modelIdx], modelIdx, taskIdx, tasks[taskIdx], tip.height, tip.hash, t, t + E.AI.betWindowS]);
    return { id, model: E.AI.models[modelIdx], slug: tasks[taskIdx], taskIdx };
  });
}

/** Runner asks for work: a round whose betting has closed becomes 'running'. */
export async function aiNextJob() {
  return tx(async (c) => {
    const { rows: [r] } = await c.query("select * from ai_rounds where status='open' and bet_close_s <= $1 for update", [nowS()]);
    if (!r) return null;
    await c.query("update ai_rounds set status='running' where id=$1", [r.id]);
    return { id: r.id, model: r.model, slug: r.slug };
  });
}

export async function aiResult({ id, pass, passed, total, durationS, transcriptHash }) {
  return tx(async (c) => {
    const { rows: [r] } = await c.query("select * from ai_rounds where id=$1 and status='running' for update", [id]);
    if (!r) throw new UserError('round not running', 409);
    const { rows: bets } = await c.query('select * from ai_bets where round_id=$1 for update', [id]);
    for (const b of bets) {
      const s = E.settleAiBet(b.side, !!pass, b.stake, b.odds_pct);
      await c.query('update players set cash = cash + $1 where id=$2', [s.cash, b.player_id]);
      if (s.outcome === 'win') await c.query('update players set wins = wins + 1, won_sats = won_sats + $1 where id=$2', [s.cash - b.stake, b.player_id]);
      else await c.query('update players set losses = losses + 1 where id=$1', [b.player_id]);
      await c.query('update ai_bets set outcome=$1, payout=$2 where id=$3', [s.outcome, s.cash, b.id]);
    }
    await c.query("update ai_rounds set status='done', pass=$1, passed=$2, total=$3, duration_s=$4, transcript_hash=$5, settled_at=now() where id=$6",
      [!!pass, passed, total, durationS, transcriptHash, id]);
    return { settled: bets.length };
  });
}

/** A round with no result after 15 min is void: every stake goes back. */
export async function aiSweep() {
  const c = await db();
  const { rows } = await c.query("select id from ai_rounds where status in ('open','running') and opened_s < $1", [nowS() - E.AI.voidAfterS]);
  for (const { id } of rows) {
    await tx(async (k) => {
      const { rows: bets } = await k.query('select * from ai_bets where round_id=$1 and outcome is null for update', [id]);
      for (const b of bets) {
        await k.query('update players set bonus = bonus + $1, cash = cash + $2 where id=$3', [b.from_bonus, b.from_cash, b.player_id]);
        await k.query("update ai_bets set outcome='refund', payout=$1 where id=$2", [b.stake, b.id]);
      }
      await k.query("update ai_rounds set status='void', settled_at=now() where id=$1", [id]);
    });
  }
}

export async function aiBet(token, { roundId, side, stake }) {
  stake = Number(stake);
  if (side !== 'pass' && side !== 'fail') throw new UserError('pick pass or fail');
  return tx(async (c) => {
    const p = await playerByToken(c, token, true);
    const { rows: [r] } = await c.query('select * from ai_rounds where id=$1 for update', [roundId]);
    if (!r || r.status !== 'open' || nowS() >= Number(r.bet_close_s)) throw new UserError('betting is closed for this round');
    let split; try { split = E.takeStake({ bonus: Number(p.bonus), cash: Number(p.cash) }, stake); } catch (e) { throw new UserError(e.message); }
    const o = E.aiOdds(await modelRecord(c, r.model));
    const odds = side === 'pass' ? o.passPct : o.failPct;
    const id = randomBytes(16).toString('hex');
    await c.query('update players set bonus = bonus - $1, cash = cash - $2, wagered = wagered + $1 + $2 where id = $3', [split.fromBonus, split.fromCash, p.id]);
    await c.query('insert into ai_bets (id, round_id, player_id, side, stake, from_bonus, from_cash, odds_pct) values ($1,$2,$3,$4,$5,$6,$7,$8)', [id, roundId, p.id, side, stake, split.fromBonus, split.fromCash, odds]);
    return { id, oddsPct: odds };
  });
}

export async function aiState(token) {
  await aiSweep();
  const c = await db();
  const { rows: rounds } = await c.query(`select r.*, (select count(*)::int from ai_bets b where b.round_id=r.id) bets, (select coalesce(sum(stake),0)::int from ai_bets b where b.round_id=r.id) pot
    from ai_rounds r order by opened_s desc limit 12`);
  const cur = rounds.find((r) => r.status === 'open' || r.status === 'running') ?? null;
  const records = {};
  for (const m of E.AI.models) { const rec = await modelRecord(c, m); records[m] = { ...rec, ...E.aiOdds(rec) }; }
  const lastSeen = (await c.query('select max(opened_s)::bigint t from ai_rounds')).rows[0].t;
  let mine = [];
  if (token) { try { const p = await playerByToken(c, token); mine = (await c.query('select b.*, r.slug, r.model, r.status, r.pass from ai_bets b join ai_rounds r on r.id=b.round_id where b.player_id=$1 order by b.created_at desc limit 8', [p.id])).rows; } catch { /* signed out */ } }
  return { now: nowS(), current: cur, recent: rounds.filter((r) => r !== cur), records, mine, runnerOnline: !!lastSeen && nowS() - Number(lastSeen) < 600 };
}
export async function unrecordedAi(limit = 3) {
  return (await (await db()).query("select * from ai_rounds where status='done' and record_txid is null and (record_try_at is null or record_try_at < now() - interval '30 seconds') order by settled_at limit $1", [limit])).rows;
}
export async function setAiRecord(id, txid) { await (await db()).query('update ai_rounds set record_txid=$1 where id=$2', [txid, id]); }
export async function markAiRecordTry(id) { await (await db()).query('update ai_rounds set record_try_at=now() where id=$1', [id]); }

/**
 * Claim up to `limit` settled rows that still need an on-chain record. The claim (record_try_at = now) is atomic,
 * so two servers never record the same row, and nothing is ever left locked if a server freezes:
 * an unrecorded claim simply becomes claimable again after 30 s.
 */
const RECORDABLE = {
  pf_matches: "status = 'done'",
  duels: "settled_at is not null and b_player is not null",
  bets: "settled_at is not null",
  ai_rounds: "status = 'done'",
};
export async function claimUnrecorded(table, limit = 3) {
  const where = RECORDABLE[table];
  if (!where) throw new Error('bad table');
  const { rows } = await (await db()).query(
    `update ${table} set record_try_at = now() where id in (
       select id from ${table} where ${where} and record_txid is null
         and (record_try_at is null or record_try_at < now() - interval '30 seconds')
       order by settled_at limit $1 for update skip locked)
     returning *`, [limit]);
  return rows;
}
/** A record whose broadcast failed must not keep a txid that never reached the chain. */
export async function clearRecordTx(table, id) {
  if (!RECORDABLE[table]) throw new Error('bad table');
  await (await db()).query(`update ${table} set record_txid = null where id = $1`, [id]);
}

/** Log in on another device or terminal with the login code (the account token). */
export async function login(code) {
  const c = await db();
  const p = await playerByToken(c, String(code ?? '').trim());
  const { rows: [{ got }] } = await c.query('select coalesce(sum(sats),0)::bigint got from bonus_grants where player_id=$1', [p.id]);
  return { player: pub(p), withdraw: E.withdrawAllowed({ wagered: Number(p.wagered), bonusReceived: Number(got) }) };
}

// ---------- Prompt Fight ----------
export async function pfCreate(token, { stake, prompt, vsBot }) {
  stake = Number(stake);
  let clean; try { clean = cleanPrompt(prompt); } catch (e) { throw new UserError(e.message); }
  const id = await tx(async (c) => {
    const p = await playerByToken(c, token, true);
    let split; try { split = E.takeStake({ bonus: Number(p.bonus), cash: Number(p.cash) }, stake); } catch (e) { throw new UserError(e.message); }
    const mid = randomBytes(16).toString('hex');
    await c.query('update players set bonus = bonus - $1, cash = cash - $2, wagered = wagered + $1 + $2 where id = $3', [split.fromBonus, split.fromCash, p.id]);
    const seed = randomBytes(16).toString('hex'); // coin flip for who moves first: committed now, revealed after the fight
    await c.query('insert into pf_matches (id, stake, vs_bot, a_player, a_prompt, a_from_bonus, a_from_cash, created_s, first_seed, first_commit) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [mid, stake, !!vsBot, p.id, clean, split.fromBonus, split.fromCash, nowS(), seed, firstCommit(seed)]);
    return mid;
  });
  if (vsBot) await pfJoinAs(id, 'house', PF.housePrompt);
  return { id };
}

/** Second player locks in a prompt; the agents play immediately; the pot is settled in one transaction. */
async function pfJoinAs(id, who, prompt) {
  const m = await tx(async (c) => {
    const { rows: [m] } = await c.query('select * from pf_matches where id=$1 for update', [id]);
    if (!m) throw new UserError('no such match', 404);
    if (m.status !== 'open') throw new UserError('this match already started');
    const b = who === 'house' ? (await c.query('select * from players where is_house for update')).rows[0] : who;
    if (b.id === m.a_player) throw new UserError("you can't fight your own agent — send the link to a friend");
    let split; try { split = E.takeStake({ bonus: Number(b.bonus), cash: Number(b.cash) }, m.stake); } catch (e) { throw new UserError(e.message); }
    await c.query('update players set bonus = bonus - $1, cash = cash - $2, wagered = wagered + $1 + $2 where id = $3', [split.fromBonus, split.fromCash, b.id]);
    await c.query("update pf_matches set b_player=$1, b_prompt=$2, b_from_bonus=$3, b_from_cash=$4, status='fighting' where id=$5", [b.id, prompt, split.fromBonus, split.fromCash, id]);
    return { ...m, b_player: b.id, b_prompt: prompt, b_from_bonus: split.fromBonus, b_from_cash: split.fromCash };
  });
  const key = process.env.GROQ_KEY;
  const ask = key ? groqAsk(key) : async () => { throw new Error('no model key'); };
  const r = await playMatch({ id, promptA: m.a_prompt, promptB: m.b_prompt, ask, seed: m.first_seed ?? undefined });
  return tx(async (c) => {
    const result = r.winner === 'a' ? 1 : 2;
    for (const cr of E.settle(result, m.stake, { fromBonus: m.a_from_bonus, fromCash: m.a_from_cash }, { fromBonus: m.b_from_bonus, fromCash: m.b_from_cash })) {
      await c.query('update players set bonus = bonus + $1, cash = cash + $2 where id = $3', [cr.bonus, cr.cash, cr.side === 'a' ? m.a_player : m.b_player]);
    }
    const win = r.winner === 'a' ? m.a_player : m.b_player, lose = r.winner === 'a' ? m.b_player : m.a_player;
    await c.query('update players set wins = wins + 1, won_sats = won_sats + $1 where id = $2', [m.stake, win]);
    await c.query('update players set losses = losses + 1 where id = $1', [lose]);
    await c.query("update pf_matches set target=$1, max_step=$2, first=$3, turns=$4, winner=$5, winner_id=$6, status='done', settled_at=now() where id=$7",
      [r.target, r.maxStep, r.first, JSON.stringify(r.turns), r.winner, win, id]);
    return { id, winner: r.winner };
  });
}
export async function pfJoin(token, { id, prompt }) {
  let clean; try { clean = cleanPrompt(prompt); } catch (e) { throw new UserError(e.message); }
  const p = await playerByToken(await db(), token);
  return pfJoinAs(id, p, clean);
}

/** Public view: prompts are revealed only after the fight (so nobody copies a strategy mid-lobby). */
export async function pfGet(id, token) {
  const c = await db();
  const { rows: [m] } = await c.query('select m.*, pa.name a_name, pb.name b_name from pf_matches m join players pa on pa.id=m.a_player left join players pb on pb.id=m.b_player where m.id=$1', [id]);
  if (!m) throw new UserError('no such match', 404);
  let meId = null; if (token) { try { meId = (await playerByToken(c, token)).id; } catch { /* anonymous */ } }
  const done = m.status === 'done';
  return { id: m.id, stake: m.stake, status: m.status, vsBot: m.vs_bot, aName: m.a_name, bName: m.b_name, aPlayer: m.a_player, bPlayer: m.b_player,
    aPrompt: done || meId === m.a_player ? m.a_prompt : null, bPrompt: done || meId === m.b_player ? m.b_prompt : null,
    target: m.target, maxStep: m.max_step, first: m.first, firstCommit: m.first_commit ?? null, firstSeed: done ? m.first_seed ?? null : null, turns: m.turns, winner: m.winner, recordTxid: m.record_txid };
}
export async function pfOpen() {
  return (await (await db()).query("select m.id, m.stake, m.created_s, p.name from pf_matches m join players p on p.id=m.a_player where m.status='open' order by m.created_s desc limit 20")).rows;
}
export async function setPfRecord(id, txid) { await (await db()).query('update pf_matches set record_txid=$1 where id=$2', [txid, id]); }

// ---------- Worldwide winners (all games) ----------
const GAME_SQL = {
  rps: `select 'rps' game, w.name, d.stake * 2 amount, d.record_txid tx, d.settled_at at from duels d join players w on w.id = d.winner where d.winner is not null and not w.is_house`,
  updown: `select 'updown' game, p.name, b.payout amount, b.record_txid tx, b.settled_at at from bets b join players p on p.id = b.player_id where b.outcome = 'win'`,
  pf: `select 'pf' game, w.name, m.stake * 2 amount, m.record_txid tx, m.settled_at at from pf_matches m join players w on w.id = m.winner_id where m.status = 'done' and not w.is_house`,
};
// Net result per player per finished game: what you won minus what you staked (ties and refunds are 0).
const NET_SQL = {
  rps: `select a_player pid, case result when 1 then stake when 2 then -stake else 0 end net, settled_at at from duels where settled_at is not null and b_player is not null
        union all select b_player, case result when 2 then stake when 1 then -stake else 0 end, settled_at from duels where settled_at is not null and b_player is not null`,
  updown: `select player_id pid, case outcome when 'win' then payout - stake when 'lose' then -stake else 0 end net, settled_at at from bets where outcome is not null`,
  pf: `select a_player pid, case winner when 'a' then stake else -stake end net, settled_at at from pf_matches where status = 'done'
        union all select b_player, case winner when 'b' then stake else -stake end, settled_at from pf_matches where status = 'done'`,
};
/** What the house owes players in withdrawable cash (bonus credit is play-only and is not a withdrawable liability). */
export async function playerCashLiability() {
  return Number((await (await db()).query('select coalesce(sum(cash),0)::bigint s from players where not is_house')).rows[0].s);
}
/** Public winners board: totals, top winners and the biggest / latest wins, by game and period. */
export async function winners({ game = 'all', period = 'all' } = {}) {
  const c = await db();
  const games = game in GAME_SQL ? [game] : Object.keys(GAME_SQL);
  const since = period === 'today' ? "now() - interval '1 day'" : period === 'week' ? "now() - interval '7 days'" : "'epoch'::timestamptz";
  const wins = `(${games.map((g) => GAME_SQL[g]).join(' union all ')}) w where w.at >= ${since}`;
  const [{ rows: top }, { rows: biggest }, { rows: latest }, { rows: [t] }, { rows: [played] }] = await Promise.all([
    // Ranked by NET profit (winnings minus stakes); gross winnings are shown next to it.
    c.query(`with n as (select pid, net from (${games.map((g) => NET_SQL[g]).join(' union all ')}) x where x.at >= ${since}),
      g as (select name, count(*)::int wins, sum(amount)::bigint won from ${wins} group by name)
      select p.name, coalesce(g.wins, 0)::int wins, coalesce(g.won, 0)::bigint won, sum(n.net)::bigint net, count(*)::int games
      from n join players p on p.id = n.pid left join g on g.name = p.name where not p.is_house group by p.name, g.wins, g.won
      having sum(n.net) > 0 order by net desc, wins desc limit 20`),
    c.query(`select * from ${wins} order by amount desc, at desc limit 12`),
    c.query(`select * from ${wins} order by at desc limit 20`),
    c.query(`select count(*)::int wins, coalesce(sum(amount),0)::bigint paid, count(distinct name)::int winners from ${wins}`),
    c.query(`select
      (select count(*) from duels where settled_at is not null and b_player is not null and settled_at >= ${since})::int duels,
      (select count(*) from bets where settled_at is not null and settled_at >= ${since})::int bets,
      (select count(*) from pf_matches where status = 'done' and settled_at >= ${since})::int fights,
      (select count(*) from players where not is_house)::int players`),
  ]);
  const num = (r) => ({ ...r, won: r.won != null ? Number(r.won) : undefined, net: r.net != null ? Number(r.net) : undefined, amount: r.amount != null ? Number(r.amount) : undefined });
  return { top: top.map(num), biggest: biggest.map(num), latest: latest.map(num), totals: { ...t, paid: Number(t.paid), ...played } };
}

// ---------- Proof: look up the game behind an on-chain record; player profiles ----------
/** DB side of a record id (duel / bet / fight), so the browser can compare it with what the chain says. */
export async function matchById(kind, id) {
  const c = await db();
  if (kind === 'SDL1') {
    const { rows: [d] } = await c.query('select d.*, pa.name a_name, pb.name b_name from duels d join players pa on pa.id=d.a_player left join players pb on pb.id=d.b_player where d.id=$1', [id]);
    return d && { game: 'rps', id: d.id, aName: d.a_name, bName: d.b_name, stake: d.stake, aMove: d.a_move, bMove: d.b_move, aSalt: d.a_salt, commit: d.a_commit, result: d.result, recordTxid: d.record_txid, settledAt: d.settled_at };
  }
  if (kind === 'SUD1') {
    const { rows: [b] } = await c.query('select b.*, p.name from bets b join players p on p.id=b.player_id where b.id=$1', [id]);
    return b && { game: 'updown', id: b.id, name: b.name, side: b.side, stake: b.stake, roundStart: Number(b.round_start), open: Number(b.open_price), close: Number(b.close_price), result: b.result, outcome: b.outcome, payout: b.payout, source: b.price_source, recordTxid: b.record_txid };
  }
  if (kind === 'SPF1') {
    const { rows: [m] } = await c.query('select m.*, pa.name a_name, pb.name b_name from pf_matches m join players pa on pa.id=m.a_player left join players pb on pb.id=m.b_player where m.id=$1', [id]);
    return m && { game: 'pf', id: m.id, aName: m.a_name, bName: m.b_name, stake: m.stake, target: m.target, maxStep: m.max_step, first: m.first, turns: m.turns, winner: m.winner, aPrompt: m.a_prompt, bPrompt: m.b_prompt, recordTxid: m.record_txid };
  }
  return null;
}

/** Public profile: totals per game and the full history, each with its on-chain record. */
export async function player(name) {
  const c = await db();
  const { rows: [p] } = await c.query('select id, name, created_at from players where lower(name)=lower($1) and not is_house order by id limit 1', [String(name ?? '')]);
  if (!p) throw new UserError('no such player', 404);
  const { rows: history } = await c.query(`
    select 'rps' game, d.id, d.settled_at at, d.stake, case when d.result = 0 then 'draw' when d.winner = $1 then 'win' else 'lose' end outcome,
           case when d.winner = $1 then d.stake * 2 when d.result = 0 then d.stake else 0 end paid, d.record_txid tx,
           case when d.a_player = $1 then pb.name else pa.name end opponent
      from duels d join players pa on pa.id=d.a_player left join players pb on pb.id=d.b_player
      where (d.a_player = $1 or d.b_player = $1) and d.settled_at is not null and d.b_player is not null
    union all
    select 'updown', b.id, b.settled_at, b.stake, case when b.outcome = 'refund' then 'draw' else b.outcome end, coalesce(b.payout, 0), b.record_txid, b.side from bets b where b.player_id = $1 and b.settled_at is not null
    union all
    select 'pf', m.id, m.settled_at, m.stake, case when m.winner_id = $1 then 'win' else 'lose' end, case when m.winner_id = $1 then m.stake * 2 else 0 end, m.record_txid,
           case when m.a_player = $1 then pb.name else pa.name end
      from pf_matches m join players pa on pa.id=m.a_player left join players pb on pb.id=m.b_player where (m.a_player = $1 or m.b_player = $1) and m.status = 'done'
    order by at desc limit 100`, [p.id]);
  const stats = { games: history.length, wins: history.filter((h) => h.outcome === 'win').length, losses: history.filter((h) => h.outcome === 'lose').length,
    staked: history.reduce((s, h) => s + h.stake, 0), paid: history.reduce((s, h) => s + Number(h.paid), 0) };
  stats.net = stats.paid - stats.staked; stats.winRate = stats.games ? stats.wins / stats.games : 0;
  stats.verified = history.filter((h) => h.tx).length;
  return { name: p.name, since: p.created_at, stats, history: history.map((h) => ({ ...h, paid: Number(h.paid) })) };
}

/** The signed-in player's own money movements, newest first. */
export async function activity(token) {
  const c = await db();
  const p = await playerByToken(c, token);
  const { rows } = await c.query(`
    select 'deposit' kind, sats amount, txid tx, created_at at, null::text note from deposits where player_id = $1
    union all select 'withdrawal', -amount, txid, created_at, status || ' · fee ' || fee from withdrawals where player_id = $1
    union all select 'bonus', sats, null, created_at, reason from bonus_grants where player_id = $1
    order by at desc limit 50`, [p.id]);
  const games = (await player(p.name).catch(() => ({ history: [] }))).history;
  return { money: rows.map((r) => ({ ...r, amount: Number(r.amount) })), games };
}

export async function pfLatest() {
  const { rows: [m] } = await (await db()).query("select id from pf_matches where status='done' order by settled_at desc limit 1");
  return m ? pfGet(m.id) : null;
}
