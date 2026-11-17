"""Run one exercise and print the result JSON on the last stdout line.
Usage: python run_one.py <slug> <model> <transcript_out.json>"""
import json, sys
from harness import run_exercise

slug, model, out = sys.argv[1], sys.argv[2], sys.argv[3]
r = run_exercise(slug, model, log=lambda m: print(m, file=sys.stderr, flush=True))
with open(out, 'w', encoding='utf-8') as f:
    json.dump(r, f, ensure_ascii=False, indent=1)
print(json.dumps({k: v for k, v in r.items() if k != 'transcript'}))
