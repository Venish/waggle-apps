import { config } from "dotenv";
import path from "node:path";
import { getPool, pingDatabase } from "./client";

config({ path: path.resolve(process.cwd(), "../../.env") });

async function main() {
  try {
    const info = await pingDatabase();
    console.log(
      `[OK] PostgreSQL connected: db=${info.database}, user=${info.user}, latency=${info.latencyMs}ms`,
    );
    console.log(`     ${info.version}`);
  } finally {
    await getPool().end();
  }
}

main().catch((error: unknown) => {
  console.error("[FAIL] PostgreSQL ping failed:", error);
  process.exit(1);
});
