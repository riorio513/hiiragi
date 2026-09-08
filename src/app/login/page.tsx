import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  const { next } = await searchParams;

  return (
    <main className="mx-auto max-w-md px-5 pb-16 pt-12">
      <h1 className="text-2xl font-bold">ログイン</h1>
      <p className="mt-2 text-sm text-gray-600">ヒイラギに登録したメールアドレスで入ります。</p>
      <div className="card mt-6">
        <LoginForm next={next ?? ""} />
      </div>
      <p className="mt-6 text-center text-sm text-gray-600">
        はじめての方は{" "}
        <Link href="/signup" className="font-bold text-holly-600 underline">
          アカウント作成
        </Link>
      </p>
    </main>
  );
}
