# kotowari

今日の調子・顔写真・占い(生年月日)から、その日のモチベーションを上げる診断を出すWebアプリ。

- 今日の調子(調子・睡眠・気分・仕事の中心・ひとこと)を入力
- 顔写真を撮影(表情の印象を読む。任意)
- 背景は占い(星座・数秘術・四柱推命の五行・月齢)。手相も任意で追加可

- 公開デモ(静的・入力と算出データによる診断のみ): https://cocofree37.github.io/kotowari/
- フル機能(Claudeによる文章生成・顔/手相の読み取り): ローカルでサーバーを起動

```bash
ANTHROPIC_API_KEY=sk-ant-... npm start   # http://localhost:3000
npm test
```

`docs/` が画面と計算ロジック(GitHub Pages の配信元)、`server.js` と `lib/reading.js` が Claude 連携用のサーバーです。
