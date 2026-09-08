import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import NewProductForm from "./NewProductForm";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const user = await requireUser();
  const stores = await query<{ id: string; name: string }>(
    `select id, name from hiiragi.stores where user_id = $1 and is_active order by name`,
    [user.id],
  );

  return (
    <div className="space-y-4">
      <Link href="/dashboard" className="text-sm text-gray-500 underline">
        ← ホームに戻る
      </Link>
      <h1 className="text-xl font-bold">商品を追加する</h1>
      <p className="text-sm leading-relaxed text-gray-600">
        商品名だけでも登録できます。販売ページのURLを一緒に貼ると、その場で1回目の確認まで行います。
      </p>
      <div className="card">
        <NewProductForm stores={stores} />
      </div>
    </div>
  );
}
