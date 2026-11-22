const pc = require('puppeteer-core'); const http = require('http'); const fs = require('fs'); const path = require('path');
const DIR = path.join(__dirname, 'vid'); const OUT = process.env.OUT ?? 'passbch-demo.mp4';
const types = { '.html': 'text/html', '.png': 'image/png', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.txt': 'text/plain' };
let got = null;
const srv = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/upload')) { const ch = []; req.on('data', (d) => ch.push(d)); req.on('end', () => { got = Buffer.concat(ch); res.end('ok'); }); return; }
  const f = path.join(DIR, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if (e) { res.statusCode = 404; return res.end(); } res.setHeader('content-type', types[path.extname(f)] ?? 'application/octet-stream'); res.end(d); });
}).listen(8768);
(async () => {
  const b = await pc.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', protocolTimeout: 900000, args: ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
  const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
  p.on('pageerror', (e) => console.log('pageerror', e.message)); p.on('console', (m) => console.log('page:', m.text().slice(0, 200)));
  await p.goto('http://localhost:8768/compose2.html', { waitUntil: 'load' });
  await p.evaluate(() => window.__run());
  const t0 = Date.now();
  for (;;) { const s = await p.evaluate(() => ({ r: window.__result, e: window.__error })); if (s.e) { console.log('ERROR', s.e); break; } if (s.r) { console.log('rendered', s.r); break; } if (Date.now() - t0 > 600000) { console.log('timeout'); break; } await new Promise((r) => setTimeout(r, 3000)); }
  const ok = await p.evaluate(async () => { if (!window.__blob) return false; await fetch('/upload', { method: 'POST', body: window.__blob }); return true; });
  if (ok && got) { fs.writeFileSync(OUT, got); console.log('saved', OUT, (got.length / 1e6).toFixed(1), 'MB'); }
  await b.close(); srv.close();
})();
