import { isSuperAdminRole } from "@/lib/roles";

/** Only this account may credit cash deposits and deposit bonuses in the console. */
export const CASH_DEPOSIT_OPERATOR_EMAIL = "oxfordgalawan@gmail.com";

const CASH_DEPOSIT_MAX_AMOUNT = 1_000_000;

export function isCashDepositOperator(email?: string | null): boolean {
  return (
    email?.trim().toLowerCase() === CASH_DEPOSIT_OPERATOR_EMAIL.toLowerCase()
  );
}

/** Console UI + API gate for credit deposit / credit bonus actions. */
export function canUseCashDepositFeatures(params: {
  email?: string | null;
  role?: string | null;
}): boolean {
  return (
    isSuperAdminRole(params.role) && isCashDepositOperator(params.email)
  );
}

export function validateAdminCashDepositAmount(amount: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) {
    return "Enter a valid amount";
  }
  if (amount > CASH_DEPOSIT_MAX_AMOUNT) {
    return "Amount exceeds maximum";
  }
  return null;
}
