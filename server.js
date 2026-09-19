import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFacts } from './docs/lib/calc.js';
import { generateReading } from './lib/reading.js';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'docs');
const PORT = Number(process.env.PORT) || 3000;
const MAX_BODY = 6 * 1024 * 1024;
const CONCERNS = ['恋愛', '仕事', '金運', '人間関係'];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('データが大きすぎます')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function handleReading(req, res) {
  try {
    const { birthDate, birthTime, concern, palmImage, today } = JSON.parse(await readBody(req));
    if (!CONCERNS.includes(concern)) return json(res, 400, { error: '悩みカテゴリが不正です' });
    const facts = buildFacts({ birthDate, birthTime, today });
    const reading = await generateReading({ facts, concern, palmImage });
    json(res, 200, { facts, reading });
  } catch (e) {
    console.error(e);
    json(res, 500, { error: e.message || '占いに失敗しました' });
  }
}

http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/reading') return handleReading(req, res);
  if (req.method !== 'GET') return json(res, 405, { error: 'Method Not Allowed' });

  const path = req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0];
  const file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT)) return json(res, 403, { error: 'Forbidden' });
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    json(res, 404, { error: 'Not Found' });
  }
}).listen(PORT, () => {
  console.log(`占いアプリ: http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) console.log('ANTHROPIC_API_KEY 未設定: 簡易結果で動作します');
});
