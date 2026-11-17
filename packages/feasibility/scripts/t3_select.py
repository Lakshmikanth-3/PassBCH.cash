"""T3: task-set selection. For each exercises/practice/* in exercism/python at a pinned commit,
copy .meta/example.py over the stub, run the exercise's own tests, record pass/time.
Qualifies if the reference passes in < 30 s. Writes JSON with included + excluded (with reasons).
Usage: python t3_select.py <exercism-python-checkout> <out.json> [--python PATH]
NOTE: PRD rule says a clean python:3.12 container; run with --docker once the daemon is available."""
import json, shutil, subprocess, sys, tempfile, time, pathlib, hashlib

root = pathlib.Path(sys.argv[1]); out = sys.argv[2]
py = sys.argv[sys.argv.index('--python') + 1] if '--python' in sys.argv else sys.executable
commit = subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD'], text=True).strip()
res = {'repo': 'exercism/python', 'commit': commit, 'runtime': subprocess.check_output([py, '-V'], text=True).strip(), 'included': [], 'excluded': []}

def h(p): return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()

for ex in sorted((root / 'exercises' / 'practice').iterdir()):
    cfg_p = ex / '.meta' / 'config.json'
    slug = ex.name
    if not cfg_p.exists(): res['excluded'].append({'slug': slug, 'reason': 'no config.json'}); continue
    cfg = json.loads(cfg_p.read_text(encoding='utf-8'))
    files = cfg.get('files', {})
    try:
        sol, test, example = files['solution'][0], files['test'][0], files['example'][0]
    except (KeyError, IndexError):
        res['excluded'].append({'slug': slug, 'reason': 'config lacks solution/test/example'}); continue
    instr = ex / '.docs' / 'instructions.md'
    if not instr.exists(): res['excluded'].append({'slug': slug, 'reason': 'no instructions.md'}); continue
    with tempfile.TemporaryDirectory() as d:
        d = pathlib.Path(d)
        for f in ex.iterdir():
            if f.name in ('.meta', '.docs'): continue
            (shutil.copytree if f.is_dir() else shutil.copy)(f, d / f.name)
        shutil.copy(ex / example, d / sol)
        t0 = time.time()
        try:
            r = subprocess.run([py, '-m', 'pytest', '-x', '-q', '-p', 'no:cacheprovider', test], cwd=d, capture_output=True, text=True, timeout=60)
            dt = time.time() - t0
            ok = r.returncode == 0
            reason = None if ok else 'reference fails own tests: ' + (r.stdout.strip().splitlines() or ['?'])[-1][:120]
        except subprocess.TimeoutExpired:
            dt, ok, reason = 60.0, False, 'timeout >60s'
    if ok and dt >= 30: ok, reason = False, f'reference took {dt:.1f}s (>=30s)'
    if ok:
        res['included'].append({'slug': slug, 'refSeconds': round(dt, 2), 'solution': sol, 'test': test,
                                'instructionsSha256': h(instr), 'stubSha256': h(ex / sol), 'testsSha256': h(ex / test)})
    else:
        res['excluded'].append({'slug': slug, 'reason': reason})
res['counts'] = {'included': len(res['included']), 'excluded': len(res['excluded'])}
pathlib.Path(out).write_text(json.dumps(res, indent=1))
print(res['runtime'], res['commit'][:10], res['counts'])
for e in res['excluded']: print(' excl', e['slug'], '-', e['reason'])
