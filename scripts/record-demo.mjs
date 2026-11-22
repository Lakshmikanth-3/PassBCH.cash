// Records a REAL run of the terminal client (against the live site) as an asciicast file plus a self-contained HTML player.
//   node scripts/record-demo.mjs            -> docs/demo/terminal-demo.cast and docs/demo/terminal-demo.html
// It uses a throwaway home folder, so your saved login (~/.passbch.json) is not touched. Games spend a little chipnet BCH.
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const URL_ = process.env.DUEL_URL ?? 'https://passbch-cash.vercel.app';
const home = mkdtempSync(path.join(tmpdir(), 'passbch-demo-'));
const W = 100, H = 34;
const events = []; const t0 = Date.now(); const at = () => (Date.now() - t0) / 1000;
const strip = (s) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const child = spawn(process.execPath, ['web/public/duel.mjs'], {
  env: { ...process.env, HOME: home, USERPROFILE: home, DUEL_URL: URL_, PASSBCH_FORCE_TTY: '1', PASSBCH_NO_UPDATE: '1', COLUMNS: String(W), FORCE_COLOR: '1' },
  stdio: ['pipe', 'pipe', 'pipe'],
});
let buf = ''; let tx = null; let waiter = null;
const onData = (d) => { const s = d.toString('utf8'); events.push([at(), 'o', s]); buf += s; const m = strip(s).match(/\b([0-9a-f]{64})\b/); if (m && /Verified on Bitcoin Cash/.test(strip(buf))) tx = tx ?? m[1]; waiter?.(); };
child.stdout.on('data', onData); child.stderr.on('data', onData);

/** Wait until the output matches `re`, then consume the buffer up to the end of that match. */
async function expect(re, timeout = 90000) {
  const start = Date.now();
  for (;;) {
    const m = strip(buf).match(re);
    if (m) { const idx = buf.length; const text = strip(buf); buf = ''; return { m, text }; }
    if (Date.now() - start > timeout) throw new Error(`timed out waiting for ${re}\n--- last output ---\n${strip(buf).slice(-600)}`);
    await new Promise((r) => { waiter = r; setTimeout(r, 300); });
  }
}
/** "Type" a line like a person (echoed into the recording), then send it to the client. */
async function type(line, perChar = 90) {
  await sleep(700);
  for (const ch of line) { events.push([at(), 'o', ch]); await sleep(perChar); }
  events.push([at(), 'o', '\r\n']); child.stdin.write(line + '\n');
}
async function pause(ms) { await sleep(ms); }

