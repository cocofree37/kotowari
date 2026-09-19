import { buildFacts } from './lib/calc.js';
import { fallbackReading } from './lib/fallback.js';

const $ = (id) => document.getElementById(id);
const form = $('form');
let palmImage = null;
let stream = null;

function todayLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---- 手相画像: 長辺1024pxに縮小してJPEG化 ----
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

function setPalm(dataUrl) {
  palmImage = dataUrl;
  $('preview').src = dataUrl || '';
  $('preview').style.display = dataUrl ? 'block' : 'none';
  $('palmClear').hidden = !dataUrl;
}

async function onFile(e) {
  const file = e.target.files[0];
  e.target.value = '';
  $('error').textContent = '';
  if (!file) return;
  try { setPalm(await resizeFile(file)); } catch (err) { $('error').textContent = err.message; }
}

$('palmFile').addEventListener('change', onFile);
$('palmCapture').addEventListener('change', onFile);
$('fileOpen').addEventListener('click', () => $('palmFile').click());
$('palmClear').addEventListener('click', () => setPalm(null));

// ---- カメラ撮影 ----
const canStream = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

function stopStream() {
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
  $('camVideo').srcObject = null;
}

$('camOpen').addEventListener('click', async () => {
  // getUserMedia が使えない環境(古いブラウザ等)は、端末のカメラアプリ起動にフォールバック
  if (!canStream) { $('palmCapture').click(); return; }
  $('camError').textContent = '';
  $('camShoot').disabled = false;
  $('camDialog').showModal();
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } },
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
});

$('camShoot').addEventListener('click', () => {
  const v = $('camVideo');
  if (!v.videoWidth) { $('camError').textContent = 'カメラの準備中です。少し待ってからもう一度お試しください。'; return; }
  setPalm(scaleToJpeg(v, v.videoWidth, v.videoHeight));
  $('camDialog').close();
});
$('camClose').addEventListener('click', () => $('camDialog').close());
$('camDialog').addEventListener('close', stopStream);

// ---- 結果表示(すべて textContent で描画) ----
const el = (tag, cls, txt) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
};

function paragraphs(text) {
  return String(text ?? '').split(/\n{2,}|\n/).filter(Boolean).map((t) => el('p', null, t));
}

function card(title, children) {
  const c = el('div', 'card');
  if (title) c.append(el('h2', null, title));
  c.append(...children);
  return c;
}

function defList(pairs) {
  const dl = el('dl');
  for (const [term, desc, extra] of pairs) {
    if (!desc) continue;
    const dt = el('dt', null, term);
    if (extra) dt.append(el('span', 'stars', extra));
    dl.append(dt, el('dd', null, desc));
  }
  return dl;
}

const stars = (n) => {
  const v = Math.max(1, Math.min(5, Number(n) || 3));
  return '★'.repeat(v) + '☆'.repeat(5 - v);
};

function render({ facts, reading: r }) {
  const out = $('result');
  out.replaceChildren();

  const head = el('div', 'card');
  head.append(el('p', 'headline', r.headline), ...paragraphs(r.overall));
  out.append(head);

  if (r.personality) out.append(card('あなたの本質', paragraphs(r.personality)));
  out.append(card(`${form.concern.value}について`, paragraphs(r.concern)));

  const f = r.fortunes || {};
  out.append(card('運勢', [defList([
    ['恋愛運', f.love?.text, stars(f.love?.score)],
    ['仕事運', f.work?.text, stars(f.work?.score)],
    ['金運', f.money?.text, stars(f.money?.score)],
  ])]));

  const p = r.palm;
  if (p && p.detected) {
    out.append(card('手相', [
      ...paragraphs(p.summary),
      defList([['生命線', p.life], ['感情線', p.heart], ['頭脳線', p.head], ['運命線', p.fate]]),
    ]));
  } else {
    out.append(card('手相', paragraphs(
      r.source === 'fallback' ? '手相解析はAI連携(サーバー版)で利用できます。'
      : palmImage ? '手のひらを読み取れませんでした。明るい場所で、手のひら全体が写るように撮り直してください。'
      : '手相の写真を追加すると、手相も占えます。')));
  }

  if (r.timeline) {
    out.append(card('今日の過ごし方', [defList([
      ['朝', r.timeline.morning], ['昼', r.timeline.afternoon], ['夜', r.timeline.night],
    ])]));
  }
  if (Array.isArray(r.actions) && r.actions.length) {
    const ol = el('ol');
    r.actions.forEach((a) => ol.append(el('li', null, a)));
    out.append(card('今日のアクション', [ol]));
  }
  if (r.compatibility) out.append(card('相性', paragraphs(r.compatibility)));
  if (r.caution) out.append(card('気をつけたいこと', paragraphs(r.caution)));

  const l = r.lucky || {};
  out.append(card('ラッキー', [defList([
    ['ラッキーカラー', l.color], ['ラッキーアイテム', l.item], ['ラッキーナンバー', l.number],
    ['吉方位', l.direction], ['開運アクション', l.action],
  ])]));

  const items = [
    ['太陽星座', facts.sunSign], ['ライフパス', String(facts.lifePath)],
    ['干支', `${facts.eto.branch}(${facts.eto.animal})`], ['日柱', facts.dayPillar.name],
    ['時支', facts.hourBranch || '不明'], ['今日の日柱', facts.today.dayPillar.name],
    ['今日の月', `${facts.today.moon.phase}(${facts.today.moon.age})`],
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

// ---- 占う: サーバー(/api/reading)があれば Claude、無ければ(GitHub Pages 等)ブラウザ内の読み物 ----
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
    if (!res.ok) throw new Error(data.error || '占いに失敗しました');
    return data;
  }
  const facts = buildFacts({ birthDate: payload.birthDate, birthTime: payload.birthTime, today: payload.today });
  $('mode').textContent = '静的公開版のため、AIによる文章生成と手相解析は利用できません(算出データに基づく読み物です)。';
  return { facts, reading: fallbackReading(facts, payload.concern, null, '静的公開版の簡易表示です') };
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('error');
  err.textContent = '';
  $('mode').textContent = '';
  if (!$('birthDate').value) { err.textContent = '生年月日を入力してください'; return; }

  const btn = $('submit');
  btn.disabled = true;
  btn.textContent = '星を読んでいます…(30秒ほどかかることがあります)';
  try {
    render(await requestReading({
      birthDate: $('birthDate').value,
      birthTime: $('birthTime').value || null,
      concern: form.concern.value,
      palmImage,
      today: todayLocal(),
    }));
  } catch (ex) {
    err.textContent = ex.message;
  } finally {
    btn.disabled = false;
    btn.textContent = '占う';
  }
});
