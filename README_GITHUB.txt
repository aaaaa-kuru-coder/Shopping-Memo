買い物メモ GitHub Pages / PWA版 v4
====================================

【v4の主な変更】
・プルダウン（よく買う物）の品目を items.json に分離しました。
・クイック追加ボタンも items.json の quick 属性から自動生成します。
・アイコンは items.json の iconfile で指定します。
・既にリストへ追加済みのマスタ品目も catalogKey を保持するため、
  items.json で表示名やiconfileを変えると、新しい設定が表示に反映されます。
・v3以前の保存データは、表示名が一致する品目を可能な範囲で自動的にマスタ品目へ紐付けます。

【items.json の構造】
ルートは「PG管理上名称」をキーにしたオブジェクトです。

例:
{
  "olive": {
    "alias": "オリーブオイル",
    "iconfile": "olive.png",
    "quick": false,
    "order": 130
  },
  "garlic": {
    "alias": "ニンニク",
    "iconfile": "garlic.png",
    "quick": true,
    "order": 140
  }
}

各属性:
・キー（例: olive）: PG管理上名称。英小文字・数字・ハイフン等の安定した名前を推奨。
・alias: 画面上の表示名。必須。
・iconfile: images フォルダ内の画像ファイル名。画像なしは null。
・quick: true にするとプルダウン下のクイック追加ボタンにも表示。
・order: プルダウンとクイック追加の並び順。小さいほど前。

【品目を追加する手順】
1. アイコンがある場合は images/ にPNG等を追加する。
2. items.json に新しいキーと設定を追加する。
3. GitHubで変更をCommitする。
4. GitHub Pagesに反映後、アプリをオンライン状態で開く。

※ JSONでは Python の None ではなく null を使います。
※ 最後の要素の末尾にカンマを付けるとJSONエラーになるので注意。

【アイコン例】
images/olive.png を置いた場合:
"iconfile": "olive.png"

画像なし:
"iconfile": null

【PWAの更新について】
items.json はService Workerでも「ネットワーク優先」にしてあります。
そのためオンライン時はGitHub Pages上の最新版を取りに行き、
オフライン時だけキャッシュ済み items.json を使います。

【重要】
・買い物リスト本体は localStorage に保存され、GitHubへ送信されません。
・GitHub Pages上にはアプリのHTML/CSS/JS/JSON/画像だけが公開されます。
