import { config } from "dotenv";
import type { NextConfig } from "next";
import path from "node:path";

// 모노레포 단일 루트 .env 로드
config({ path: path.resolve(process.cwd(), "../../.env") });

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/db", "@repo/types", "@repo/ui"],
  serverExternalPackages: ["pg", "sharp"],
  experimental: {
    viewTransition: true,
  },
};

export default nextConfig;
