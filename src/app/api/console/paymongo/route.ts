import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/console/require-super-admin";
import {
  getPaymongoDashboardData,
  type PaymongoDashboardData,
} from "@/lib/paymongo-dashboard";

const CACHE_TTL_MS = 60_000;

let cachedPayload: PaymongoDashboardData | null = null;
let cachedAt = 0;

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const now = Date.now();
  if (cachedPayload && now - cachedAt < CACHE_TTL_MS) {
    return NextResponse.json(cachedPayload);
  }

  try {
    const data = await getPaymongoDashboardData();
    cachedPayload = data;
    cachedAt = now;
    return NextResponse.json(data);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load PayMongo dashboard data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
