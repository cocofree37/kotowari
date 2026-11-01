// 「今日の調子」の選択肢と検証。ブラウザ(入力UI)とサーバー(受信検証)で共有する

export const ENERGY = [
  { v: 1, emoji: '😫', label: 'ぐったり' },
  { v: 2, emoji: '😕', label: 'いまいち' },
  { v: 3, emoji: '😐', label: 'ふつう' },
  { v: 4, emoji: '🙂', label: '好調' },
  { v: 5, emoji: '😄', label: '絶好調' },
];
export const SLEEP = ['短め', 'ふつう', 'しっかり'];
export const MOOD = ['前向き', '落ち着いている', '不安', '疲れ気味', 'イライラ'];
export const FOCUS = ['提案・商談', '資料・集中作業', '会議・調整', '企画・学習'];
export const MEMO_MAX = 200;

export function normalizeCondition(c) {
  const energy = Number(c?.energy);
  if (!Number.isInteger(energy) || energy < 1 || energy > 5) throw new Error('今日の調子を選んでください');
  if (!SLEEP.includes(c.sleep)) throw new Error('睡眠を選んでください');
  if (!MOOD.includes(c.mood)) throw new Error('気分を選んでください');
  if (!FOCUS.includes(c.focus)) throw new Error('今日の仕事の中心を選んでください');
  const memo = String(c.memo ?? '').trim().slice(0, MEMO_MAX);
  return { energy, sleep: c.sleep, mood: c.mood, focus: c.focus, memo };
}
