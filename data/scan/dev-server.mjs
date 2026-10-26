// 로컬 확인용 서버: public/ 정적 파일 + api/*.js 함수(실제 talent-link DB · Claude 호출).
// 로그인은 시연 계정(로그인 화면 자동 입력값)을 쓴다. 실행: node data/scan/dev-server.mjs [포트]
import './localenv.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

process.env.HR_SESSION_SECRET = 'local-dev';
process.env.HR_ID = 'daeheonjjang'; // 로그인 화면 시연 자동 입력값과 같게
process.env.HR_PASSWORD = 'dh0909';
const ROOT = path.resolve(import.meta.dirname, '../..');
const PUB = path.join(ROOT, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  const m = /^\/api\/([a-z-]+)$/.exec(url.pathname);
  if (m) {
    const file = path.join(ROOT, 'api', m[1] + '.js');
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end() }
    const mod = await import(pathToFileURL(file).href);
    const handler = mod[req.method];
    if (!handler) { res.writeHead(405); return res.end() }
    const body = req.method === 'GET' ? undefined : await new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => r(Buffer.concat(c))) });
    const out = await handler(new Request('http://local' + req.url, { method: req.method, headers: req.headers, body }));
    res.writeHead(out.status, Object.fromEntries(out.headers));
    return res.end(Buffer.from(await out.arrayBuffer()));
  }
  const p = path.join(PUB, decodeURIComponent(url.pathname).replace(/^\/$/, '/index.html'));
  if (!p.startsWith(PUB) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end() }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
server.listen(Number(process.argv[2]) || 4173, () => console.log('http://127.0.0.1:' + server.address().port));
