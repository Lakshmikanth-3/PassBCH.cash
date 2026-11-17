"""T4: run the agent on N exercises drawn deterministically from the T3 qualifying set.
Usage: python t4_run.py <model> [N=10]
Writes runs/t4-<model>.json (full) and prints a summary against the PRD thresholds."""
import hashlib, json, pathlib, statistics, sys, time
from harness import run_exercise, load_env, ROOT

model = sys.argv[1]; n = int(sys.argv[2]) if len(sys.argv) > 2 else 10
sel = json.loads((ROOT.parent.parent / 'test-reports' / 't3-task-selection.json').read_text(encoding='utf-8'))
slugs = [t['slug'] for t in sel['included']]
# Deterministic, public draw: sha256("T4" || i) mod |pool|, skipping repeats.
picked, i = [], 0
while len(picked) < n:
    idx = int(hashlib.sha256(f'T4|{i}'.encode()).hexdigest(), 16) % len(slugs); i += 1
    if slugs[idx] not in picked: picked.append(slugs[idx])

key = load_env()
out_dir = ROOT / 'runs'; out_dir.mkdir(exist_ok=True)
results = []
for s in picked:
    print(f'> {s}', flush=True)
    try:
        results.append(run_exercise(s, model, key))
    except Exception as e:  # recorded, counted as FAIL
        results.append({'slug': s, 'model': model, 'pass': False, 'error': str(e)[:300], 'durationS': None})
    time.sleep(8)  # be gentle with free-tier rate limits

safe = model.replace('/', '_')
(out_dir / f't4-{safe}.json').write_text(json.dumps({'model': model, 'picked': picked, 'results': results}, indent=1), encoding='utf-8')
d = [r['durationS'] for r in results if r.get('durationS') is not None]
summary = {
    'model': model, 'n': len(results),
    'pass': sum(r['pass'] for r in results), 'fail': sum(not r['pass'] for r in results),
    'infraErrors': sum('error' in r for r in results),  # API errors after retries: excluded from model pass/fail below
    'modelPass': sum(r['pass'] for r in results if 'error' not in r),
    'modelFail': sum(not r['pass'] for r in results if 'error' not in r),
    'medianS': round(statistics.median(d), 1) if d else None,
    'p90S': round(sorted(d)[max(0, int(len(d) * 0.9) - 1)], 1) if d else None,
    'under60': sum(x < 60 for x in d),
    'tokens': sum(r.get('usage', {}).get('prompt_tokens', 0) + r.get('usage', {}).get('completion_tokens', 0) for r in results),
    'costUSD': 0.0,  # Groq free tier
}
summary['go'] = bool(summary['medianS'] is not None and summary['medianS'] <= 120 and summary['modelPass'] >= 1
                     and summary['modelFail'] >= 1 and summary['infraErrors'] <= 1)
print(json.dumps(summary))
for r in results:
    print(f"{r['slug']:28} {'PASS' if r['pass'] else 'FAIL'} {r.get('passed','-')}/{r.get('total','-')} {r.get('durationS')}s att={r.get('attempts','-')} {r.get('error','')[:60]}")
