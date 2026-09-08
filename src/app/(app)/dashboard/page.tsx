import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { dashboardRank, listDashboardProducts, productStatus } from "@/server/queries";
import { dateTime, relative, yen } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import SubmitButton from "@/components/SubmitButton";
import { seedDemoAction } from "@/server/actions/demo";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; deleted?: string }>;
}) {
  const user = await requireUser();
  const { welcome, deleted } = await searchParams;
  const products = (await listDashboardProducts(user.id)).sort(
    (a, b) => dashboardRank(a) - dashboardRank(b),
  );

  return (
    <div className="space-y-4">
      {welcome && (
        <div className="card bg-holly-50 ring-holly-200">
          <h2 className="text-base font-bold text-holly-700">ようこそ！まずは3ステップ</h2>
          <ol className="mt-2 space-y-1 text-sm text-holly-700">
            <li>1. 欲しい商品を登録する</li>
            <li>2. その商品が売られているページのURLを貼る</li>
            <li>3. 在庫が復活したら、下の「通知」に届きます</li>
          </ol>
          <p className="mt-2 text-xs text-holly-600">
            購入手続きは通知から商品ページを開いて、ご自身で行ってください。
          </p>
        </div>
      )}
      {deleted && (
        <p className="rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-600">削除しました。</p>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">見張っているもの</h1>
        <Link href="/products/new" className="btn-primary">
          ＋ 商品を追加
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="card">
          <p className="text-sm leading-relaxed text-gray-700">
            まだ何も登録されていません。
            <br />
            欲しい商品を1つ登録すると、ここに状態が並びます。
          </p>
          <div className="mt-4 space-y-2">
            <Link href="/products/new" className="btn-primary w-full">
              最初の商品を登録する
            </Link>
            <form action={seedDemoAction}>
              <SubmitButton className="btn-secondary w-full" pendingLabel="用意しています…">
                先に練習してみる（デモデータを作る）
              </SubmitButton>
            </form>
            <p className="hint">
              デモは、このアプリの中にある練習用の模擬ショップを監視します。実在の商品ではありません。
            </p>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {products.map((p) => {
            const status = productStatus(p);
            const priceMet =
              p.target_price !== null && p.min_price !== null && p.min_price <= p.target_price;
            return (
              <li key={p.id}>
                <Link href={`/products/${p.id}`} className="card block hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={status} />
                        {p.is_demo && (
                          <span className="chip bg-gray-100 text-gray-600">デモ</span>
                        )}
                        {!p.monitoring_enabled && (
                          <span className="chip bg-gray-100 text-gray-600">監視OFF</span>
                        )}
                        {p.error_count > 0 && (
                          <span className="chip bg-amber-50 text-amber-700">要確認</span>
                        )}
                        {p.unread > 0 && (
                          <span className="chip bg-berry-500 text-white">未読{p.unread}</span>
                        )}
                      </div>
                      <p className="mt-2 truncate text-base font-bold">{p.name}</p>
                      <p className="mt-1 text-sm text-gray-600">
                        現在価格 {yen(p.min_price)}
                        {p.target_price !== null && (
                          <span className={priceMet ? "text-holly-600" : "text-gray-500"}>
                            ／希望 {yen(p.target_price)}
                            {priceMet ? "（条件成立）" : ""}
                          </span>
                        )}
                      </p>
                      {p.sale_starts_at && (
                        <p className="mt-1 text-sm text-gray-600">
                          販売開始予定 {dateTime(p.sale_starts_at)}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-400">
                        {p.url_count === 0
                          ? "商品ページが未登録です"
                          : `最終確認 ${relative(p.last_checked_at)}・${p.url_count}件のページを監視中`}
                      </p>
                    </div>
                    <span className="shrink-0 text-gray-300" aria-hidden>
                      ›
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
