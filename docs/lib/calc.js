// 占術の「事実」を計算するモジュール(生年月日・出生時刻・今日の日付から決定的に求める)

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const ETO_ANIMALS = ['ネズミ', 'ウシ', 'トラ', 'ウサギ', 'タツ', 'ヘビ', 'ウマ', 'ヒツジ', 'サル', 'トリ', 'イヌ', 'イノシシ'];

// [星座, 開始月, 開始日] 日付昇順。1/1〜1/19 は前年末から続く山羊座
const SIGNS = [
  ['水瓶座', 1, 20], ['魚座', 2, 19], ['牡羊座', 3, 21], ['牡牛座', 4, 20],
  ['双子座', 5, 21], ['蟹座', 6, 22], ['獅子座', 7, 23], ['乙女座', 8, 23],
  ['天秤座', 9, 23], ['蠍座', 10, 24], ['射手座', 11, 23], ['山羊座', 12, 22],
];

const MOON_PHASES = ['新月', '三日月', '上弦の月', '十三夜', '満月', '十八夜', '下弦の月', '二十六夜'];

function julianDayNumber(y, m, d) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

// 日柱(60干支)。2000-01-01 = 戊午(index 54) で検証済み
export function dayPillar(y, m, d) {
  const idx = (((julianDayNumber(y, m, d) - 11) % 60) + 60) % 60;
  return { idx, name: STEMS[idx % 10] + BRANCHES[idx % 12], stem: STEMS[idx % 10], branch: BRANCHES[idx % 12] };
}

export function sunSign(m, d) {
  // 各星座の開始日を過ぎていればその星座、そうでなければ前の星座
  for (let i = SIGNS.length - 1; i >= 0; i--) {
    const [name, sm, sd] = SIGNS[i];
    if (m > sm || (m === sm && d >= sd)) return name;
  }
  return '山羊座';
}

function reduceNumber(n) {
  while (n > 9 && n !== 11 && n !== 22 && n !== 33) {
    n = String(n).split('').reduce((s, c) => s + Number(c), 0);
  }
  return n;
}

export function lifePathNumber(y, m, d) {
  const digits = `${y}${m}${d}`.split('').reduce((s, c) => s + Number(c), 0);
  return reduceNumber(digits);
}

// 立春(2/4頃)前は前年の干支として扱う簡易判定
export function etoOfYear(y, m, d) {
  const yy = m < 2 || (m === 2 && d < 4) ? y - 1 : y;
  const i = (((yy - 4) % 12) + 12) % 12;
  return { branch: BRANCHES[i], animal: ETO_ANIMALS[i] };
}

export function hourBranch(hhmm) {
  if (!hhmm) return null;
  const h = Number(hhmm.split(':')[0]);
  if (Number.isNaN(h)) return null;
  return BRANCHES[Math.floor(((h + 1) % 24) / 2)];
}

export function moonAge(y, m, d) {
  const REF = Date.UTC(2000, 0, 6, 18, 14);
  const SYNODIC = 29.530588853;
  const t = Date.UTC(y, m - 1, d, 12);
  const age = (((t - REF) / 86400000) % SYNODIC + SYNODIC) % SYNODIC;
  const phase = MOON_PHASES[Math.floor((age / SYNODIC) * 8 + 0.5) % 8];
  return { age: Math.round(age * 10) / 10, phase };
}

export function parseDate(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str || '');
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

export function buildFacts({ birthDate, birthTime, today }) {
  const b = parseDate(birthDate);
  const t = parseDate(today);
  if (!b || !t) throw new Error('日付の形式が正しくありません');
  return {
    birth: { date: birthDate, time: birthTime || null },
    sunSign: sunSign(b.m, b.d),
    lifePath: lifePathNumber(b.y, b.m, b.d),
    eto: etoOfYear(b.y, b.m, b.d),
    dayPillar: dayPillar(b.y, b.m, b.d),
    hourBranch: hourBranch(birthTime),
    today: {
      date: today,
      dayPillar: dayPillar(t.y, t.m, t.d),
      moon: moonAge(t.y, t.m, t.d),
      weekday: ['日', '月', '火', '水', '木', '金', '土'][new Date(Date.UTC(t.y, t.m - 1, t.d)).getUTCDay()],
    },
  };
}
