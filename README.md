# kotowari

生年月日・手相・悩みカテゴリから占い結果を出すWebアプリ。

- 公開デモ(静的・簡易結果のみ): https://cocofree37.github.io/kotowari/
- フル機能(Claudeによる文章生成・手相解析): ローカルでサーバーを起動

```bash
ANTHROPIC_API_KEY=sk-ant-... npm start   # http://localhost:3000
npm test
```

`docs/` が画面と計算ロジック(GitHub Pages の配信元)、`server.js` と `lib/reading.js` が Claude 連携用のサーバーです。
