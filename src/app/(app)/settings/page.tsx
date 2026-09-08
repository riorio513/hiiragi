import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import SubmitButton from "@/components/SubmitButton";
import { seedDemoAction } from "@/server/actions/demo";
import SettingsForm from "./SettingsForm";
import PasswordForm from "./PasswordForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const settings = await queryOne<{
    quiet_enabled: boolean;
    quiet_start: string;
    quiet_end: string;
    timezone: string;
  }>(
    `select quiet_enabled, quiet_start, quiet_end, timezone
       from hiiragi.user_settings where user_id = $1`,
    [user.id],
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">設定</h1>

      <div className="card">
        <h2 className="text-base font-bold">アカウント</h2>
        <p className="mt-2 text-sm text-gray-600">{user.email}</p>
        <p className="text-xs text-gray-400">
          呼び名：{user.display_name}
          {user.role === "admin" ? "（管理者）" : ""}
        </p>
        <div className="mt-4 border-t border-gray-100 pt-4">
          <h3 className="mb-3 text-sm font-bold text-gray-700">パスワードを変える</h3>
          <PasswordForm />
        </div>
      </div>

      <div className="card">
        <h2 className="text-base font-bold">監視をお休みする時間帯</h2>
        <p className="mt-1 text-sm leading-relaxed text-gray-600">
          寝ている時間など、確認しなくてよい時間帯を決められます。
          この時間帯は確認の間隔を3時間まで広げます（完全には止めません。販売開始予定がある商品は、
          その時間帯でも予定を優先して短い間隔で確認します）。
        </p>
        <div className="mt-4">
          <SettingsForm
            quietEnabled={settings?.quiet_enabled ?? false}
            quietStart={settings?.quiet_start ?? "22:00"}
            quietEnd={settings?.quiet_end ?? "06:00"}
            timezone={settings?.timezone ?? "Asia/Tokyo"}
          />
        </div>
      </div>

      <div className="card space-y-2">
        <h2 className="text-base font-bold">登録したもの</h2>
        <Link href="/stores" className="btn-ghost w-full">
          販売場所を管理する
        </Link>
        <Link href="/accounts" className="btn-ghost w-full">
          公式アカウントを管理する
        </Link>
      </div>

      <div className="card">
        <h2 className="text-base font-bold">使い方を試す</h2>
        <p className="mt-1 text-sm leading-relaxed text-gray-600">
          練習用のデモデータを作ります。このアプリの中にある模擬ショップを監視するので、
          実在の販売サイトには一切アクセスしません。
        </p>
        <form action={seedDemoAction} className="mt-3">
          <SubmitButton className="btn-secondary w-full" pendingLabel="用意しています…">
            デモデータを用意する
          </SubmitButton>
        </form>
      </div>

      <div className="card">
        <h2 className="text-base font-bold">このアプリについて</h2>
        <ul className="mt-2 space-y-1 text-sm text-gray-600">
          <li>・自動購入・自動カート投入・決済の代行は行いません。</li>
          <li>・販売サイトの robots.txt と利用規約に従って確認します。</li>
          <li>・状態が判断できないときは「状態不明」と表示し、在庫なしとは決めつけません。</li>
          <li>・時刻はすべて日本時間（JST）で表示します。</li>
        </ul>
      </div>
    </div>
  );
}
