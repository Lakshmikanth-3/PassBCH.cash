// Postgres (Neon) access. One pool per serverless instance; schema is created on first use.
import pg from 'pg';

export const SCHEMA = `
create table if not exists players (
  id serial primary key,
  token_hash text unique not null,
  name text not null,
  ref_code text unique not null,
  referred_by int references players(id),
  bonus bigint not null default 0 check (bonus >= 0),
  cash bigint not null default 0 check (cash >= 0),
  wins int not null default 0, losses int not null default 0, draws int not null default 0,
  won_sats bigint not null default 0,
  ip_hash text,
  is_house boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists bonus_grants (id serial primary key, player_id int not null references players(id), sats bigint not null, reason text not null, created_at timestamptz not null default now());
create table if not exists duels (
  id text primary key,
  stake int not null,
  a_player int not null references players(id), a_commit text not null, a_from_bonus int not null, a_from_cash int not null,
  a_move text, vs_bot boolean not null default false,
  b_player int references players(id), b_move text, b_from_bonus int, b_from_cash int,
  created_s bigint not null, joined_s bigint,
  result int, winner int references players(id), settled_at timestamptz, settle_reason text,
  record_txid text, bot_commit text
);
alter table duels add column if not exists record_try_at timestamptz;
alter table players add column if not exists wagered bigint not null default 0;
alter table duels add column if not exists a_salt text;
create index if not exists duels_settled on duels (settled_at desc);
create table if not exists deposits (txid text not null, vout int not null, player_id int not null references players(id), sats bigint not null, created_at timestamptz not null default now(), primary key (txid, vout));
create table if not exists withdrawals (id serial primary key, player_id int not null references players(id), address text not null, amount bigint not null, fee bigint not null, txid text, status text not null default 'pending', created_at timestamptz not null default now());
create table if not exists bets (
  id text primary key, player_id int not null references players(id), side text not null check (side in ('up','down')),
  stake int not null, from_bonus int not null, from_cash int not null, round_start bigint not null,
  open_price numeric, close_price numeric, price_source text, result text, outcome text, payout int,
  created_at timestamptz not null default now(), settled_at timestamptz, record_txid text, record_try_at timestamptz
);
create index if not exists bets_round on bets (round_start) where settled_at is null;
create table if not exists ai_rounds (
  id text primary key, model text not null, model_idx int not null, task_idx int not null, slug text not null,
  block_height int not null, block_hash text not null, opened_s bigint not null, bet_close_s bigint not null,
  status text not null default 'open', pass boolean, passed int, total int, duration_s numeric, transcript_hash text,
  settled_at timestamptz, record_txid text, record_try_at timestamptz
);
create table if not exists ai_bets (
  id text primary key, round_id text not null references ai_rounds(id), player_id int not null references players(id),
  side text not null check (side in ('pass','fail')), stake int not null, from_bonus int not null, from_cash int not null,
  odds_pct int not null, outcome text, payout int, created_at timestamptz not null default now()
);
create table if not exists pf_matches (
  id text primary key, stake int not null, vs_bot boolean not null default false,
  a_player int not null references players(id), a_prompt text not null, a_from_bonus int not null, a_from_cash int not null,
  b_player int references players(id), b_prompt text, b_from_bonus int, b_from_cash int,
  created_s bigint not null, target int, max_step int, first text, turns jsonb, winner text, winner_id int references players(id),
  status text not null default 'open', settled_at timestamptz, record_txid text, record_try_at timestamptz
);
create table if not exists qgames (
  id text primary key, kind text not null check (kind in ('coin','type')), player_id int not null references players(id),
  seed text not null, commit text not null, stake int, from_bonus int, from_cash int,
  client_seed text, pick int, result int, phrase text, started_ms bigint, player_ms int, bot_ms int,
  outcome text, payout int, created_at timestamptz not null default now(), settled_at timestamptz, record_txid text, record_try_at timestamptz
);
alter table pf_matches add column if not exists first_seed text;
alter table pf_matches add column if not exists first_commit text;
insert into players (token_hash, name, ref_code, cash, is_house) values ('house', 'House Bot', 'HOUSE', 100000000, true) on conflict do nothing;
`;

let pool, ready;
export function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL not set');
    pool = new pg.Pool({ connectionString: url.replace(/[?&]sslmode=[^&]*/, ''), max: 3, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
  }
  return pool;
}
export async function db() {
  const p = getPool();
  ready ??= p.query(SCHEMA).catch((e) => { ready = null; throw e; });
  await ready;
  return p;
}

/** Run fn(client) in a transaction; rolls back on any error. */
export async function tx(fn) {
  const client = await (await db()).connect();
  try {
    await client.query('begin');
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
