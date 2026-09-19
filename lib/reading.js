import { fallbackReading } from '../docs/lib/fallback.js';

// 計算済みの事実 + 手相画像 + 悩みカテゴリから、Claude で占い文章を生成する

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

const SYSTEM = `あなたは経験豊富で温かみのある占い師です。与えられた「占術の計算結果」を根拠に、日本語で占い結果を書きます。
ルール:
- 計算結果に書かれていない占術データ(星の位置など)を捏造しない。与えられた事実だけを根拠にする。
- 手相画像が添付されている場合のみ手相を読む。手のひらが写っていない/不鮮明なら palm.detected を false にする。
- 健康・医療・投資に関する断定はしない。前向きで具体的な行動アドバイスにする。
- 出力は指定のJSONのみ。前後に説明文やコードフェンスを付けない。

JSONスキーマ:
{
  "headline": "今日の一言(20字以内)",
  "overall": "総合運の文章(120〜180字)",
  "concern": "選ばれた悩みカテゴリへのアドバイス(120〜180字)",
  "palm": {
    "detected": true/false,
    "life": "生命線の所見(40〜70字)",
    "heart": "感情線の所見(40〜70字)",
    "head": "頭脳線の所見(40〜70字)",
    "fate": "運命線の所見(40〜70字)。見えなければその旨"
  },
  "lucky": { "color": "色", "item": "物", "action": "今日の行動" },
  "scores": { "love": 1-5, "work": 1-5, "money": 1-5 }
}`;

function factsText(facts, concern) {
  const f = facts;
  return [
    `悩みカテゴリ: ${concern}`,
    `生年月日: ${f.birth.date}${f.birth.time ? ' ' + f.birth.time : '(出生時刻不明)'}`,
    `太陽星座: ${f.sunSign}`,
    `数秘術ライフパスナンバー: ${f.lifePath}`,
    `干支: ${f.eto.branch}(${f.eto.animal})年生まれ`,
    `日柱(四柱推命): ${f.dayPillar.name}`,
    f.hourBranch ? `時支: ${f.hourBranch}` : '時柱: 不明',
    `今日: ${f.today.date}(${f.today.weekday})`,
    `今日の日柱: ${f.today.dayPillar.name}`,
    `今日の月齢: ${f.today.moon.age}(${f.today.moon.phase})`,
  ].join('\n');
}

function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('AIの応答を解釈できませんでした');
  return JSON.parse(text.slice(start, end + 1));
}

export async function generateReading({ facts, concern, palmImage }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallbackReading(facts, concern, palmImage, 'ANTHROPIC_API_KEY未設定のため簡易表示です');

  const content = [];
  if (palmImage) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(palmImage);
    if (!m) throw new Error('画像形式は JPEG / PNG / WebP に対応しています');
    content.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } });
  }
  content.push({ type: 'text', text: `【占術の計算結果】\n${factsText(facts, concern)}\n\n${palmImage ? '添付画像は手のひらです。' : '手相画像はありません(palm.detected は false)。'}` });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1500, system: SYSTEM, messages: [{ role: 'user', content }] }),
  });
  if (!res.ok) throw new Error(`Claude API エラー (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
  return { ...extractJson(text), source: 'claude' };
}
