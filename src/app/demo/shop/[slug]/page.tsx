import Link from "next/link";
import { notFound } from "next/navigation";
import { queryOne } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import SubmitButton from "@/components/SubmitButton";
import { toggleDemoStockAction } from "@/server/actions/demo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await queryOne<{ name: string }>(
    `select name from hiiragi.demo_shop_items where slug = $1`,
    [slug],
  );
  return { title: item ? `${item.name}｜ヒイラギ練習ショップ（デモ）` : "デモ" };
}

/**
 * 練習用の「模擬ショップ」ページ。実在しない商品を、実在しないお店が売っている体で表示する。
 * 監視処理はこのページを本物の販売ページと同じ手順で読みに来る（JSON-LDとボタン文言）。
 * 購入導線は置かない。
 */
export default async function DemoItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await queryOne<{
    slug: string;
    name: string;
    price: number;
    in_stock: boolean;
    updated_at: Date;
  }>(`select slug, name, price, in_stock, updated_at from hiiragi.demo_shop_items where slug = $1`, [
    slug,
  ]);
  if (!item) notFound();

  const user = await getCurrentUser();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: item.name,
    offers: {
      "@type": "Offer",
      price: item.price,
      priceCurrency: "JPY",
      availability: item.in_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <main className="mx-auto max-w-md px-5 pb-16 pt-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="rounded-xl bg-amber-100 px-3 py-2 text-sm font-bold text-amber-900">
        これは練習用の模擬ページです。実在の商品・お店ではなく、ここから購入はできません。
      </div>

      <h1 className="mt-5 text-2xl font-bold">{item.name}</h1>
      <p className="mt-2 text-3xl font-bold">{item.price.toLocaleString("ja-JP")}円</p>
      <p className="mt-2 text-sm text-gray-600">ヒイラギ練習ショップ（デモ）</p>

      <div className="mt-6">
        {item.in_stock ? (
          <button type="button" className="btn-primary w-full" disabled>
            カートに入れる（練習用のため押せません）
          </button>
        ) : (
          <button type="button" className="btn-ghost w-full" disabled>
            SOLD OUT
          </button>
        )}
      </div>

      {user && (
        <div className="card mt-8">
          <h2 className="text-base font-bold">練習用の操作</h2>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">
            在庫を切り替えると、その場で監視が1回走ります。
            「在庫なし → 在庫あり」に切り替えると、ヒイラギの通知に届きます。
          </p>
          <form action={toggleDemoStockAction} className="mt-3">
            <input type="hidden" name="slug" value={item.slug} />
            <SubmitButton className="btn-secondary w-full" pendingLabel="切り替えています…">
              {item.in_stock ? "在庫なしにする" : "在庫ありにする（通知が届きます）"}
            </SubmitButton>
          </form>
          <Link href="/notifications" className="btn-ghost mt-2 w-full">
            通知を見る
          </Link>
        </div>
      )}
    </main>
  );
}
