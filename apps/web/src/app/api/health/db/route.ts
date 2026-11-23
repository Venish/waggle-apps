import { NextResponse } from "next/server";
import { pingDatabase } from "@repo/db";
import { getServerEnv } from "@/00_lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    getServerEnv();
    const db = await pingDatabase();
    return NextResponse.json({
      ok: true,
      data: db,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error";
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message,
        },
      },
      { status: 500 },
    );
  }
}
