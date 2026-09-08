import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { dateTime, relative, yen } from "@/lib/format";
import { STOCK_LABEL, type StockStatus } from "@/lib/types";
import SubmitButton from "@/components/SubmitButton";
import {
  createInviteAction,
  reactivateTargetAction,
  runMonitorNowAction,
} from "@/server/actions/admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();

  const [counts] = await query<{
    users: string;
    products: string;
    stores: string;
    accounts: string;
    targets: string;
    active_targets: string;
    notifications: string;
  }>(
    `select (select count(*) from hiiragi.users)::text as users,
            (select count(*) from hiiragi.products)::text as products,
            (select count(*) from hiiragi.stores)::text as stores,
            (select count(*) from hiiragi.official_accounts)::text as accounts,
            (select count(*) from hiiragi.monitor_targets)::text as targets,
            (select count(*) from hiiragi.monitor_targets where is_active)::text as active_targets,
            (select count(*) from hiiragi.notifications)::text as notifications`,
  );

  const users = await query<{
    id: string;
    email: string;
    display_name: string;
    role: string;
    is_active: boolean;
    created_at: Date;
    last_login_at: Date | null;
    products: string;
  }>(
    `select u.id, u.email, u.display_name, u.role, u.is_active, u.created_at, u.last_login_at,
            (select count(*)::text from hiiragi.products p where p.user_id = u.id) as products
       from hiiragi.users u order by u.created_at`,
  );

  const targets = await query<{
    id: string;
    url: string;
    host: string;
    adapter: string;
    is_active: boolean;
    disabled_reason: string | null;
    last_status: StockStatus | null;
    last_price: number | null;
    last_checked_at: Date | null;
    next_check_at: Date;
    consecutive_errors: number;
    last_error_message: string | null;
    watchers: string;
  }>(
    `select t.id, t.url, t.host, t.adapter, t.is_active, t.disabled_reason, t.last_status,
            t.last_price, t.last_checked_at, t.next_check_at, t.consecutive_errors,
            t.last_error_message,
            (select count(*)::text from hiiragi.product_urls pu where pu.target_id = t.id) as watchers
       from hiiragi.monitor_targets t
      order by (t.consecutive_errors > 0) desc, t.next_check_at`,
  );

  const runs = await query<{
    id: string;
    started_at: Date;
    finished_at: Date | null;
    checked: number;
    errors: number;
    notified: number;
    source: string;
  }>(
    `select id, started_at, finished_at, checked, errors, notified, source
       from hiiragi.monitor_runs order by started_at desc limit 10`,
  );

  const invites = await query<{ code: string; note: string; used_count: number; max_uses: number; expires_at: Date | null }>(
    `select code, note, used_count, max_uses, expires_at from hiiragi.invites order by created_at desc limit 10`,
  );

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">管理画面</h1>

      <div className="card grid grid-cols-3 gap-3 text-center text-sm">
        <Stat label="利用者" value={counts.users} />
        <Stat label="商品" value={counts.products} />
        <Stat label="店舗" value={counts.stores} />
        <Stat label="公式アカウント" value={counts.accounts} />
        <Stat label="監視対象" value={`${counts.active_targets}/${counts.targets}`} />
        <Stat label="通知" value={counts.notifications} />
      </div>

      <form action={runMonitorNowAction}>
        <SubmitButton className="btn-primary w-full" pendingLabel="監視中…">
          いますぐ監視を1回まわす
        </SubmitButton>
      </form>

      <section>
        <h2 className="mb-2 text-lg font-bold">利用者</h2>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-xs text-gray-500">
              <tr>
                <th className="py-1 pr-3">メール</th>
                <th className="py-1 pr-3">権限</th>
                <th className="py-1 pr-3">商品</th>
                <th className="py-1 pr-3">最終ログイン</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-gray-100">
                  <td className="py-1.5 pr-3">{u.email}</td>
                  <td className="py-1.5 pr-3">{u.role === "admin" ? "管理者" : "利用者"}</td>
                  <td className="py-1.5 pr-3">{u.products}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap">{relative(u.last_login_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">監視対象</h2>
        <ul className="space-y-2">
          {targets.map((t) => (
            <li key={t.id} className="card text-sm">
              <p className="break-all font-bold">{t.url}</p>
              <p className="mt-1 text-xs text-gray-500">
                {t.adapter}／見ている人 {t.watchers}／
                {t.is_active ? "有効" : `無効（${t.disabled_reason ?? "理由なし"}）`}
              </p>
              <p className="mt-1">
                {t.last_status ? STOCK_LABEL[t.last_status] : "未確認"}・{yen(t.last_price)}・最終
                {relative(t.last_checked_at)}・次回 {dateTime(t.next_check_at)}
              </p>
              {t.consecutive_errors > 0 && (
                <p className="mt-1 text-amber-700">
                  連続エラー {t.consecutive_errors}回：{t.last_error_message ?? "—"}
                </p>
              )}
              {!t.is_active && (
                <form action={reactivateTargetAction} className="mt-2">
                  <input type="hidden" name="targetId" value={t.id} />
                  <SubmitButton className="btn-ghost" pendingLabel="…">
                    監視を再開する
                  </SubmitButton>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">監視の実行状況</h2>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="text-xs text-gray-500">
              <tr>
                <th className="py-1 pr-3">開始</th>
                <th className="py-1 pr-3">きっかけ</th>
                <th className="py-1 pr-3">確認</th>
                <th className="py-1 pr-3">エラー</th>
                <th className="py-1 pr-3">通知</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="py-1.5 pr-3 whitespace-nowrap">{dateTime(r.started_at)}</td>
                  <td className="py-1.5 pr-3">{r.source}</td>
                  <td className="py-1.5 pr-3">{r.checked}</td>
                  <td className="py-1.5 pr-3">{r.errors}</td>
                  <td className="py-1.5 pr-3">{r.notified}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">招待コード</h2>
        <div className="card space-y-3">
          <form action={createInviteAction} className="flex gap-2">
            <input name="note" className="field" placeholder="だれに渡すか（メモ）" />
            <SubmitButton className="btn-secondary shrink-0">作る</SubmitButton>
          </form>
          {invites.length === 0 ? (
            <p className="text-sm text-gray-600">まだありません。</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {invites.map((i) => (
                <li key={i.code} className="flex justify-between gap-2">
                  <span className="font-mono">{i.code}</span>
                  <span className="text-xs text-gray-500">
                    {i.note || "—"}／{i.used_count}/{i.max_uses}使用／期限 {dateTime(i.expires_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="hint">
            招待コードは、環境変数 SIGNUP_INVITE_REQUIRED を 1 にしたときだけ必要になります。
          </p>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-2 py-3">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
