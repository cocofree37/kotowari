import { buildFacts } from './lib/calc.js';
import { fallbackReading } from './lib/fallback.js';

const $ = (id) => document.getElementById(id);
const form = $('form');
let palmImage = null;

function todayLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 送信量削減のため長辺1024pxに縮小してJPEG化
function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('画像を読み込めませんでした')); };
    img.src = url;
  });
}

$('palm').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  $('error').textContent = '';
  if (!file) { palmImage = null; $('preview').style.display = 'none'; return; }
  try {
    palmImage = await resizeImage(file);
    $('preview').src = palmImage;
    $('preview').style.display = 'block';
  } catch (err) {
    palmImage = null;
    $('error').textContent = err.message;
  }
});

function text(el, value) { el.textContent = value ?? ''; }

function addDef(dl, term, desc) {
  if (!desc) return;
  const dt = document.createElement('dt'); dt.textContent = term;
  const dd = document.createElement('dd'); dd.textContent = desc;
  dl.append(dt, dd);
}

function render({ facts, reading }) {
  text($('headline'), reading.headline);
  text($('overall'), reading.overall);
  text($('concernTitle'), `${form.concern.value}について`);
  text($('concern'), reading.concern);

  const palmBody = $('palmBody');
  palmBody.replaceChildren();
  const p = reading.palm;
  if (p && p.detected) {
    addDef(palmBody, '生命線', p.life); addDef(palmBody, '感情線', p.heart);
    addDef(palmBody, '頭脳線', p.head); addDef(palmBody, '運命線', p.fate);
  } else {
    addDef(palmBody, '', reading.source === 'fallback' ? '手相解析はAI連携(サーバー版)で利用できます。' : palmImage ? '手のひらを読み取れませんでした。明るい場所で、手のひら全体が写るように撮り直してください。' : '手相の写真を追加すると、手相も占えます。');
  }

  const lucky = $('lucky');
  lucky.replaceChildren();
  addDef(lucky, 'ラッキーカラー', reading.lucky?.color);
  addDef(lucky, 'ラッキーアイテム', reading.lucky?.item);
  addDef(lucky, '今日の行動', reading.lucky?.action);

  const scores = $('scores');
  scores.replaceChildren();
  for (const [label, key] of [['恋愛', 'love'], ['仕事', 'work'], ['金運', 'money']]) {
    const n = Math.max(1, Math.min(5, Number(reading.scores?.[key]) || 3));
    const box = document.createElement('div');
    const l = document.createElement('div'); l.textContent = label;
    const s = document.createElement('div'); s.className = 'stars'; s.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
    box.append(l, s);
    scores.append(box);
  }

  const items = [
    ['太陽星座', facts.sunSign], ['ライフパス', String(facts.lifePath)],
    ['干支', `${facts.eto.branch}(${facts.eto.animal})`], ['日柱', facts.dayPillar.name],
    ['時支', facts.hourBranch || '不明'], ['今日の月', `${facts.today.moon.phase}(${facts.today.moon.age})`],
  ];
  const box = $('facts');
  box.replaceChildren();
  for (const [k, v] of items) {
    const d = document.createElement('div');
    const b = document.createElement('b'); b.textContent = k;
    d.append(b, document.createTextNode(v));
    box.append(d);
  }

  $('result').style.display = 'block';
  $('result').scrollIntoView({ behavior: 'smooth' });
}

// サーバー(/api/reading)があれば Claude の結果を、無ければ(GitHub Pages 等)ブラウザ内の簡易結果を返す
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
  const isApi = res && (res.headers.get('content-type') || '').includes('application/json');
  if (isApi) {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '占いに失敗しました');
    return data;
  }
  const facts = buildFacts({ birthDate: payload.birthDate, birthTime: payload.birthTime, today: payload.today });
  $('mode').textContent = '静的公開版のため、AIによる文章生成と手相解析は利用できません(算出データに基づく簡易結果です)。';
  return { facts, reading: fallbackReading(facts, payload.concern, null, '静的公開版の簡易表示です') };
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('error');
  err.textContent = '';
  if (!$('birthDate').value) { err.textContent = '生年月日を入力してください'; return; }

  const btn = $('submit');
  btn.disabled = true;
  btn.textContent = '星を読んでいます…';
  try {
    const payload = {
      birthDate: $('birthDate').value,
      birthTime: $('birthTime').value || null,
      concern: form.concern.value,
      palmImage,
      today: todayLocal(),
    };
    $('mode').textContent = '';
    const data = await requestReading(payload);
    render(data);
  } catch (ex) {
    err.textContent = ex.message;
  } finally {
    btn.disabled = false;
    btn.textContent = '占う';
  }
});