try {
  await expect(/Welcome[\s\S]*> $/);                       await type('g');          // one-key guest account
  await expect(/> $/);                                      await pause(1500); await type('4');   // Coin Flip
  await expect(/Tails\s*> $/);                              await type('h');
  await expect(/Stake[\s\S]*: $/);                          await type('1');
  await expect(/Verified on Bitcoin Cash/, 120000);
  await expect(/> $/);                                      await pause(1500); await type('5');   // Typing Race
  await expect(/join a friend's race > $/);                 await type('1');
  await expect(/Stake[\s\S]*: $/);                          await type('1');
  const { text } = await expect(/type it > $/);
  const phrase = text.split('\n').map((l) => l.trim()).find((l) => /^[a-z ]{20,}$/.test(l));
  await type(phrase, 95);
  await expect(/Verified on Bitcoin Cash/, 120000);
  await expect(/> $/);                                      await pause(1500); await type('l');   // winners (net profit + solvency)
  await expect(/> $/);                                      await pause(3500); await type('');
  await expect(/> $/);                                      await pause(1000); await type('v');   // verify the typing race we just ran
  await expect(/Transaction id: $/);                        await type(tx ?? '', 12);
  await expect(/VERIFIED|MISMATCH|VALID RECORD/, 60000);
  await expect(/> $/);                                      await pause(3500); await type('q');
  await sleep(1200);
} catch (e) { console.error(String(e.message ?? e)); }
child.kill();

// never publish the throwaway account's login code: mask it everywhere in the recording
try {
  const token = JSON.parse(readFileSync(path.join(home, '.passbch.json'), 'utf8')).token;
  if (token) for (const e of events) e[2] = e[2].split(token).join('*'.repeat(token.length));
} catch { /* no saved login */ }
mkdirSync('docs/demo', { recursive: true });
const cast = [JSON.stringify({ version: 2, width: W, height: H, timestamp: Math.floor(t0 / 1000), title: 'PassBCH.cash terminal demo' }), ...events.map((e) => JSON.stringify([Number(e[0].toFixed(3)), e[1], e[2]]))].join('\n') + '\n';
writeFileSync('docs/demo/terminal-demo.cast', cast);

// ---------- self-contained player (no libraries): replays the recording in a terminal-looking page ----------
const player = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PassBCH.cash terminal demo</title>
<style>
html,body{margin:0;background:#0d1117;color:#e6edf3;font-family:system-ui,sans-serif}
.bar{display:flex;gap:10px;align-items:center;padding:10px 16px;background:#161b22;border-bottom:1px solid #30363d;position:sticky;top:0}
button{background:#238636;color:#fff;border:0;border-radius:6px;padding:7px 14px;font:600 14px system-ui;cursor:pointer} button.s{background:#30363d}
.dots span{display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:5px}
#t{margin:0 auto;max-width:${W + 4}ch;padding:16px 20px 60px;font:15px/1.28 "Cascadia Mono","JetBrains Mono",Consolas,monospace;white-space:pre;overflow-x:auto;min-height:70vh}
.note{color:#8b949e;font-size:13px}
</style></head><body>
<div class="bar"><span class="dots"><span style="background:#ff5f56"></span><span style="background:#ffbd2e"></span><span style="background:#27c93f"></span></span>
<b>PassBCH.cash in a terminal</b><button id="p">Play</button><button class="s" id="r">Restart</button>
<label class="note"><input type="checkbox" id="fast" checked> skip long waits</label><span class="note" id="clk"></span></div>
<pre id="t"></pre>
<script>
const EVENTS=${JSON.stringify(events.map((e) => [Number(e[0].toFixed(3)), e[2]]))};
const PAL=(n)=>{if(n<16)return['#000','#c00','#0a0','#c90','#37f','#a0a','#0aa','#ccc','#555','#f55','#5f5','#ff5','#59f','#f5f','#5ff','#fff'][n];if(n<232){n-=16;const c=[0,95,135,175,215,255];return'rgb('+c[Math.floor(n/36)]+','+c[Math.floor(n/6)%6]+','+c[n%6]+')'}const g=8+(n-232)*10;return'rgb('+g+','+g+','+g+')'};
let lines,row,col,st;
function reset(){lines=[[]];row=0;col=0;st={b:0,d:0,fg:null};document.getElementById('t').innerHTML=''}
function put(ch){const L=lines[row]||(lines[row]=[]);L[col]={c:ch,s:{...st}};col++}
function sgr(p){if(!p.length)p=[0];for(let i=0;i<p.length;i++){const n=p[i];if(n===0){st={b:0,d:0,fg:null}}else if(n===1)st.b=1;else if(n===2)st.d=1;else if(n===22){st.b=0;st.d=0}else if(n===39)st.fg=null;else if(n>=30&&n<=37)st.fg=PAL(n-30);else if(n>=90&&n<=97)st.fg=PAL(n-90+8);else if(n===38&&p[i+1]===5){st.fg=PAL(p[i+2]);i+=2}}}
function feed(s){for(let i=0;i<s.length;i++){const ch=s[i];if(ch==='\\x1b'&&s[i+1]==='['){let j=i+2;while(j<s.length&&!/[A-Za-z]/.test(s[j]))j++;const f=s[j],raw=s.slice(i+2,j),p=raw.replace('?','').split(';').filter(x=>x!=='').map(Number);i=j;
if(f==='m')sgr(p);else if(f==='A'){row=Math.max(0,row-(p[0]||1))}else if(f==='J'){if(!p.length||p[0]===0){lines[row]=(lines[row]||[]).slice(0,col);lines.length=row+1}else{lines=[[]];row=0;col=0}}else if(f==='H'){row=0;col=0}else if(f==='K'){lines[row]=(lines[row]||[]).slice(0,col)}else if(f==='G'){col=Math.max(0,(p[0]||1)-1)}}
else if(ch==='\\r')col=0;else if(ch==='\\n'){row++;col=0;if(!lines[row])lines[row]=[]}else if(ch>=' ')put(ch)}}
function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;')}
function draw(){let h='';for(const L of lines){let run='',cur=null;const flush=()=>{if(run){const c=cur;h+='<span style="'+(c.fg?'color:'+c.fg+';':'')+(c.b?'font-weight:700;':'')+(c.d?'opacity:.6;':'')+'">'+esc(run)+'</span>';run=''}};for(const x of (L||[])){const c=x?x.s:{b:0,d:0,fg:null};const ch=x?x.c:' ';if(cur&&(cur.fg!==c.fg||cur.b!==c.b||cur.d!==c.d)){flush()}cur=c;run+=ch}flush();h+='\\n'}const t=document.getElementById('t');t.innerHTML=h;window.scrollTo(0,document.body.scrollHeight)}
let idx=0,timer=0,playing=false,vt=0;
function step(){if(!playing)return;if(idx>=EVENTS.length){playing=false;document.getElementById('p').textContent='Replay';return}
const e=EVENTS[idx];let gap=idx?e[0]-EVENTS[idx-1][0]:0;if(document.getElementById('fast').checked)gap=Math.min(gap,1.4);
timer=setTimeout(()=>{if(!playing)return;feed(e[1]);idx++;vt+=gap;draw();document.getElementById('clk').textContent=vt.toFixed(0)+'s';step()},gap*1000)}
document.getElementById('p').onclick=()=>{if(idx>=EVENTS.length){reset();idx=0;vt=0}playing=!playing;document.getElementById('p').textContent=playing?'Pause':'Play';if(playing)step();else clearTimeout(timer)};
document.getElementById('r').onclick=()=>{clearTimeout(timer);reset();idx=0;vt=0;playing=true;document.getElementById('p').textContent='Pause';step()};
reset();
</script></body></html>`;
writeFileSync('docs/demo/terminal-demo.html', player);
console.log(`recorded ${events.length} events in ${at().toFixed(1)}s -> docs/demo/terminal-demo.cast and docs/demo/terminal-demo.html`);
process.exit(0);
