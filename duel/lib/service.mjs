// Satoshi Duel game service: every money move happens in one SQL transaction with row locks.
import { randomBytes } from 'node:crypto';
import * as E from './engine.mjs';
import { tx, db } from './db.mjs';

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
  wins: p.wins, losses: p.losses, draws: p.draws, wonSats: Number(p.won_sats) });

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
  return { player: pub(p), openDuels: rows };
}

/** Create a duel: the move is sent only as a commitment; the salt stays on the player's device. */
export async function createDuel(token, { stake, commit, vsBot }) {
  stake = Number(stake);
  if (!/^[0-9a-f]{64}$/.test(commit ?? '')) throw new UserError('bad commitment');
  return tx(async (c) => {
    const p = await playerByToken(c, token, true);
    let split; try { split = E.takeStake({ bonus: Number(p.bonus), cash: Number(p.cash) }, stake); } catch (e) { throw new UserError(e.message); }
    const id = randomBytes(16).toString('hex');
    await c.query('update players set bonus = bonus - $1, cash = cash - $2 where id = $3', [split.fromBonus, split.fromCash, p.id]);
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
  await c.query('update players set bonus = bonus - $1, cash = cash - $2 where id = $3', [split.fromBonus, split.fromCash, b.id]);
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
  const top = (await c.query(`select name, wins, losses, draws, won_sats from players where not is_house and (wins+losses+draws) > 0 order by won_sats desc, wins desc limit 25`)).rows;
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
