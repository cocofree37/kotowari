import { fallbackReading } from '../docs/lib/fallback.js';

// 計算済みの事実 + 手相画像 + 悩みカテゴリから、Claude で占い文章を生成する

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

const SYSTEM = `あなたは経験豊富で温かみのある占い師です。与えられた「占術の計算結果」を根拠に、日本語で読み応えのある占い結果を書きます。
ルール:
- 計算結果に書かれていない占術データ(星の位置など)を捏造しない。星座・ライフパス・干支・日柱・時支・月齢・今日の日柱を具体的に引用して根拠を示す。
- 手相画像が添付されている場合のみ手相を読む。手のひらが写っていない/不鮮明なら palm.detected を false にし、他の palm 項目は空文字にする。
- 手相は線の長さ・深さ・形・途切れ・分岐など、画像から実際に見える特徴に触れて書く。見えない線は見えないと書く。
- 健康・医療・投資に関する断定はしない。前向きで、今日から実行できる具体的な行動アドバイスにする。
- 文字数は指定の範囲を守り、短くまとめすぎない。段落は「\n\n」で区切ってよい。
- 出力は指定のJSONのみ。前後に説明文やコードフェンスを付けない。

JSONスキーマ:
{
  "headline": "今日の一言(20字以内)",
  "overall": "総合運。今日の日柱と月齢を絡めて(300〜400字)",
  "personality": "生まれ持った性質。星座・ライフパス・干支・日柱から(250〜350字)",
  "concern": "選ばれた悩みカテゴリへの深掘りアドバイス(350〜450字)",
  "fortunes": {
    "love": { "score": 1-5, "text": "恋愛運(120〜180字)" },
    "work": { "score": 1-5, "text": "仕事運(120〜180字)" },
    "money": { "score": 1-5, "text": "金運(120〜180字)" }
  },
  "palm": {
    "detected": true/false,
    "summary": "手全体の印象と総評(100〜150字)",
    "life": "生命線の所見(100〜150字)",
    "heart": "感情線の所見(100〜150字)",
    "head": "頭脳線の所見(100〜150字)",
    "fate": "運命線の所見(100〜150字)。見えなければその旨"
  },
  "timeline": {
    "morning": "朝の過ごし方(50〜80字)",
    "afternoon": "昼の過ごし方(50〜80字)",
    "night": "夜の過ごし方(50〜80字)"
  },
  "actions": ["今日の行動1(40〜80字)", "行動2", "行動3"],
  "compatibility": "相性の良い人・タイプ(100〜150字)",
  "caution": "今日気をつけたいこと(80〜120字)",
  "lucky": { "color": "色", "item": "物", "action": "行動", "number": "数字", "direction": "方角" }
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
    body: JSON.stringify({ model: MODEL, max_tokens: 6000, system: SYSTEM, messages: [{ role: 'user', content }] }),
  });
  if (!res.ok) throw new Error(`Claude API エラー (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
  return { ...extractJson(text), source: 'claude' };
}
