import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 監視処理は Node ランタイムでのみ動かす（fetch と DNS を使うため）
  serverExternalPackages: ["pg"],
};

export default nextConfig;
