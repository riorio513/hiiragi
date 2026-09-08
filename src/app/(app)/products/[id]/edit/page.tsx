import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { toLocalInputValue } from "@/lib/format";
import EditProductForm from "./EditProductForm";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const product = await queryOne<{
    id: string;
    name: string;
    description: string;
    image_url: string;
    target_price: number | null;
    sale_starts_at: Date | null;
    sale_ends_at: Date | null;
    sale_note: string;
  }>(
    `select id, name, description, image_url, target_price, sale_starts_at, sale_ends_at, sale_note
       from hiiragi.products where id = $1 and user_id = $2`,
    [id, user.id],
  );
  if (!product) notFound();

  // 現在時刻はデータベースから受け取る（画面の描画中に時計を読まないため）
  const clock = await queryOne<{ now: Date }>(`select now() as now`);
  const nowMs = clock ? new Date(clock.now).getTime() : 0;

  return (
    <div className="space-y-4">
      <Link href={`/products/${product.id}`} className="text-sm text-gray-500 underline">
        ← 商品に戻る
      </Link>
      <h1 className="text-xl font-bold">商品を編集する</h1>
      <div className="card">
        <EditProductForm
          nowMs={nowMs}
          product={{
            ...product,
            sale_starts_at: toLocalInputValue(product.sale_starts_at),
            sale_ends_at: toLocalInputValue(product.sale_ends_at),
          }}
        />
      </div>
    </div>
  );
}
