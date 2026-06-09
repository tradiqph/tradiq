export type WithdrawalAccountType = "GCash" | "Maya" | "Bank Account";

export type WithdrawalAccountCategory = "ewallet" | "bank";

export interface WithdrawalAccountTypeConfig {
  value: WithdrawalAccountType;
  label: string;
  category: WithdrawalAccountCategory;
  numberLabel: string;
  placeholder: string;
  hint: string;
  /** Exact length for e-wallets */
  digits?: number;
  /** Inclusive range for bank account numbers */
  minDigits?: number;
  maxDigits?: number;
  requiresBank: boolean;
}

export const PH_BANKS = [
  "BDO Unibank",
  "BPI",
  "Metrobank",
  "Landbank",
  "PNB",
  "Security Bank",
  "UnionBank",
  "RCBC",
  "China Bank",
  "EastWest Bank",
  "PSBank",
  "Robinsons Bank",
  "GoTyme",
  "Maribank",
  "Other",
] as const;

export type PhilippineBank = (typeof PH_BANKS)[number];

export const WITHDRAWAL_ACCOUNT_TYPES: WithdrawalAccountTypeConfig[] = [
  {
    value: "GCash",
    label: "GCash",
    category: "ewallet",
    digits: 11,
    numberLabel: "Mobile Number",
    placeholder: "09XX XXX XXXX",
    hint: "11-digit Philippine mobile number starting with 09",
    requiresBank: false,
  },
  {
    value: "Maya",
    label: "Maya",
    category: "ewallet",
    digits: 11,
    numberLabel: "Mobile Number",
    placeholder: "09XX XXX XXXX",
    hint: "11-digit Philippine mobile number starting with 09",
    requiresBank: false,
  },
  {
    value: "Bank Account",
    label: "Bank Account (Debit)",
    category: "bank",
    minDigits: 10,
    maxDigits: 12,
    numberLabel: "Account Number",
    placeholder: "Enter bank account number",
    hint: "10–12 digit account number from your bank",
    requiresBank: true,
  },
];

/** Legacy types saved before this update */
const LEGACY_TYPE_ALIASES: Record<string, WithdrawalAccountType> = {
  "Debit Card": "Bank Account",
  "Credit Card": "Bank Account",
};

export function getAccountTypeConfig(
  accountType: string
): WithdrawalAccountTypeConfig | undefined {
  const normalized = LEGACY_TYPE_ALIASES[accountType] ?? accountType;
  return WITHDRAWAL_ACCOUNT_TYPES.find((t) => t.value === normalized);
}

export function stripAccountNumber(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatAccountNumber(
  accountType: string,
  raw: string
): string {
  const digits = stripAccountNumber(raw);
  const config = getAccountTypeConfig(accountType);
  if (!config) return digits;

  if (config.category === "ewallet") {
    if (digits.length <= 4) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 11)}`;
  }

  return digits;
}

export function validateAccountNumber(
  accountType: string,
  accountNumber: string
): string | null {
  const config = getAccountTypeConfig(accountType);
  if (!config) return "Invalid account type";

  const digits = stripAccountNumber(accountNumber);

  if (config.category === "ewallet") {
    if (digits.length !== config.digits) {
      return `${config.numberLabel} must be exactly ${config.digits} digits`;
    }
    if (!digits.startsWith("09")) {
      return "Philippine mobile numbers must start with 09";
    }
    return null;
  }

  const min = config.minDigits ?? 10;
  const max = config.maxDigits ?? 12;
  if (digits.length < min || digits.length > max) {
    return `${config.numberLabel} must be ${min}–${max} digits`;
  }

  return null;
}

export function validateBankName(
  accountType: string,
  bankName?: string
): string | null {
  const config = getAccountTypeConfig(accountType);
  if (!config?.requiresBank) return null;
  if (!bankName?.trim()) return "Bank name is required";
  return null;
}

export function validateWithdrawalAccount(data: {
  accountType: string;
  accountNumber: string;
  bankName?: string;
}): string | null {
  const bankError = validateBankName(data.accountType, data.bankName);
  if (bankError) return bankError;
  return validateAccountNumber(data.accountType, data.accountNumber);
}

export function maskAccountNumber(
  accountType: string,
  accountNumber: string
): string {
  const digits = stripAccountNumber(accountNumber);
  const config = getAccountTypeConfig(accountType);

  if (!config || digits.length < 4) return accountNumber;

  if (config.category === "ewallet") {
    return `${digits.slice(0, 4)} ••• ${digits.slice(-4)}`;
  }

  return `••••${digits.slice(-4)}`;
}

export function normalizeAccountNumber(accountNumber: string): string {
  return stripAccountNumber(accountNumber);
}

export function getDigitProgress(
  accountType: string,
  accountNumber: string
): { current: number; label: string; complete: boolean } {
  const config = getAccountTypeConfig(accountType);
  const current = stripAccountNumber(accountNumber).length;

  if (!config) return { current, label: "", complete: false };

  if (config.digits) {
    return {
      current,
      label: `${current}/${config.digits}`,
      complete: current === config.digits,
    };
  }

  const min = config.minDigits ?? 10;
  const max = config.maxDigits ?? 12;
  return {
    current,
    label: `${current} (${min}–${max})`,
    complete: current >= min && current <= max,
  };
}
