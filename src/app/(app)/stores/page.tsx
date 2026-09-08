import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { storeKindLabel } from "@/lib/types";
import SubmitButton from "@/components/SubmitButton";
import { deleteStoreAction } from "@/server/actions/catalog";
import StoreForm from "./StoreForm";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  const user = await requireUser();
  const stores = await query<{
    id: string;
    name: string;
    url: string;
    kind: string;
    is_official: boolean;
    is_active: boolean;
    note: string;
    url_count: string;
  }>(
    `select s.id, s.name, s.url, s.kind, s.is_official, s.is_active, s.note,
            (select count(*)::text from hiiragi.product_urls pu where pu.store_id = s.id) as url_count
       from hiiragi.stores s where s.user_id = $1 order by s.name`,
    [user.id],
  );

  return (
    <div className="space-y-4">
      <Link href="/settings" className="text-sm text-gray-500 underline">
        ← 設定に戻る
      </Link>
      <h1 className="text-xl font-bold">販売場所</h1>
      <p className="text-sm leading-relaxed text-gray-600">
        商品ページを登録すると、そのドメイン名で自動的に作られます。分かりやすい名前に直しておくと、
        通知に店舗名として表示されます。
      </p>

      <div className="card">
        <h2 className="mb-3 text-base font-bold">販売場所を追加する</h2>
        <StoreForm />
      </div>

      <ul className="space-y-3">
        {stores.map((s) => (
          <li key={s.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip bg-gray-100 text-gray-600">{storeKindLabel(s.kind)}</span>
                  {s.is_official && <span className="chip bg-holly-100 text-holly-700">公式</span>}
                  {!s.is_active && <span className="chip bg-gray-100 text-gray-500">無効</span>}
                </div>
                <p className="mt-2 font-bold">{s.name}</p>
                {s.url && (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="break-all text-xs text-holly-600 underline"
                  >
                    {s.url}
                  </a>
                )}
                {s.note && <p className="mt-1 text-sm text-gray-600">{s.note}</p>}
                <p className="mt-1 text-xs text-gray-400">
                  この店舗に紐づく商品ページ：{s.url_count}件
                </p>
              </div>
              <form action={deleteStoreAction}>
                <input type="hidden" name="storeId" value={s.id} />
                <SubmitButton
                  className="btn-danger"
                  pendingLabel="…"
                  confirm="この販売場所を削除します（商品ページの監視は残ります）。よろしいですか？"
                >
                  削除
                </SubmitButton>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
