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
create index if not exists duels_settled on duels (settled_at desc);
create table if not exists deposits (txid text not null, vout int not null, player_id int not null references players(id), sats bigint not null, created_at timestamptz not null default now(), primary key (txid, vout));
create table if not exists withdrawals (id serial primary key, player_id int not null references players(id), address text not null, amount bigint not null, fee bigint not null, txid text, status text not null default 'pending', created_at timestamptz not null default now());
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
