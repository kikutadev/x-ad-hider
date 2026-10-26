# X Ad Hider

X（旧Twitter）のタイムラインで、広告として表示された投稿だけを非表示にする、Manifest V3のChrome拡張機能です。

- Xが表示する広告ラベルや専用マーカーを判定します。投稿本文や引用ポスト内の「広告」という語だけでは非表示にしません。
- ホーム、プロフィール、検索などの画面切り替え・無限スクロール・投稿セル再利用に追従します。
- 閲覧履歴や投稿内容の収集・追跡・外部送信はしません。
- Chromeのバックグラウンド処理や追加API権限は不要です。

## インストール

[Releases](https://github.com/kikutadev/x-ad-hider/releases) のChrome向けZIPをダウンロードし、解凍したフォルダーをChromeの `chrome://extensions/` から「パッケージ化されていない拡張機能を読み込む」で選択してください。

Xtendでは、対応するバージョンのアプリにGitHubリポジトリURLを入力して導入できます。

## 開発・テスト

Node.jsとpnpmが必要です。

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm zip
pnpm test:e2e
```

`test:e2e` はPlaywrightのChromiumを使用します。初回は `pnpm exec playwright install chromium` を実行してください。

広告と断定できない投稿は表示したままにします。Xの仕様変更で判定が追従できなくなる場合があります。通信遮断機能ではありません。

## 配布物とライセンス

`release/` に配布用ZIPとSHA-256検証値があります。アイコンの原本は `assets/icon.svg`、Chrome用PNGは `public/icon/` に配置しています。

MITライセンス。詳細は [LICENSE](LICENSE) を参照してください。
