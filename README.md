# クネクネ離脱システム Phase 1

スマホで動画を見ながら先延ばししている人に向けた、目的地へ体を移動させるための最小プロトタイプです。

Phase 1では位置推定は実装せず、画面下部の擬似モードで方向と残り距離を手動入力します。開始するとYouTubeプレイヤーが目的地方向へ少しずつズレ、動画を追いかける体験の核だけを確認できます。

## 起動方法

```bash
npm install
npm run dev -- --host
```

表示されたローカルネットワークURLへ、同じWi-Fiに接続したスマホからアクセスしてください。

## 確認コマンド

```bash
npm run build
npx vitest run
```

## 公開URL

https://NACON01.github.io/kunekune-escape/

## GitHub Pagesへのデプロイ

```bash
npm install
npm run deploy
```
