import { buildFacts } from './lib/calc.js';
import { fallbackReading } from './lib/fallback.js';
import { ENERGY, SLEEP, MOOD, FOCUS, normalizeCondition } from './lib/condition.js';

const $ = (id) => document.getElementById(id);
const form = $('form');

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* 保存できなくても動作に影響なし */ } },
};

function todayLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---- 入力UI(選択肢は lib/condition.js が正) ----
function radioGroup(box, name, items, { energy = false } = {}) {
  for (const it of items) {
    const value = energy ? it.v : it;
    const label = document.createElement('label');
    const input = Object.assign(document.createElement('input'), { type: 'radio', name, value });
    const span = document.createElement('span');
    if (energy) {
      const b = document.createElement('b'); b.textContent = String(it.v);
      span.append(b, document.createTextNode(it.label));
    } else {
      span.textContent = it;
    }
    label.append(input, span);
    box.append(label);
  }
}
radioGroup($('energyBox'), 'energy', ENERGY, { energy: true });
radioGroup($('sleepBox'), 'sleep', SLEEP);
radioGroup($('moodBox'), 'mood', MOOD);
radioGroup($('focusBox'), 'focus', FOCUS);

const saved = store.get('kotowari.birth');
if (saved) {
  try {
    const { date, time } = JSON.parse(saved);
    $('birthDate').value = date || '';
    $('birthTime').value = time || '';
  } catch { /* 壊れた値は無視 */ }
}

const picked = (name) => form.querySelector(`input[name="${name}"]:checked`)?.value;

// ---- 写真: 長辺1024pxに縮小してJPEG化 ----
function scaleToJpeg(source, w, h) {
  const scale = Math.min(1, 1024 / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

function resizeFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(scaleToJpeg(img, img.width, img.height)); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('画像を読み込めませんでした')); };
    img.src = url;
  });
}

// ---- カメラ(顔・手相で共用) ----
const canStream = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
let stream = null;
let onShot = null;

function stopStream() {
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
  $('camVideo').srcObject = null;
}

async function openCamera({ facing, mirror, hint }, shot, fallbackInput) {
  // getUserMedia が使えない環境は、端末のカメラアプリ起動にフォールバック
  if (!canStream) { fallbackInput.click(); return; }
  onShot = shot;
  $('cam').classList.toggle('mirror', mirror);
  $('camHint').textContent = hint;
  $('camError').textContent = '';
  $('camShoot').disabled = false;
  $('camDialog').showModal();
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 1280 } },
      audio: false,
    });
    $('camVideo').srcObject = stream;
    await $('camVideo').play();
  } catch (err) {
    $('camShoot').disabled = true;
    $('camError').textContent =
      err.name === 'NotAllowedError' ? 'カメラの使用が許可されていません。ブラウザの設定で許可するか、「ファイルを選択」をご利用ください。'
      : err.name === 'NotFoundError' ? 'カメラが見つかりませんでした。「ファイルを選択」をご利用ください。'
      : 'カメラを起動できませんでした。「ファイルを選択」をご利用ください。';
  }
}

$('camShoot').addEventListener('click', () => {
  const v = $('camVideo');
  if (!v.videoWidth) { $('camError').textContent = 'カメラの準備中です。少し待ってからもう一度お試しください。'; return; }
  onShot(scaleToJpeg(v, v.videoWidth, v.videoHeight));
  $('camDialog').close();
});
$('camClose').addEventListener('click', () => $('camDialog').close());
$('camDialog').addEventListener('close', stopStream);

function photoSlot(name, camOptions) {
  const slot = { image: null };
  const set = (dataUrl) => {
    slot.image = dataUrl;
    $(`${name}Preview`).src = dataUrl || '';
    $(`${name}Preview`).style.display = dataUrl ? 'block' : 'none';
    $(`${name}Clear`).hidden = !dataUrl;
  };
  const onFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    $('error').textContent = '';
    if (!file) return;
    try { set(await resizeFile(file)); } catch (err) { $('error').textContent = err.message; }
  };
  $(`${name}File`).addEventListener('change', onFile);
  $(`${name}Capture`).addEventListener('change', onFile);
  $(`${name}FileBtn`).addEventListener('click', () => $(`${name}File`).click());
  $(`${name}Clear`).addEventListener('click', () => set(null));
  $(`${name}Cam`).addEventListener('click', () => openCamera(camOptions, set, $(`${name}Capture`)));
  return slot;
}

