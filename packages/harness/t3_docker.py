"""T3 in a clean python:3.12 container: each qualifying exercise's reference solution must pass its
own tests in < 30 s inside passrate-runner (--network none). Writes test-reports/t3-docker.json."""
import json, pathlib, shutil, tempfile, time
from harness import EXERCISES, ROOT, run_tests, parse_pytest

sel = json.loads((ROOT.parent.parent / 'test-reports' / 't3-task-selection.json').read_text(encoding='utf-8'))
res = {'image': 'passrate-runner:py312', 'commit': sel['commit'], 'included': [], 'excluded': []}
for t in sel['included']:
    ex = EXERCISES / t['slug']
    w = pathlib.Path(tempfile.mkdtemp(prefix=f"t3-{t['slug']}-", dir=ROOT / '.cache'))
    try:
        for f in ex.iterdir():
            if f.name.startswith('.'): continue
            (shutil.copytree if f.is_dir() else shutil.copy)(f, w / f.name)
        cfg = json.loads((ex / '.meta' / 'config.json').read_text(encoding='utf-8'))
        shutil.copy(ex / cfg['files']['example'][0], w / t['solution'])
        code, out, secs = run_tests(w)
        passed, total = parse_pytest(out)
        ok = code == 0 and secs < 30
        row = {'slug': t['slug'], 'seconds': round(secs, 2), 'passed': passed, 'total': total}
        (res['included'] if ok else res['excluded']).append(row if ok else {**row, 'reason': f'exit {code}' if code else 'too slow'})
        print(f"{'OK ' if ok else 'XX '} {t['slug']:30} {passed}/{total} {secs:.1f}s", flush=True)
    finally:
        shutil.rmtree(w, ignore_errors=True)
res['counts'] = {'included': len(res['included']), 'excluded': len(res['excluded'])}
(ROOT.parent.parent / 'test-reports' / 't3-docker.json').write_text(json.dumps(res, indent=1), encoding='utf-8')
print(json.dumps(res['counts']))
