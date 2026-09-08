import Link from "next/link";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DemoShopPage() {
  const items = await query<{ slug: string; name: string; price: number; in_stock: boolean }>(
    `select slug, name, price, in_stock from hiiragi.demo_shop_items order by slug`,
  );

  return (
    <main className="mx-auto max-w-md px-5 pb-16 pt-8">
      <div className="rounded-xl bg-amber-100 px-3 py-2 text-sm font-bold text-amber-900">
        練習用の模擬ショップです。実在しません。購入はできません。
      </div>
      <h1 className="mt-5 text-2xl font-bold">ヒイラギ練習ショップ（デモ）</h1>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-gray-600">
          まだ商品がありません。ヒイラギの設定画面から「デモデータを用意する」を押してください。
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((i) => (
            <li key={i.slug}>
              <Link href={`/demo/shop/${i.slug}`} className="card block hover:bg-gray-50">
                <p className="font-bold">{i.name}</p>
                <p className="mt-1 text-sm text-gray-600">
                  {i.price.toLocaleString("ja-JP")}円・{i.in_stock ? "在庫あり" : "SOLD OUT"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href="/dashboard" className="btn-ghost mt-6 w-full">
        ヒイラギに戻る
      </Link>
    </main>
  );
}
