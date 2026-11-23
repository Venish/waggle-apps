import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index";

export type WaggleDb = NodePgDatabase<typeof schema>;

interface GlobalDbCache {
  __wagglePgPool?: Pool;
  __waggleDb?: WaggleDb;
}

const globalForDb = globalThis as unknown as GlobalDbCache;

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "[CONFIG_MISSING] DATABASE_URL 환경변수가 비어 있습니다. 루트 .env를 확인하세요.",
    );
  }
  return url;
}

export function getPool(): Pool {
  if (!globalForDb.__wagglePgPool) {
    globalForDb.__wagglePgPool = new Pool({
      connectionString: requireDatabaseUrl(),
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return globalForDb.__wagglePgPool;
}

export function getDb(): WaggleDb {
  if (!globalForDb.__waggleDb) {
    globalForDb.__waggleDb = drizzle(getPool(), { schema });
  }
  return globalForDb.__waggleDb;
}

export interface DbPingResult {
  connected: boolean;
  database: string;
  user: string;
  version: string;
  latencyMs: number;
}

export async function pingDatabase(): Promise<DbPingResult> {
  const startedAt = Date.now();
  const result = await getPool().query<{
    database: string;
    user: string;
    version: string;
  }>("SELECT current_database() AS database, current_user AS user, version() AS version");

  const row = result.rows[0];
  if (!row) {
    throw new Error("PostgreSQL ping 쿼리가 빈 결과를 반환했습니다.");
  }

  return {
    connected: true,
    database: row.database,
    user: row.user,
    version: row.version,
    latencyMs: Date.now() - startedAt,
  };
}
