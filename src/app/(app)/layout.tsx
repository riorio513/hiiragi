import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { signOutAction } from "@/server/actions/auth";
import SubmitButton from "@/components/SubmitButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const unread = await queryOne<{ count: string }>(
    `select count(*)::text as count from hiiragi.notifications where user_id = $1 and not is_read`,
    [user.id],
  );
  const unreadCount = Number(unread?.count ?? "0");

  return (
    <div className="min-h-dvh pb-20">
      <header className="sticky top-0 z-10 border-b border-black/5 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="text-lg font-bold text-holly-700">
            ヒイラギ
          </Link>
          <div className="flex items-center gap-3">
            <span className="max-w-28 truncate text-xs text-gray-500">{user.display_name}</span>
            {user.role === "admin" && (
              <Link href="/admin" className="text-xs font-bold text-holly-600 underline">
                管理
              </Link>
            )}
            <form action={signOutAction}>
              <SubmitButton className="text-xs font-bold text-gray-500 underline" pendingLabel="…">
                ログアウト
              </SubmitButton>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-5">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-black/5 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl">
          <NavItem href="/dashboard" label="ホーム" icon="🏠" />
          <NavItem href="/products/new" label="商品を追加" icon="＋" />
          <NavItem href="/notifications" label="通知" icon="🔔" badge={unreadCount} />
          <NavItem href="/settings" label="設定" icon="⚙️" />
        </div>
      </nav>
    </div>
  );
}

function NavItem({
  href,
  label,
  icon,
  badge = 0,
}: {
  href: string;
  label: string;
  icon: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold text-gray-600 hover:text-holly-700"
    >
      <span className="text-lg leading-none" aria-hidden>
        {icon}
      </span>
      {label}
      {badge > 0 && (
        <span className="absolute right-1/2 top-1 translate-x-4 rounded-full bg-berry-500 px-1.5 text-[10px] leading-4 text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}
