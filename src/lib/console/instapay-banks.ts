/** PayMongo InstaPay template bank names (Banks sheet). */
export const INSTAPAY_GCASH = "G-Xchange, Inc.";
export const INSTAPAY_MAYA = "Maya Philippines, Inc.";

const TRADIQ_BANK_TO_INSTAPAY: Record<string, string> = {
  "BDO Unibank": "BDO Unibank, Inc.",
  BPI: "Bank of the Philippine Islands / BPI Family",
  Metrobank: "Metropolitan Bank and Trust Company",
  Landbank: "Land Bank of The Philippines",
  PNB: "Philippine National Bank",
  "Security Bank": "Security Bank Corporation",
  UnionBank: "Union Bank of the Philippines",
  RCBC: "Rizal Commercial Banking Corporation",
  "China Bank": "China Banking Corporation",
  "EastWest Bank": "East West Banking Corporation",
  PSBank: "Philippine Savings Bank",
  "Robinsons Bank": "Robinsons Bank Corporation",
  GoTyme: "GoTyme Bank Corporation",
  Maribank: "MariBank Philippines, Inc.",
};

export interface InstapayAccountSnapshot {
  accountType: string;
  accountNumber: string;
  accountName: string;
  bankName?: string;
}

export function resolveInstapayBankName(account: InstapayAccountSnapshot): string {
  const type = account.accountType.trim();

  if (type === "GCash") return INSTAPAY_GCASH;
  if (type === "Maya") return INSTAPAY_MAYA;

  if (account.bankName) {
    const mapped = TRADIQ_BANK_TO_INSTAPAY[account.bankName];
    if (mapped) return mapped;
  }

  return account.bankName?.trim() || type;
}

export function normalizeInstapayAccountNumber(accountNumber: string): string {
  return accountNumber.replace(/\D/g, "");
}
