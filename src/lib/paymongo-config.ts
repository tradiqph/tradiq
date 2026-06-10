/**
 * PayMongo simulator UI (test iframe). Off by default for live payments.
 * Set NEXT_PUBLIC_ENABLE_PAYMONGO_SIMULATOR=true in .env.local to re-enable.
 */
export function isPaymongoSimulatorEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_PAYMONGO_SIMULATOR === "true";
}
