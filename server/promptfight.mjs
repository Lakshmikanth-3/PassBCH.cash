// Prompt Fight: two players each write a strategy prompt for an AI agent; the agents play "Race to N" live.
// Rules are enforced by code (no AI judge): the agent that brings the total exactly to the target wins.
// Each agent sees only ITS OWN owner's prompt and the board, so a prompt can't attack the other agent.
import { createHash } from 'node:crypto';

export const PF = {
  promptMax: 400,
  model: 'openai/gpt-oss-20b',
  houseName: 'House Agent',
  housePrompt: 'Play casually. Usually add 1 or 2, sometimes the maximum. Do not overthink it.',
};
const h = (s) => createHash('sha256').update(s).digest('hex');

/** Match setup drawn from the match id (the creator can't pick it): target 15–24, max step 2–4, who moves first. */
export function drawSetup(matchId) {
  const x = h(`pf:${matchId}`);
  return { target: 15 + (parseInt(x.slice(0, 4), 16) % 10), maxStep: 2 + (parseInt(x.slice(4, 8), 16) % 3), first: parseInt(x.slice(8, 10), 16) % 2 === 0 ? 'a' : 'b' };
}
/** Coin flip for who moves first: the server commits sha256("first:"+seed) when the match is created (before any prompt
 *  is known to the opponent) and reveals the seed when the fight ends, so anyone can check the flip was not chosen later. */
export const firstCommit = (seed) => h(`first:${seed}`);
export const firstFromSeed = (seed, matchId) => (parseInt(h(`flip:${seed}:${matchId}`).slice(0, 2), 16) % 2 === 0 ? 'a' : 'b');
export function cleanPrompt(p) {
  const s = String(p ?? '').replace(/\s+/g, ' ').trim().slice(0, PF.promptMax);
  if (s.length < 5) throw new Error('write a strategy prompt of at least 5 characters');
  return s;
}
export const legalMoves = (total, { target, maxStep }) => Array.from({ length: Math.min(maxStep, target - total) }, (_, i) => i + 1);
/** First legal number in the reply; otherwise null (the server then plays the smallest legal move and marks it). */
export function parseMove(text, legal) {
  const t = String(text ?? '');
  try { const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); const n = Number(j.add); if (legal.includes(n)) return n; } catch { /* not JSON: fall back to the first legal number */ }
  for (const m of String(text ?? '').matchAll(/\d+/g)) { const n = Number(m[0]); if (legal.includes(n)) return n; }
  return null;
}
export function messagesFor(prompt, { target, maxStep }, total, history, you) {
  return [
    { role: 'system', content: `You are an AI agent playing the game "Race to ${target}". Players take turns adding a whole number from 1 to ${maxStep} to a shared total that starts at 0. The player who makes the total exactly ${target} wins. The total may never go above ${target}.\nYour owner gave you this strategy:\n"""${prompt}"""\nFollow your owner's strategy. Reply with ONLY a JSON object like {"add": 2}.` },
    { role: 'user', content: `Total is ${total}. Moves so far: ${history.length ? history.map((t) => `${t.side === you ? 'you' : 'opponent'} +${t.add}`).join(', ') : 'none'}. You may add ${legalMoves(total, { target, maxStep }).join(', ')}. Reply as JSON: {"add": <number>}` },
  ];
}

/**
 * Play a full match. ask(messages) -> Promise<string> (the model reply). Never throws on a bad reply:
 * an unparsable or failed reply plays the smallest legal move (marked auto) so the match always finishes.
 */
export async function playMatch({ id, promptA, promptB, ask, deadlineMs = 24000, seed }) {
  const setup = drawSetup(id);
  if (seed) setup.first = firstFromSeed(seed, id);
  const turns = []; let total = 0; let side = setup.first; const t0 = Date.now();
  while (total < setup.target) {
    const legal = legalMoves(total, setup);
    let add = null, auto = false, said = '';
    if (Date.now() - t0 < deadlineMs) {
      const msgs = messagesFor(side === 'a' ? promptA : promptB, setup, total, turns, side);
      for (let attempt = 0; attempt < 2 && add == null && Date.now() - t0 < deadlineMs; attempt++) { // one retry on an invalid or failed reply
        try { said = await ask(attempt ? [...msgs, { role: 'user', content: `Invalid. Reply with ONLY JSON like {"add": ${legal[0]}} using one of: ${legal.join(', ')}.` }] : msgs); add = parseMove(said, legal); } catch { /* retry once, then play automatically */ }
      }
    }
    if (add == null) { add = legal[0]; auto = true; }
    total += add;
    turns.push({ side, add, total, auto, said: String(said).slice(0, 80) });
    if (total === setup.target) return { ...setup, turns, winner: side };
    side = side === 'a' ? 'b' : 'a';
  }
  throw new Error('unreachable');
}

/** Groq chat call used in production (tiny replies, low reasoning effort so a match fits in ~30 s). */
export function groqAsk(key, model = PF.model, retried = false) {
  return async (messages) => {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', signal: AbortSignal.timeout(8000),
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature: 0.2, max_completion_tokens: 700, reasoning_effort: 'low', response_format: { type: 'json_object' } }),
    });
    if (r.status === 429 && !retried) { await new Promise((ok) => setTimeout(ok, 1500)); return groqAsk(key, model, true)(messages); } // free-tier burst: one short wait
    if (!r.ok) throw new Error(`groq ${r.status}`);
    const j = await r.json();
    return j.choices?.[0]?.message?.content ?? '';
  };
}

/** OP_RETURN record: "SPF1" | matchId(16) | winner a=1 b=2 (1) | target(1) | maxStep(1) | stake(4) | sha256(turns)(32) = 59 bytes */
export function pfRecordBytes({ id, winner, target, maxStep, stake, turns }) {
  const b = Buffer.alloc(59);
  b.write('SPF1', 0, 'ascii'); Buffer.from(id, 'hex').copy(b, 4);
  b[20] = winner === 'a' ? 1 : 2; b[21] = target; b[22] = maxStep; b.writeUInt32LE(stake, 23);
  Buffer.from(h(JSON.stringify(turns.map((t) => [t.side, t.add]))), 'hex').copy(b, 27);
  return b;
}
