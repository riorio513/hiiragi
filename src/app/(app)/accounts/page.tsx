import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { platformLabel } from "@/lib/types";
import SubmitButton from "@/components/SubmitButton";
import { deleteAccountAction } from "@/server/actions/catalog";
import AccountForm from "./AccountForm";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const user = await requireUser();
  const [accounts, stores] = await Promise.all([
    query<{
      id: string;
      name: string;
      url: string;
      platform: string;
      is_official: boolean;
      note: string;
      store_name: string | null;
    }>(
      `select a.id, a.name, a.url, a.platform, a.is_official, a.note, s.name as store_name
         from hiiragi.official_accounts a
         left join hiiragi.stores s on s.id = a.store_id
        where a.user_id = $1 order by a.name`,
      [user.id],
    ),
    query<{ id: string; name: string }>(
      `select id, name from hiiragi.stores where user_id = $1 and is_active order by name`,
      [user.id],
    ),
  ]);

  return (
    <div className="space-y-4">
      <Link href="/settings" className="text-sm text-gray-500 underline">
        ← 設定に戻る
      </Link>
      <h1 className="text-xl font-bold">公式アカウント</h1>
      <p className="text-sm leading-relaxed text-gray-600">
        販売開始の告知が出るSNSアカウントを控えておく場所です。
        投稿の自動取得は行いません（無料の範囲で確実に動かすため）。商品ページから素早く開くための入口として使います。
      </p>

      <div className="card">
        <h2 className="mb-3 text-base font-bold">アカウントを追加する</h2>
        <AccountForm stores={stores} />
      </div>

      <ul className="space-y-3">
        {accounts.map((a) => (
          <li key={a.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip bg-gray-100 text-gray-600">
                    {platformLabel(a.platform)}
                  </span>
                  {a.is_official && <span className="chip bg-holly-100 text-holly-700">公式</span>}
                  {a.store_name && (
                    <span className="chip bg-gray-100 text-gray-600">{a.store_name}</span>
                  )}
                </div>
                <p className="mt-2 font-bold">{a.name}</p>
                {a.url && (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="break-all text-xs text-holly-600 underline"
                  >
                    {a.url}
                  </a>
                )}
                {a.note && <p className="mt-1 text-sm text-gray-600">{a.note}</p>}
              </div>
              <form action={deleteAccountAction}>
                <input type="hidden" name="accountId" value={a.id} />
                <SubmitButton className="btn-danger" pendingLabel="…" confirm="削除しますか？">
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
