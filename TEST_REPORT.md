# GoPlan — 検証レポート

更新日：2026-11-21

## 現在の対象

- 対象ブランチ：`goplan-complete-dev`
- 対象PR：[#3](https://github.com/kwakebe2781/outing-manager/pull/3)
- 最終確認コミット：`a49553e8a1e818cf2b31372e67fd708f4936ecd6` 時点の後、さらに追加修正あり。最新のPR headはGitHubで確認すること。
- PRはDraftで、未Merge。公開ブランチ `main` は変更していません。

## GitHub Actionsで成功した検査

2026-11-21の最新確認時点で、最新コミット `a49553e8a1e818cf2b31372e67fd708f4936ecd6` に対するGitHub Actionsのフロントエンド・Worker両方のジョブが成功しました。その後のフィルターイベント修正は別コミットなので、必ず最新headのActions結果も確認してください。

CIで行う検査：
- HTMLのパース、ID重複チェック、インラインJavaScriptの `node --check`
- Service Workerの `node --check`
- HTMLから参照するローカルファイルとDOM IDの検査
- Web App ManifestのJSONとアイコンファイルの存在確認
- WorkerのJavaScript構文チェック
- Worker単体テスト
- Wrangler TOMLのパースと必要な設定の有無
- D1マイグレーションSQLをSQLiteで実行し、必須テーブルを確認

## Worker単体テストの対象

- 行きたい場所／予定の保存データ形式と件数上限
- AI会話履歴から許可されないroleを除外する処理
- JSON形式のAI構造化出力の読み取り
- 指定タイムゾーンの時刻変換
- Google OAuthのスコープ判定（`openid` とGoogleの `userinfo.email` URI）
- AI候補の出典URLを、Responses APIが実際に返した引用URLと照合する処理

これらはコード単位のテストです。実際のGoogle、Cloudflare、OpenAIサービスへ接続したテストではありません。

## まだ実施していない本番・実機テスト

- CloudflareアカウントにWorkerをデプロイしていません。
- D1本番データベースを作成・マイグレーションしていません。
- Google OAuthの実クライアントIDを設定していません。
- OpenAI APIキーやVAPIDキーをWorker Secretに設定していません。
- 実GoogleアカウントでのログインやDriveアクセスを確認していません。
- PLANIの実検索、料金、引用精度を実APIで確認していません。
- Web Pushの実送信、iPhone／Androidでの通知受信を確認していません。
- iPhone／AndroidのPWAインストールと実オフライン表示を確認していません。
- 複数の実端末でのデータ競合・バックアップ復元を確認していません。

## 既知の制限・注意

- 地図リンクはGoogleマップを外部で開く方式です。アプリ内地図や移動時間計算は未実装です。
- 写真はアプリデータに含めて同期するため、容量上限があります。写真数や保存量が増える場合は、オブジェクトストレージ導入が必要です。
- AI・クラウド同期・通知はWorkerの本番設定が終わるまで利用できません。
- Web Pushは端末・ブラウザごとの許可と登録が必要です。iPhoneではホーム画面追加後の実機テストが必要です。
- AIの回答は誤りがゼロになる保証はありません。住所・営業時間・料金・開催日などはリンク先の公式情報を確認してください。

このレポートは現時点で実際に行ったコード検査を記録したものです。すべての端末や利用状況で不具合がないことを保証するものではありません。