const face = photoSlot('face', { facing: 'user', mirror: true, hint: '枠の中に顔が入るようにして、明るい場所で撮影してください。' });
const palm = photoSlot('palm', { facing: 'environment', mirror: false, hint: '枠の中に手のひら全体が入るようにして、線がはっきり見える明るさで撮影してください。' });

// ---- 結果表示(すべて textContent で描画) ----
const el = (tag, cls, txt) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
};
const paragraphs = (text) => String(text ?? '').split(/\n+/).filter(Boolean).map((t) => el('p', null, t));

function card(title, children, cls) {
  const c = el('div', cls ? `card ${cls}` : 'card');
  if (title) c.append(el('h2', null, title));
  c.append(...children);
  return c;
}

// rows: 見出しをタグ風に縦積み(長文向け) / short: 見出しと値を横並びの罫線表(短い値向け)
function defList(pairs, kind = 'rows') {
  const dl = el('dl', kind);
  for (const [term, desc] of pairs) {
    if (!desc) continue;
    const dt = el('dt');
    if (kind === 'rows') dt.append(el('span', 'tag', term)); else dt.textContent = term;
    dl.append(dt, el('dd', null, desc));
  }
  return dl;
}

const level = (n) => Math.max(1, Math.min(5, Number(n) || 3));

function meters(m = {}) {
  const box = el('div', 'meters');
  for (const [label, key] of [['集中力', 'focus'], ['対人力', 'communication'], ['決断力', 'decision']]) {
    const v = level(m[key]);
    const row = el('div', 'meter');
    const bar = el('div', 'bar');
    const fill = el('i');
    fill.style.width = `${v * 20}%`;
    bar.append(fill);
    row.append(el('span', null, label), bar, el('span', 'v', `${v}/5`));
    box.append(row);
  }
  return box;
}

function summaryText(r, facts) {
  const lines = [`【今日のやる気ナビ ${facts.today.date}】`, `${r.mode?.name || ''}｜${r.headline}`, `合言葉: ${r.mantra || ''}`, '', '今日のミッション'];
  (r.missions || []).forEach((m, i) => lines.push(`${i + 1}. ${m.title}`));
  if (r.lucky?.time) lines.push('', `勝負時間帯: ${r.lucky.time}`);
  return lines.join('\n');
}

