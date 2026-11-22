// Renders docs/demo/terminal-demo.cast into a real video file (MP4, or WebM if MP4 is unsupported) using the browser's canvas + MediaRecorder.
// Needs: npm i --no-save puppeteer-core, and Edge or Chrome installed (set CHROME_PATH if it is not the default Edge path).
//   node scripts/render-demo-video.cjs
const pc = require('puppeteer-core'); const fs = require('fs');
const lines = fs.readFileSync('docs/demo/terminal-demo.cast', 'utf8').trim().split('\n');
const head = JSON.parse(lines[0]); const EVENTS = lines.slice(1).map((l) => { const e = JSON.parse(l); return [e[0], e[2]]; });
const COLS = head.width || 100, ROWS = head.height || 34;
const html = `<!doctype html><html><body style="margin:0;background:#000"><canvas id="c" width="1280" height="760"></canvas></body></html>`;
(async () => {
  const b = await pc.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage(); await p.setViewport({ width: 1280, height: 760 });
  p.on('pageerror', (e) => console.log('pageerror', e.message)); p.on('console', (m) => { const t = m.text(); if (!t.startsWith('Failed to load')) console.log('page:', t.slice(0, 160)); });
  await p.setContent(html);
  const res = await p.evaluate(async (EVENTS, COLS, ROWS) => {
    const cv = document.getElementById('c'), g = cv.getContext('2d');
    const PAL = (n) => { if (n < 16) return ['#000', '#c00', '#0a0', '#c90', '#37f', '#a0a', '#0aa', '#ccc', '#555', '#f55', '#5f5', '#ff5', '#59f', '#f5f', '#5ff', '#fff'][n]; if (n < 232) { n -= 16; const c = [0, 95, 135, 175, 215, 255]; return `rgb(${c[Math.floor(n / 36)]},${c[Math.floor(n / 6) % 6]},${c[n % 6]})`; } const v = 8 + (n - 232) * 10; return `rgb(${v},${v},${v})`; };
    let lines, row, col, st;
    const reset = () => { lines = [[]]; row = 0; col = 0; st = { b: 0, d: 0, fg: null }; }; reset();
    const sgr = (p) => { if (!p.length) p = [0]; for (let i = 0; i < p.length; i++) { const n = p[i]; if (n === 0) st = { b: 0, d: 0, fg: null }; else if (n === 1) st.b = 1; else if (n === 2) st.d = 1; else if (n === 22) { st.b = 0; st.d = 0; } else if (n === 39) st.fg = null; else if (n >= 30 && n <= 37) st.fg = PAL(n - 30); else if (n >= 90 && n <= 97) st.fg = PAL(n - 90 + 8); else if (n === 38 && p[i + 1] === 5) { st.fg = PAL(p[i + 2]); i += 2; } else if (n === 48 && p[i + 1] === 5) { st.bg = PAL(p[i + 2]); i += 2; } else if (n === 49) st.bg = null; } };
    const put = (ch) => { const L = lines[row] || (lines[row] = []); L[col] = { c: ch, s: { ...st } }; col++; };
    const feed = (s) => { for (let i = 0; i < s.length; i++) { const ch = s[i]; if (ch === '\x1b' && s[i + 1] === '[') { let j = i + 2; while (j < s.length && !/[A-Za-z]/.test(s[j])) j++; const f = s[j], p = s.slice(i + 2, j).replace('?', '').split(';').filter((x) => x !== '').map(Number); i = j;
      if (f === 'm') sgr(p); else if (f === 'A') row = Math.max(0, row - (p[0] || 1)); else if (f === 'J') { if (!p.length || p[0] === 0) { lines[row] = (lines[row] || []).slice(0, col); lines.length = row + 1; } else { lines = [[]]; row = 0; col = 0; } } else if (f === 'H') { row = 0; col = 0; } else if (f === 'K') lines[row] = (lines[row] || []).slice(0, col); else if (f === 'G') col = Math.max(0, (p[0] || 1) - 1); }
      else if (ch === '\r') col = 0; else if (ch === '\n') { row++; col = 0; if (!lines[row]) lines[row] = []; } else if (ch >= ' ') put(ch); } };
    // layout
    const FS = 15, CW = 11.1, CH = 20.4, X0 = 40, Y0 = 62;
    g.font = `${FS}px "Cascadia Mono", Consolas, "Courier New", monospace`;
    const bar = (title) => { g.fillStyle = '#161b22'; g.fillRect(0, 0, 1280, 44); g.fillStyle = '#ff5f56'; g.beginPath(); g.arc(24, 22, 6, 0, 7); g.fill(); g.fillStyle = '#ffbd2e'; g.beginPath(); g.arc(44, 22, 6, 0, 7); g.fill(); g.fillStyle = '#27c93f'; g.beginPath(); g.arc(64, 22, 6, 0, 7); g.fill(); g.fillStyle = '#e6edf3'; g.font = '600 15px system-ui, sans-serif'; g.fillText(title, 90, 27); };
    const draw = (title) => {
      g.fillStyle = '#0d1117'; g.fillRect(0, 0, 1280, 760); bar(title);
      const start = Math.max(0, lines.length - ROWS);
      for (let r = start; r < lines.length; r++) {
        const L = lines[r] || []; const y = Y0 + (r - start) * CH;
        for (let c = 0; c < L.length; c++) { const x = L[c]; if (!x) continue; if (x.s.bg) { g.fillStyle = x.s.bg; g.fillRect(X0 + c * CW, y - CH + 5, CW + 0.5, CH); } }
        for (let c = 0; c < L.length; c++) { const x = L[c]; if (!x || x.c === ' ') continue; g.font = `${x.s.b ? '700 ' : ''}${FS}px "Cascadia Mono", Consolas, "Courier New", monospace`; g.globalAlpha = x.s.d ? 0.6 : 1; g.fillStyle = x.s.fg || '#e6edf3'; g.fillText(x.c, X0 + c * CW, y); }
      }
      g.globalAlpha = 1;
    };
    // pick a recording format this browser supports
    const types = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    const mime = types.find((t) => MediaRecorder.isTypeSupported(t));
    const stream = cv.captureStream(30); const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3_000_000 }); const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise((r) => { rec.onstop = r; });
    let title = 'PassBCH.cash in a terminal: play a Bitcoin Cash game while Claude Code is thinking';
    let raf = 0; const loop = () => { draw(title); raf = requestAnimationFrame(loop); }; loop();
    rec.start(500);
    await new Promise((r) => setTimeout(r, 1200));
    let prev = 0;
    for (const [t, s] of EVENTS) { const gap = Math.min(Math.max(0, t - prev), 1.4); prev = t; await new Promise((r) => setTimeout(r, gap * 1000)); feed(s); }
    await new Promise((r) => setTimeout(r, 3000));
    rec.stop(); await done; cancelAnimationFrame(raf);
    const blob = new Blob(chunks, { type: mime });
    const dataUrl = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
    return { mime, size: blob.size, dataUrl };
  }, EVENTS, COLS, ROWS);
  const ext = res.mime.startsWith('video/mp4') ? 'mp4' : 'webm';
  fs.writeFileSync(`docs/demo/terminal-demo.${ext}`, Buffer.from(res.dataUrl.split(',')[1], 'base64'));
  console.log('saved', ext, res.mime, (res.size / 1e6).toFixed(2) + ' MB');
  await b.close();
})();
