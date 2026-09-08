import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { dateTime, yen } from "@/lib/format";
import { NOTIFICATION_LABEL } from "@/lib/types";
import SubmitButton from "@/components/SubmitButton";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/server/actions/catalog";

export const dynamic = "force-dynamic";

const KIND_STYLE: Record<string, string> = {
  back_in_stock: "bg-holly-100 text-holly-700",
  price_drop: "bg-holly-100 text-holly-700",
  sale_soon: "bg-blue-50 text-blue-700",
  error: "bg-amber-50 text-amber-700",
};

export default async function NotificationsPage() {
  const user = await requireUser();
  const rows = await query<{
    id: string;
    product_id: string | null;
    kind: string;
    title: string;
    body: string;
    price: number | null;
    store_name: string;
    link_url: string;
    is_read: boolean;
    created_at: Date;
  }>(
    `select id, product_id, kind, title, body, price, store_name, link_url, is_read, created_at
       from hiiragi.notifications where user_id = $1
      order by created_at desc limit 100`,
    [user.id],
  );

  const unread = rows.filter((r) => !r.is_read).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">通知</h1>
        {unread > 0 && (
          <form action={markAllNotificationsReadAction}>
            <SubmitButton className="btn-ghost" pendingLabel="…">
              すべて既読にする
            </SubmitButton>
          </form>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <p className="text-sm leading-relaxed text-gray-600">
            まだ通知はありません。
            <br />
            在庫が復活したときや、希望価格を下回ったとき、販売開始が近づいたときにここへ届きます。
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((n) => (
            <li key={n.id} className={`card ${n.is_read ? "opacity-70" : ""}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`chip ${KIND_STYLE[n.kind] ?? "bg-gray-100 text-gray-600"}`}>
                  {NOTIFICATION_LABEL[n.kind] ?? n.kind}
                </span>
                {!n.is_read && <span className="chip bg-berry-500 text-white">未読</span>}
                <span className="text-xs text-gray-500">{dateTime(n.created_at)}</span>
              </div>
              <p className="mt-2 text-base font-bold">{n.title}</p>
              <p className="mt-1 text-sm text-gray-600">{n.body}</p>
              <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                {n.store_name && <div>店舗：{n.store_name}</div>}
                {n.price !== null && <div>価格：{yen(n.price)}</div>}
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                {n.link_url && (
                  <a
                    href={n.link_url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="btn-primary"
                  >
                    商品ページを開く
                  </a>
                )}
                {n.product_id && (
                  <Link href={`/products/${n.product_id}`} className="btn-ghost">
                    商品の詳細
                  </Link>
                )}
                {!n.is_read && (
                  <form action={markNotificationReadAction}>
                    <input type="hidden" name="notificationId" value={n.id} />
                    <SubmitButton className="btn-ghost" pendingLabel="…">
                      既読にする
                    </SubmitButton>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="hint">購入手続きは、商品ページでご自身で行ってください。</p>
    </div>
  );
}
