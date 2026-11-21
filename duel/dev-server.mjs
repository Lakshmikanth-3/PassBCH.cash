// Local dev server: the same API handler Vercel runs, on http://localhost:8787
import http from 'node:http';
import handler from '../api/duel.mjs';
const port = Number(process.env.PORT ?? 8787);
http.createServer((req, res) => {
  if (req.url.startsWith('/api/duel')) return handler(req, res);
  res.statusCode = 404; res.end('not found');
}).listen(port, () => console.log(`duel api on http://localhost:${port}`));
