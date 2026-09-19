// サーバー(Claude API)が使えない場合の簡易結果。ブラウザ・Node 両方で動く純粋関数

const LIFE_PATH_TEXT = {
  1: '切り拓く力', 2: '調和と共感', 3: '表現と創造', 4: '堅実と積み重ね', 5: '変化と自由',
  6: '愛情と責任', 7: '探究と直感', 8: '実行力と豊かさ', 9: '包容と完成', 11: '直感とひらめき',
  22: '大きな構想を形にする力', 33: '奉仕と癒し',
};

export function fallbackReading(facts, concern, palmImage, note) {
  const theme = LIFE_PATH_TEXT[facts.lifePath];
  return {
    source: 'fallback',
    headline: `${facts.sunSign}の今日は${facts.today.moon.phase}`,
    overall: `ライフパスナンバー${facts.lifePath}の「${theme}」が持ち味です。今日は${facts.today.moon.phase}(月齢${facts.today.moon.age})。無理に動くより、自分の得意な形で一歩進めると流れに乗れます。(※${note})`,
    concern: `${concern}については、${theme}を意識して、小さな行動から始めてみましょう。`,
    palm: { detected: false, life: '', heart: '', head: '', fate: '' },
    lucky: { color: '紺', item: 'ノート', action: '朝に5分だけ予定を整理する' },
    scores: { love: 3, work: 3, money: 3 },
  };
}
