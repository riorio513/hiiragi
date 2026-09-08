import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import SignupForm from "./SignupForm";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  const { invite } = await searchParams;
  const inviteRequired = process.env.SIGNUP_INVITE_REQUIRED === "1";

  return (
    <main className="mx-auto max-w-md px-5 pb-16 pt-12">
      <h1 className="text-2xl font-bold">アカウント作成</h1>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">
        メールアドレスとパスワードだけで作れます。メールの受信確認は不要です。
      </p>
      <div className="card mt-6">
        <SignupForm invite={invite ?? ""} inviteRequired={inviteRequired} />
      </div>
      <p className="mt-6 text-center text-sm text-gray-600">
        すでにお持ちの方は{" "}
        <Link href="/login" className="font-bold text-holly-600 underline">
          ログイン
        </Link>
      </p>
    </main>
  );
}
