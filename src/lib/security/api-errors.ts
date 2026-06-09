import { NextResponse } from "next/server";

/** Log server-side; return a generic message to clients. */
export function apiError(
  context: string,
  err: unknown,
  status = 500,
  publicMessage = "An unexpected error occurred"
) {
  const detail = err instanceof Error ? err.message : String(err);
  console.error(`[${context}]`, detail);
  return NextResponse.json({ error: publicMessage }, { status });
}

export function apiUnauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function apiBadRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}
