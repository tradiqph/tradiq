export function userHasSecurityPin(
  data: { hasSecurityPin?: boolean; securityPinHash?: string | null } | null | undefined
): boolean {
  if (!data) return false;
  return data.hasSecurityPin === true || Boolean(data.securityPinHash);
}
