import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import path from "node:path";

config({ path: path.resolve(process.cwd(), "../../.env") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("[CONFIG_MISSING] DATABASE_URL이 루트 .env에 설정되어 있지 않습니다.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
