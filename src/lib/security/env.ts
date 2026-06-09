export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function requireAdminInProduction(): boolean {
  return isProduction();
}
