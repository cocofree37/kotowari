// kotowari の Worker。APIキーはここ(Cloudflare の secret)だけに置き、画面からの依頼を Claude に中継する。
// 診断の中身(プロンプト・占術計算)は画面・ローカルサーバーと共有する lib/ と docs/lib/ を使う。
// 顔写真・手相写真は Claude への送信にだけ使い、保存もログ出力もしない。
import { buildFacts } from '../../docs/lib/calc.js';
import { normalizeCondition } from '../../docs/lib/condition.js';
import { generateReading, InputError } from '../../lib/reading.js';

const ALLOWED_ORIGINS = ['https://cocofree37.github.io'];
// ローカル確認用(開発中の画面)。本番の許可は上の1つだけ
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;
const MAX_BODY_BYTES = 4 * 1024 * 1024;

const isAllowed = (origin) => ALLOWED_ORIGINS.includes(origin) || LOCAL_ORIGIN.test(origin);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': isAllowed(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function jsonResponse(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...corsHeaders(origin) },
  });
}

async function readJson(request) {
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) throw new HttpError(413, '画像が大きすぎます');
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new HttpError(413, '画像が大きすぎます');
  try { return JSON.parse(text); } catch { throw new HttpError(400, '不正なリクエストです'); }
}

async function handle(request, env, origin) {
  // CORS はブラウザしか縛らないので、許可されたサイト以外からの呼び出しは受け付けない
  if (!isAllowed(origin)) throw new HttpError(403, 'このサイトからは利用できません');
  if (!env.ANTHROPIC_API_KEY) throw new HttpError(500, 'サーバー設定が完了していません');

  // 診断は画像つきで重いので、同じIPから1分あたり3回まで(費用の暴走防止)
  if (env.LIMITER) {
    const { success } = await env.LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' });
    if (!success) throw new HttpError(429, '短時間に多く実行されました。1分ほど待ってから再度お試しください');
  }

  const { birthDate, birthTime, condition, faceImage, palmImage, today } = await readJson(request);
  let facts, cond;
  try { facts = buildFacts({ birthDate, birthTime, today }); cond = normalizeCondition(condition); } catch (e) { throw new InputError(e.message); }

  const reading = await generateReading(
    { facts, condition: cond, faceImage, palmImage },
    { apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL || undefined, baseUrl: env.ANTHROPIC_BASE_URL || undefined },
  );
  return { facts, reading };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(origin) });
    if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, origin);

    try {
      return jsonResponse(await handle(request, env, origin), 200, origin);
    } catch (e) {
      if (e instanceof HttpError || e instanceof InputError) return jsonResponse({ error: e.message }, e.status, origin);
      // 本文(写真)は出力しない。エラーの種類だけ記録する
      console.error('Unexpected error:', e?.message?.slice(0, 200));
      return jsonResponse({ error: '診断に失敗しました。時間をおいてもう一度お試しください' }, 500, origin);
    }
  },
};
