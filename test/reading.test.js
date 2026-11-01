import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { buildFacts } from '../docs/lib/calc.js';
import { generateReading, InputError, DEFAULT_MODEL } from '../lib/reading.js';

const facts = buildFacts({ birthDate: '1980-06-15', today: '2026-11-01' });
const condition = { energy: 4, sleep: 'ふつう', mood: '前向き', focus: '提案・商談', memo: '午後の商談' };
const jpeg = 'data:image/jpeg;base64,/9j/AAAA';
const png = 'data:image/png;base64,iVBORw0KGgo=';

const reading = { headline: 'h', mode: { name: '攻めの日' }, face: { observed: true, keyword: '穏やか' } };
const okResponse = (text) => ({ ok: true, json: async () => ({ content: [{ type: 'text', text }] }) });

test('顔写真・手相写真・テキストの順で Claude に渡す', async () => {
  const f = mock.method(globalThis, 'fetch', async () => okResponse('```json\n' + JSON.stringify(reading) + '\n```'));
  try {
    const r = await generateReading({ facts, condition, faceImage: jpeg, palmImage: png }, { apiKey: 'k' });
    assert.equal(r.source, 'claude');
    assert.equal(r.face.keyword, '穏やか');

    const [url, init] = f.mock.calls[0].arguments;
    assert.equal(url, 'https://api.anthropic.com/v1/messages');
    assert.equal(init.headers['x-api-key'], 'k');
    const body = JSON.parse(init.body);
    assert.equal(body.model, DEFAULT_MODEL);
    const kinds = body.messages[0].content.map((c) => c.type);
    assert.deepEqual(kinds, ['image', 'image', 'text']);
    assert.equal(body.messages[0].content[0].source.media_type, 'image/jpeg'); // 1枚目は顔
    assert.equal(body.messages[0].content[1].source.media_type, 'image/png'); // 2枚目は手相
    const text = body.messages[0].content[2].text;
    assert.match(text, /画像1は本人の顔写真/);
    assert.match(text, /画像2は手のひらの写真/);
    assert.match(text, /今日の調子: 4\/5/);
  } finally { f.mock.restore(); }
});

test('顔写真が無ければ画像を付けず、face は読まない指示を添える', async () => {
  const f = mock.method(globalThis, 'fetch', async () => okResponse(JSON.stringify(reading)));
  try {
    await generateReading({ facts, condition }, { apiKey: 'k', model: 'm', baseUrl: 'http://x' });
    const [url, init] = f.mock.calls[0].arguments;
    assert.equal(url, 'http://x/v1/messages');
    const body = JSON.parse(init.body);
    assert.equal(body.model, 'm');
    assert.deepEqual(body.messages[0].content.map((c) => c.type), ['text']);
    assert.match(body.messages[0].content[0].text, /顔写真はありません/);
  } finally { f.mock.restore(); }
});

test('画像の形式・サイズが不正なら API を呼ばずに 400 の InputError', async () => {
  const f = mock.method(globalThis, 'fetch', async () => okResponse('{}'));
  try {
    await assert.rejects(generateReading({ facts, condition, faceImage: 'data:text/html;base64,AAAA' }, { apiKey: 'k' }),
      (e) => e instanceof InputError && e.status === 400);
    await assert.rejects(generateReading({ facts, condition, faceImage: 'data:image/jpeg;base64,' + 'A'.repeat(1_600_000) }, { apiKey: 'k' }),
      (e) => e instanceof InputError && /大きすぎ/.test(e.message));
    assert.equal(f.mock.callCount(), 0);
  } finally { f.mock.restore(); }
});

test('API が失敗したらエラーにする(キーや画像を含めない)', async () => {
  const f = mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 529, text: async () => 'overloaded' }));
  try {
    await assert.rejects(generateReading({ facts, condition, faceImage: jpeg }, { apiKey: 'secret-key' }),
      (e) => /529/.test(e.message) && !/secret-key/.test(e.message) && !/AAAA/.test(e.message));
  } finally { f.mock.restore(); }
});

test('APIキーが無ければ簡易診断を返す(API は呼ばない)', async () => {
  const f = mock.method(globalThis, 'fetch', async () => okResponse('{}'));
  try {
    const r = await generateReading({ facts, condition, faceImage: jpeg });
    assert.equal(r.source, 'fallback');
    assert.equal(f.mock.callCount(), 0);
  } finally { f.mock.restore(); }
});