function render({ facts, reading: r }) {
  const out = $('result');
  out.replaceChildren();

  // 診断の核(モード・合言葉): 黒いパネルに縦書き
  const hero = el('div', 'card hero');
  const wd = ['日', '月', '火', '水', '木', '金', '土'][new Date(`${facts.today.date}T00:00:00`).getDay()];
  hero.append(el('p', 'date', `/ ${facts.today.date.replaceAll('-', '.')} (${wd})`));
  const vert = el('div', 'vert');
  vert.append(el('p', 'vmode', r.mode?.name));
  if (r.mantra) vert.append(el('p', 'vmantra', r.mantra));
  hero.append(vert, el('p', 'headline', r.headline), el('p', 'why', r.mode?.reason));
  out.append(hero);

  out.append(card('今日のコンディション', [meters(r.meter)]));
  out.append(card('今日の応援メッセージ', paragraphs(r.boost)));

  if (r.face?.observed) {
    out.append(card('今日の表情', [...paragraphs(r.face.impression), ...paragraphs(r.face.tip)]));
  } else if (face.image) {
    out.append(card('今日の表情', paragraphs(
      r.source === 'fallback' ? '表情の読み取りはAI連携(サーバー版)で利用できます。'
      : '顔を読み取れませんでした。明るい場所で、顔全体が写るように撮り直してください。')));
  }

  out.append(card('今日の運気の流れ', paragraphs(r.background)));

  if (r.schedule) {
    out.append(card('今日の時間の使い方', [defList([['午前', r.schedule.morning], ['午後', r.schedule.afternoon], ['夕方〜夜', r.schedule.evening]])]));
  }

  if (Array.isArray(r.missions) && r.missions.length) {
    const ol = el('ol', 'missions');
    for (const m of r.missions) {
      const li = el('li');
      li.append(el('b', null, m.title), el('span', null, m.why));
      ol.append(li);
    }
    const c = card('今日のミッション', [ol]);
    const copy = el('button', 'ghost copy', 'ミッションをコピー');
    copy.type = 'button';
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(summaryText(r, facts)); copy.textContent = 'コピーしました'; }
      catch { copy.textContent = 'コピーできませんでした'; }
    });
    c.append(copy);
    out.append(c);
  }

  out.append(card('チーム・取引先とのコミュニケーション', paragraphs(r.communication)));
  out.append(card('今日の落とし穴とリセット法', [defList([['落とし穴', r.pitfall], ['リセット法', r.reset]])]));

  const l = r.lucky || {};
  out.append(card('今日のラッキー', [defList([['勝負時間帯', l.time], ['ラッキーカラー', l.color], ['ラッキーアイテム', l.item], ['吉方位', l.direction]], 'short')]));

  const p = r.palm;
  if (p && p.detected) {
    out.append(card('手相', [...paragraphs(p.summary), defList([['生命線', p.life], ['感情線', p.heart], ['頭脳線', p.head], ['運命線', p.fate]])]));
  } else if (palm.image) {
    out.append(card('手相', paragraphs(
      r.source === 'fallback' ? '手相解析はAI連携(サーバー版)で利用できます。'
      : '手のひらを読み取れませんでした。明るい場所で、手のひら全体が写るように撮り直してください。')));
  }

  const rel = facts.relation;
  const items = [
    ['太陽星座', facts.sunSign], ['ライフパス', String(facts.lifePath)],
    ['干支', `${facts.eto.branch}(${facts.eto.animal})`], ['あなたの日柱', `${facts.dayPillar.name}(${rel.birthElement})`],
    ['今日の日柱', `${facts.today.dayPillar.name}(${rel.todayElement})`], ['今日の月', `${facts.today.moon.phase}(${facts.today.moon.age})`],
  ];
  const grid = el('div', 'facts');
  for (const [k, v] of items) {
    const d = el('div');
    d.append(el('b', null, k), document.createTextNode(v));
    grid.append(d);
  }
  out.append(card('算出データ', [grid]));

  out.style.display = 'block';
  out.scrollIntoView({ behavior: 'smooth' });
}

// ---- 診断: サーバー(/api/reading)があれば Claude、無ければ(GitHub Pages 等)ブラウザ内で組み立て ----
async function requestReading(payload) {
  let res;
  try {
    res = await fetch('api/reading', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    res = null;
  }
  if (res && (res.headers.get('content-type') || '').includes('application/json')) {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '診断に失敗しました');
    return data;
  }
  const facts = buildFacts({ birthDate: payload.birthDate, birthTime: payload.birthTime, today: payload.today });
  $('mode').textContent = '静的公開版のため、AIによる文章生成と顔・手相の読み取りは利用できません(入力内容と算出データに基づく診断です)。';
  return { facts, reading: fallbackReading(facts, payload.condition, '静的公開版の簡易表示です') };
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('error');
  err.textContent = '';
  $('mode').textContent = '';

  let condition;
  try {
    condition = normalizeCondition({
      energy: picked('energy'), sleep: picked('sleep'), mood: picked('mood'), focus: picked('focus'), memo: $('memo').value,
    });
  } catch (ex) { err.textContent = ex.message; return; }
  if (!$('birthDate').value) { err.textContent = '生年月日を入力してください'; return; }

  store.set('kotowari.birth', JSON.stringify({ date: $('birthDate').value, time: $('birthTime').value }));

  const btn = $('submit');
  btn.disabled = true;
  btn.textContent = '診断しています…(30秒ほどかかることがあります)';
  try {
    render(await requestReading({
      birthDate: $('birthDate').value,
      birthTime: $('birthTime').value || null,
      condition,
      faceImage: face.image,
      palmImage: palm.image,
      today: todayLocal(),
    }));
  } catch (ex) {
    err.textContent = ex.message;
  } finally {
    btn.disabled = false;
    btn.textContent = '今日のスイッチを入れる';
  }
});
