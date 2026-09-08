# 準備の手順

すでにローカルでは動く状態になっています。ここは「もう一度作り直すとき」「別の環境に移すとき」の手順です。
りおさんに実際にお願いする操作だけを知りたい場合は [USER_ACTIONS.md](USER_ACTIONS.md) を見てください。

## 1. 必要なもの

- Node.js 20 以上（この開発機では `C:\Program Files\nodejs` に入っています）
- Supabase の Postgres 接続文字列
- GitHub アカウント / Vercel アカウント（デプロイする場合）

## 2. ローカルで動かす

```bash
cd hiiragi
npm install
cp .env.example .env.local
```

`.env.local` に入れる値：

| キー | 何を入れるか |
| --- | --- |
| `DATABASE_URL` | Supabase の接続文字列（Session pooler / port 5432） |
| `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` の出力 |
| `CRON_SECRET` | `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"` の出力 |
| `APP_BASE_URL` | `http://localhost:3600` |

そのあと：

```bash
npm run migrate   # hiiragi スキーマにテーブルを作る（何度実行しても安全）
npm run serve     # http://localhost:3600
```

**最初にアカウントを作った人が自動的に管理者になります。**

## 3. データベース

- 表の定義は `db/schema.sql` の1枚だけ。すべて `create table if not exists` なので、
  何度流しても壊れません。列を足すときは `alter table ... add column if not exists` を末尾に足してください。
- `npm run migrate` がそのファイルを流します。
- Supabase の SQL Editor は Chrome の翻訳機能で壊れることがあるため、
  このプロジェクトでは**必ず `npm run migrate`（直接接続）を使います**。

## 4. Vercel へ置く

```bash
npx vercel link --yes --project hiiragi
printf '%s' "<DATABASE_URL>"  | npx vercel env add DATABASE_URL production
printf '%s' "<SESSION_SECRET>" | npx vercel env add SESSION_SECRET production
printf '%s' "<CRON_SECRET>"    | npx vercel env add CRON_SECRET production
printf '%s' "https://<本番ドメイン>" | npx vercel env add APP_BASE_URL production
npx vercel deploy --prod
```

新規プロジェクトは既定で Deployment Protection（Vercel SSO）が有効です。
**そのままだと本人以外（＝友人のスマホ）から開けません。** 解除は Vercel の API で：

```
PATCH https://api.vercel.com/v9/projects/hiiragi?teamId=<teamId>
{"ssoProtection": null}
```

## 5. 定期監視（GitHub Actions）

`.github/workflows/monitor.yml` が5分ごとに `POST /api/cron/check` を叩きます。
リポジトリの **Settings > Secrets and variables > Actions** に2つ登録します。

| シークレット名 | 値 |
| --- | --- |
| `APP_URL` | `https://<本番ドメイン>`（末尾のスラッシュなし） |
| `CRON_SECRET` | Vercel に入れたものと同じ値 |

**リポジトリは公開（public）にしてください。** 非公開だと Actions の無料枠（月2,000分）を
確実に超えます。理由は [TECHNICAL_DECISIONS.md](TECHNICAL_DECISIONS.md) に書いてあります。

登録後、Actions タブの「定期監視」→「Run workflow」で1回手動実行し、
`{"ok":true,...}` が返ることを確かめてください。

## 6. 動いているかの確認

1. 本番URLを開いてアカウントを作る（最初の1人が管理者）
2. 設定 →「デモデータを用意する」
3. 商品詳細の「ページを開く」で模擬ショップを開き、「在庫ありにする」を押す
4. 「🔔 通知」に「在庫が復活しました」が届く
5. 管理画面の「監視の実行状況」に、GitHub Actions からの実行（`cron`）が並びはじめる
