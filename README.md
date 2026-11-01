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

`docs/` が画面と計算ロジック(GitHub Pages の配信元)、`lib/reading.js` が Claude 連携(プロンプトと API 呼び出し)、`server.js` がローカル用サーバー、`worker/` が公開用の Cloudflare Worker です。

## 公開版で AI 連携(表情・手相の読み取り)を使う

公開ページ(GitHub Pages)は静的なので、AI 連携には Worker が必要です。API キーは Worker の secret にだけ置き、画面には出ません。

```bash
cd worker
wrangler secret put ANTHROPIC_API_KEY   # 初回のみ。キーを対話入力
wrangler deploy                         # 表示された URL を docs/config.js の API_URL に設定して push
```

- 許可するサイトは `https://cocofree37.github.io` のみ(`worker/src/index.js`)。それ以外の Origin は 403
- 同じ IP から 1 分あたり 3 回まで(`worker/wrangler.toml`)
- 写真は Claude への送信にだけ使い、保存・ログ出力はしません
- `docs/config.js` の `API_URL` が空、または Worker が不調のときは、ブラウザ内の簡易診断に切り替わります
