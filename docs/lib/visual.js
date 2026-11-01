// 結果画面のビジュアル(五行の円環・月の満ち欠け)の座標計算。描画(SVG生成)は app.js、ここは純粋関数。

// 相生(木→火→土→金→水→木)の順。上から時計回りに並べる
export const ELEMENTS = ['木', '火', '土', '金', '水'];

// 円環のノード座標(viewBox 200x200 想定)
export function wheelNodes(cx = 100, cy = 100, r = 62) {
  return ELEMENTS.map((name, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / ELEMENTS.length;
    return { name, x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), angle: a };
  });
}

const SYNODIC = 29.530588853;

// 月の明るい側の形。原点中心・半径 r の SVG パス(水平反転が必要なら waning=true)。
// 新月(ほぼ見えない)は lit=null。光る側は右(満ちていく間)、欠けていく間は左。
export function moonShape(age, r = 16) {
  const p = (((age % SYNODIC) + SYNODIC) % SYNODIC) / SYNODIC;
  const waning = p > 0.5;
  const q = waning ? 1 - p : p; // 0(新月)〜0.5(満月)
  if (q < 0.02) return { waning, lit: null, full: false };
  const rx = r * Math.abs(Math.cos(2 * Math.PI * q));
  const sweep = q < 0.25 ? 0 : 1; // 三日月は境界が右へ膨らみ、半月を過ぎると左へ膨らむ
  return {
    waning,
    full: q > 0.48,
    lit: `M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r} A ${rx.toFixed(2)} ${r} 0 0 ${sweep} 0 ${-r} Z`,
  };
}
