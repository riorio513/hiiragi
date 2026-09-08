import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { dateTime, relative, shortDateTime, yen } from "@/lib/format";
import { NOTIFICATION_LABEL, STOCK_LABEL, type StockStatus } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import SubmitButton from "@/components/SubmitButton";
import AddUrlForm from "./AddUrlForm";
import {
  deleteProductAction,
  linkAccountAction,
  recheckNowAction,
  removeProductUrlAction,
  toggleProductFlagAction,
  toggleProductUrlAction,
  unlinkAccountAction,
} from "@/server/actions/products";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string;
  name: string;
  description: string;
  image_url: string;
  target_price: number | null;
  monitoring_enabled: boolean;
  notify_enabled: boolean;
  sale_starts_at: Date | null;
  sale_ends_at: Date | null;
  sale_note: string;
  is_demo: boolean;
  created_at: Date;
  updated_at: Date;
};

type UrlRow = {
  id: string;
  label: string;
  is_active: boolean;
  store_name: string | null;
  target_id: string;
  url: string;
  host: string;
  adapter: string;
  min_interval_sec: number;
  target_active: boolean;
  disabled_reason: string | null;
  last_status: StockStatus | null;
  last_price: number | null;
  last_title: string | null;
  last_checked_at: Date | null;
  next_check_at: Date | null;
  last_success_at: Date | null;
  last_error_message: string | null;
  consecutive_errors: number;
};

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ urlError?: string; added?: string; saved?: string; demo?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { urlError, added, saved, demo } = await searchParams;

  const product = await queryOne<ProductRow>(
    `select id, name, description, image_url, target_price, monitoring_enabled, notify_enabled,
            sale_starts_at, sale_ends_at, sale_note, is_demo, created_at, updated_at
       from hiiragi.products where id = $1 and user_id = $2`,
    [id, user.id],
  );
  if (!product) notFound();

  const urls = await query<UrlRow>(
    `select pu.id, pu.label, pu.is_active, s.name as store_name,
            t.id as target_id, t.url, t.host, t.adapter, t.min_interval_sec,
            t.is_active as target_active, t.disabled_reason,
            t.last_status, t.last_price, t.last_title, t.last_checked_at, t.next_check_at,
            t.last_success_at, t.last_error_message, t.consecutive_errors
       from hiiragi.product_urls pu
       join hiiragi.monitor_targets t on t.id = pu.target_id
       left join hiiragi.stores s on s.id = pu.store_id
      where pu.product_id = $1
      order by pu.created_at`,
    [product.id],
  );

  const history = await query<{
    checked_at: Date;
    stock_status: StockStatus;
    price: number | null;
    http_status: number | null;
    adapter: string | null;
    error_message: string | null;
    note: string | null;
    url: string;
  }>(
    `select r.checked_at, r.stock_status, r.price, r.http_status, r.adapter, r.error_message,
            r.note, t.url
       from hiiragi.monitor_results r
       join hiiragi.monitor_targets t on t.id = r.target_id
      where r.target_id in (select target_id from hiiragi.product_urls where product_id = $1)
      order by r.checked_at desc
      limit 25`,
    [product.id],
  );

  const notifications = await query<{
    id: string;
    kind: string;
    title: string;
    body: string;
    created_at: Date;
    is_read: boolean;
  }>(
    `select id, kind, title, body, created_at, is_read
       from hiiragi.notifications where product_id = $1 and user_id = $2
      order by created_at desc limit 10`,
    [product.id, user.id],
  );

  const allAccounts = await query<{ id: string; name: string; platform: string; url: string }>(
    `select id, name, platform, url from hiiragi.official_accounts
      where user_id = $1 and is_active order by name`,
    [user.id],
  );
  const linked = await query<{ account_id: string }>(
    `select account_id from hiiragi.product_accounts where product_id = $1`,
    [product.id],
  );
  const linkedIds = new Set(linked.map((l) => l.account_id));

  const stores = await query<{ id: string; name: string }>(
    `select id, name from hiiragi.stores where user_id = $1 and is_active order by name`,
    [user.id],
  );

  const bestUrl = urls.find((u) => u.last_status === "in_stock") ?? urls[0];

  return (
    <div className="space-y-4">
      <Link href="/dashboard" className="text-sm text-gray-500 underline">
        ← ホームに戻る
      </Link>

      {urlError && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          商品は登録しましたが、URLは登録できませんでした：{urlError}
        </p>
      )}
      {added && (
        <p className="rounded-xl bg-holly-50 px-3 py-2 text-sm text-holly-700">
          登録しました。監視を開始しています。
        </p>
      )}
      {saved && (
        <p className="rounded-xl bg-holly-50 px-3 py-2 text-sm text-holly-700">保存しました。</p>
      )}
      {demo && (
        <p className="rounded-xl bg-holly-50 px-3 py-2 text-sm text-holly-700">
          練習用データを用意しました。下の「デモ用の商品ページ」を開いて在庫を切り替えると、通知が届きます。
        </p>
      )}

      <div className="card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold">{product.name}</h1>
            {product.is_demo && (
              <p className="mt-1 text-xs font-bold text-gray-500">
                これは練習用のデモデータです。実在の商品ではありません。
              </p>
            )}
            {product.description && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{product.description}</p>
            )}
          </div>
          <Link href={`/products/${product.id}/edit`} className="btn-ghost shrink-0">
            編集
          </Link>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-gray-500">現在の状態</dt>
            <dd className="mt-1">
              <StatusBadge status={bestUrl?.last_status ?? null} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">現在価格</dt>
            <dd className="mt-1 font-bold">{yen(bestUrl?.last_price ?? null)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">希望価格</dt>
            <dd className="mt-1 font-bold">{yen(product.target_price)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">最終確認</dt>
            <dd className="mt-1">{relative(bestUrl?.last_checked_at ?? null)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">販売開始予定</dt>
            <dd className="mt-1">{dateTime(product.sale_starts_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">販売終了予定</dt>
            <dd className="mt-1">{dateTime(product.sale_ends_at)}</dd>
          </div>
        </dl>
        {product.sale_note && (
          <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700">
            メモ：{product.sale_note}
          </p>
        )}

        {bestUrl && (
          <a
            href={bestUrl.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="btn-primary mt-4 w-full"
          >
            商品ページを開く（購入はご自身で）
          </a>
        )}

        <div className="mt-3 flex gap-2">
          <form action={toggleProductFlagAction} className="flex-1">
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="field" value="monitoring_enabled" />
            <SubmitButton className="btn-ghost w-full" pendingLabel="…">
              {product.monitoring_enabled ? "監視を止める" : "監視を再開する"}
            </SubmitButton>
          </form>
          <form action={toggleProductFlagAction} className="flex-1">
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="field" value="notify_enabled" />
            <SubmitButton className="btn-ghost w-full" pendingLabel="…">
              {product.notify_enabled ? "通知を止める" : "通知を再開する"}
            </SubmitButton>
          </form>
        </div>
        <p className="hint">
          監視：{product.monitoring_enabled ? "ON" : "OFF"} ／ 通知：
          {product.notify_enabled ? "ON" : "OFF"}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">監視している商品ページ</h2>
        {urls.length === 0 && (
          <p className="card text-sm text-gray-600">
            まだ商品ページが登録されていません。下のフォームからURLを貼り付けてください。
          </p>
        )}
        {urls.map((u) => (
          <div key={u.id} className="card space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={u.last_status} />
              {!u.is_active && <span className="chip bg-gray-100 text-gray-600">監視OFF</span>}
              {!u.target_active && (
                <span className="chip bg-amber-50 text-amber-700">監視停止中</span>
              )}
              <span className="chip bg-gray-100 text-gray-600">{u.store_name ?? u.host}</span>
            </div>
            <p className="break-all text-sm text-gray-700">{u.last_title ?? u.url}</p>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs text-gray-500">価格</dt>
                <dd className="font-bold">{yen(u.last_price)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">最終確認</dt>
                <dd>{relative(u.last_checked_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">次回確認</dt>
                <dd>{shortDateTime(u.next_check_at)}ごろ</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">最短確認間隔</dt>
                <dd>{Math.round(u.min_interval_sec / 60)}分</dd>
              </div>
            </dl>

            {(u.consecutive_errors > 0 || !u.target_active) && (
              <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-bold">
                  {u.target_active
                    ? `確認できない状態が${u.consecutive_errors}回続いています`
                    : "このページの監視を停止しました"}
                </p>
                <p className="mt-1">{u.disabled_reason ?? u.last_error_message ?? "原因不明"}</p>
                <p className="mt-1 text-xs">
                  最後に成功したのは {dateTime(u.last_success_at)} です。
                </p>
                <p className="mt-2 text-xs">
                  できること：URLがまだ有効か確認する／販売ページのURLが変わっていないか確認する／しばらく待つ
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <a
                href={u.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="btn-secondary"
              >
                ページを開く
              </a>
              <form action={recheckNowAction}>
                <input type="hidden" name="productUrlId" value={u.id} />
                <SubmitButton className="btn-ghost" pendingLabel="確認中…">
                  いま確認する
                </SubmitButton>
              </form>
              <form action={toggleProductUrlAction}>
                <input type="hidden" name="productUrlId" value={u.id} />
                <SubmitButton className="btn-ghost" pendingLabel="…">
                  {u.is_active ? "一時停止" : "再開"}
                </SubmitButton>
              </form>
              <form action={removeProductUrlAction}>
                <input type="hidden" name="productUrlId" value={u.id} />
                <SubmitButton
                  className="btn-danger"
                  pendingLabel="…"
                  confirm="この商品ページの監視をやめます。よろしいですか？"
                >
                  削除
                </SubmitButton>
              </form>
            </div>
          </div>
        ))}

        <div className="card">
          <h3 className="mb-3 text-base font-bold">商品ページを追加する</h3>
          <AddUrlForm productId={product.id} stores={stores} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">公式アカウント</h2>
        <div className="card space-y-3">
          {allAccounts.length === 0 ? (
            <p className="text-sm text-gray-600">
              まだ登録がありません。
              <Link href="/accounts" className="ml-1 font-bold text-holly-600 underline">
                公式アカウントを登録する
              </Link>
            </p>
          ) : (
            allAccounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{a.name}</p>
                  <p className="truncate text-xs text-gray-500">{a.url || a.platform}</p>
                </div>
                <form action={linkedIds.has(a.id) ? unlinkAccountAction : linkAccountAction}>
                  <input type="hidden" name="productId" value={product.id} />
                  <input type="hidden" name="accountId" value={a.id} />
                  <SubmitButton
                    className={linkedIds.has(a.id) ? "btn-ghost" : "btn-secondary"}
                    pendingLabel="…"
                  >
                    {linkedIds.has(a.id) ? "紐付けを外す" : "この商品に紐付ける"}
                  </SubmitButton>
                </form>
              </div>
            ))
          )}
          <p className="hint">
            登録しておくと、販売告知を見に行くときの入口になります（SNSの自動取得は行いません）。
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">この商品の通知</h2>
        <div className="card">
          {notifications.length === 0 ? (
            <p className="text-sm text-gray-600">まだ通知はありません。</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {notifications.map((n) => (
                <li key={n.id} className="py-2">
                  <p className="text-xs text-gray-500">
                    {shortDateTime(n.created_at)}・{NOTIFICATION_LABEL[n.kind] ?? n.kind}
                    {!n.is_read && <span className="ml-1 text-berry-600">未読</span>}
                  </p>
                  <p className="text-sm font-bold">{n.title}</p>
                  <p className="text-sm text-gray-600">{n.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">監視履歴</h2>
        <div className="card overflow-x-auto">
          {history.length === 0 ? (
            <p className="text-sm text-gray-600">まだ履歴がありません。</p>
          ) : (
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs text-gray-500">
                <tr>
                  <th className="py-1 pr-3">日時</th>
                  <th className="py-1 pr-3">状態</th>
                  <th className="py-1 pr-3">価格</th>
                  <th className="py-1 pr-3">HTTP</th>
                  <th className="py-1 pr-3">判定の根拠</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{shortDateTime(h.checked_at)}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{STOCK_LABEL[h.stock_status]}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{yen(h.price)}</td>
                    <td className="py-1.5 pr-3">{h.http_status ?? "—"}</td>
                    <td className="py-1.5 pr-3 text-xs text-gray-600">
                      {h.error_message ?? h.note ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <form action={deleteProductAction} className="pt-2">
        <input type="hidden" name="productId" value={product.id} />
        <SubmitButton
          className="btn-danger w-full"
          pendingLabel="削除しています…"
          confirm="この商品と、監視の設定・通知をまとめて削除します。よろしいですか？"
        >
          この商品を削除する
        </SubmitButton>
      </form>
    </div>
  );
}
