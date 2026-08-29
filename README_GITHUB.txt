買い物メモ GitHub Pages / PWA版 v3

【v2からの変更】
・index.html / styles.css / app.js / images/egg.png の分割構成を維持
・manifest.webmanifest を追加
・service-worker.js を追加（PWA/オフライン起動用）
・icons/ を追加（ホーム画面用）
・.nojekyll を追加（GitHub Pagesで静的ファイルをそのまま配信）
・買い物データは引き続き localStorage のみ。外部送信処理は追加していません。

【重要なプライバシー仕様】
GitHub Pagesで公開されるのはHTML/CSS/JS/画像などの「アプリ本体」です。
買い物リストは各端末のブラウザの localStorage にだけ保存され、GitHubへ送信されません。
したがって他人がURLを開いても、その人には空の買い物リストが表示されます。
ただしGitHub Pagesサイト自体は公開URLになるため、「アプリの存在・コード自体を秘密にする」用途には向きません。

【GitHubへ置くファイル】
このフォルダの「中身」をリポジトリのルートに置いてください。
index.html がリポジトリ直下に見える状態にします。

例:
repository-root/
  index.html
  styles.css
  app.js
  manifest.webmanifest
  service-worker.js
  .nojekyll
  images/egg.png
  icons/icon-192.png
  icons/icon-512.png

【既存のローカル版からデータを移す場合】
ローカル版で「JSONで保存」→ GitHub Pages版で「JSONから復元」を使ってください。
file:// と https://...github.io は別の保存領域なので、localStorageは自動移行されません。
