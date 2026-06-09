import { UserRole } from "@/types";

const ADMIN_ROLES: UserRole[] = ["admin", "super_admin"];

export function isAdminRole(role?: string | null): boolean {
  return ADMIN_ROLES.includes(role as UserRole);
}

export function isSuperAdminRole(role?: string | null): boolean {
  return role === "super_admin";
}
