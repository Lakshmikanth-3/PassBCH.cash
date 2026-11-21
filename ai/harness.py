"""PassBCH AI exam harness: one exercise, one model, policy = 1 attempt + 1 retry with test output.

The agent sees only instructions + stub (never tests or the reference solution).
Model-written code runs only inside the passrate-runner container with --network none.
"""
import hashlib, json, os, pathlib, re, shutil, subprocess, tempfile, time, urllib.request, urllib.error

ROOT = pathlib.Path(__file__).resolve().parent
EXERCISES = ROOT / '.cache' / 'exercism-python' / 'exercises' / 'practice'
IMAGE = 'passrate-runner:py312'
GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
ATTEMPT_POLICY = 2  # 1 attempt + 1 retry
TEST_TIMEOUT_S = 60
# Pinned generation settings (part of the harness digest committed in START).
GEN_PARAMS = {'temperature': 0, 'max_completion_tokens': 4096, 'reasoning_effort': 'medium'}

SYSTEM = ("You are a Python coding agent. Implement the requested module so the hidden unit tests pass. "
          "Reply with the COMPLETE contents of the solution file in a single ```python code block and nothing else.")


def sha256(b): return hashlib.sha256(b if isinstance(b, bytes) else b.encode()).hexdigest()


def load_env():
    """Read GROQ_KEY from <repo>/.ENV or keys/.env without exporting it anywhere else."""
    for p in (ROOT.parent / '.ENV', ROOT.parent / 'keys' / '.env'):
        if p.exists():
            for line in p.read_text(encoding='utf-8').splitlines():
                k, _, v = line.partition('=')
                if k.strip() in ('GROQ_KEY', 'AI_API_KEY') and v.strip():
                    return v.strip().strip('"')
    raise RuntimeError('GROQ_KEY not found in .ENV')


def extract_code(text):
    blocks = re.findall(r"```(?:python|py)?\s*\n(.*?)```", text, re.S)
    if blocks: return max(blocks, key=len)
    return text.strip()


def parse_pytest(out):
    """Return (passed, total) from pytest -q summary output."""
    counts = {k: int(n) for n, k in re.findall(r"(\d+) (passed|failed|error|errors)", out)}
    passed = counts.get('passed', 0)
    total = passed + counts.get('failed', 0) + counts.get('error', 0) + counts.get('errors', 0)
    return passed, total


def chat(key, model, messages, max_retries=6):
    body = json.dumps({'model': model, 'messages': messages, **GEN_PARAMS}).encode()
    empties = 0
    for i in range(max_retries):
        req = urllib.request.Request(GROQ_URL, body, {'Authorization': f'Bearer {key}', 'Content-Type': 'application/json',
                                                      'User-Agent': 'passrate-harness/0.1'})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                j = json.load(r)
                content = j['choices'][0]['message'].get('content') or ''
                if not content.strip() and empties < 2:  # intermittent empty reply: re-request, not a new attempt
                    empties += 1; time.sleep(2); continue
                usage = dict(j.get('usage', {})); usage['emptyReplies'] = empties
                return content, usage, r.headers.get('x-request-id')
        except urllib.error.HTTPError as e:
            msg = e.read()[:300]
            transient = e.code in (429, 500, 502, 503) or (e.code == 413 and b'per minute' in msg)                 or (e.code == 400 and b'Tool choice is none' in msg)  # gpt-oss stray tool call: re-ask
            if transient and i < max_retries - 1:
                wait = float(e.headers.get('retry-after') or 0) or (20 if e.code == 413 else 2 ** i)
                time.sleep(min(wait, 60)); continue
            raise RuntimeError(f'groq HTTP {e.code}: {msg!r}')
    raise RuntimeError('groq: retries exhausted')


def run_tests(work):
    t0 = time.time()
    try:
        r = subprocess.run(['docker', 'run', '--rm', '--network', 'none', '--memory', '512m', '--cpus', '1',
                            '-v', f'{work}:/work', IMAGE], capture_output=True, text=True, timeout=TEST_TIMEOUT_S + 30)
        out = r.stdout + r.stderr
        code = r.returncode
    except subprocess.TimeoutExpired:
        out, code = 'TIMEOUT', 124
    return code, out, time.time() - t0


def run_exercise(slug, model, key=None, log=print):
    key = key or load_env()
    ex = EXERCISES / slug
    cfg = json.loads((ex / '.meta' / 'config.json').read_text(encoding='utf-8'))
    sol_name, test_name = cfg['files']['solution'][0], cfg['files']['test'][0]
    instructions = (ex / '.docs' / 'instructions.md').read_text(encoding='utf-8')
    append = ex / '.docs' / 'instructions.append.md'
    if append.exists(): instructions += '\n\n' + append.read_text(encoding='utf-8')
    stub = (ex / sol_name).read_text(encoding='utf-8')

    messages = [{'role': 'system', 'content': SYSTEM},
                {'role': 'user', 'content': f"# Exercise: {slug}\n\n{instructions}\n\n# File `{sol_name}` (stub):\n```python\n{stub}\n```"}]
    transcript, usage_total, request_ids = [], {'prompt_tokens': 0, 'completion_tokens': 0, 'emptyReplies': 0}, []
    t_start = time.time()
    code, out, passed, total, solution = 1, '', 0, 0, ''
    work = pathlib.Path(tempfile.mkdtemp(prefix=f'pr-{slug}-', dir=ROOT / '.cache'))
    try:
        for f in ex.iterdir():
            if f.name.startswith('.'): continue  # .meta, .docs, .approaches, .articles: never exposed
            (shutil.copytree if f.is_dir() else shutil.copy)(f, work / f.name)
        for attempt in range(1, ATTEMPT_POLICY + 1):
            reply, usage, rid = chat(key, model, messages)
            request_ids.append(rid)
            for k in usage_total: usage_total[k] += usage.get(k, 0)
            transcript.append({'t': round(time.time() - t_start, 2), 'role': 'assistant', 'attempt': attempt, 'content': reply})
            solution = extract_code(reply)
            (work / sol_name).write_text(solution, encoding='utf-8')
            code, out, test_s = run_tests(work)
            passed, total = parse_pytest(out)
            transcript.append({'t': round(time.time() - t_start, 2), 'role': 'tests', 'attempt': attempt, 'exit': code,
                               'passed': passed, 'total': total, 'seconds': round(test_s, 2)})
            log(f'  {slug} attempt {attempt}: exit={code} {passed}/{total}')
            if code == 0: break
            messages += [{'role': 'assistant', 'content': reply},
                         {'role': 'user', 'content': 'The tests failed. Output (tail):\n```\n' + out[-3000:] + '\n```\nReturn the full corrected file.'}]
    finally:
        shutil.rmtree(work, ignore_errors=True)
    transcript_json = json.dumps(transcript, ensure_ascii=False)
    return {
        'slug': slug, 'model': model, 'pass': code == 0 and total > 0 and passed == total,
        'exit': code, 'passed': passed, 'total': total,
        'attempts': len([t for t in transcript if t['role'] == 'assistant']),
        'durationS': round(time.time() - t_start, 2),
        'usage': usage_total, 'requestIds': request_ids,
        'solutionHash': sha256(solution), 'testOutHash': sha256(out), 'transcriptHash': sha256(transcript_json),
        'transcript': transcript,
    }
