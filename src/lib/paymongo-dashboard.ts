import { format } from "date-fns";

const PAYMONGO_API = "https://api.paymongo.com";
const PAYMONGO_PAYOUTS_API = "https://payouts-api.paymongo.com";

export interface PaymongoDashboardData {
  configured: boolean;
  totalBalance: number | null;
  pendingBalance: number | null;
  walletAccountLast4: string | null;
  upcomingPayoutAmount: number | null;
  upcomingPayoutReceiveBy: string | null;
  error?: string;
}

interface PaymongoWalletRecord {
  id?: string;
  merchant_id?: string;
  balance?: {
    available?: number;
    pending?: number;
  };
  account?: {
    account_number?: string;
  };
}

interface PaymongoWalletListResponse {
  data?: PaymongoWalletRecord[];
  errors?: Array<{ detail?: string; code?: string }>;
}

interface PaymongoPayoutLineupItem {
  amount?: number;
  currency?: string;
  receive_at?: number;
}

interface PaymongoScheduleResponse {
  data?: {
    attributes?: {
      lineup?: PaymongoPayoutLineupItem[];
    };
  };
  errors?: Array<{ detail?: string; code?: string }>;
}

function getSecretKey(): string | null {
  const key = process.env.PAYMONGO_SECRET_KEY?.trim();
  return key || null;
}

function getWalletAccountNumber(): string | null {
  const number = process.env.PAYMONGO_WALLET_ACCOUNT_NUMBER?.trim();
  return number || null;
}

function getAuthHeader(secretKey: string): string {
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

function centavosToPeso(centavos: number): number {
  return Math.round(centavos) / 100;
}

function maskAccountLast4(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, "");
  if (digits.length < 4) return "····";
  return `···· ${digits.slice(-4)}`;
}

function parsePaymongoError(body: unknown, fallback: string): string {
  if (
    body &&
    typeof body === "object" &&
    "errors" in body &&
    Array.isArray((body as PaymongoWalletListResponse).errors)
  ) {
    const detail = (body as PaymongoWalletListResponse).errors?.[0]?.detail;
    if (detail) return detail;
  }
  return fallback;
}

async function paymongoFetch<T>(
  url: string,
  secretKey: string
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const res = await fetch(url, {
    headers: { Authorization: getAuthHeader(secretKey) },
    next: { revalidate: 0 },
  });

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: parsePaymongoError(json, `PayMongo request failed (${res.status})`),
    };
  }

  return { ok: true, data: json as T };
}

export async function fetchPaymongoWalletSnapshot(): Promise<
  | {
      availableBalance: number;
      pendingBalance: number;
      accountLast4: string;
      merchantId: string;
    }
  | { error: string }
> {
  const secretKey = getSecretKey();
  const accountNumber = getWalletAccountNumber();
  if (!secretKey || !accountNumber) {
    return { error: "PayMongo wallet not configured" };
  }

  const params = new URLSearchParams({
    account_number: accountNumber,
  });
  params.append("fields", "balance");
  params.append("fields", "account");

  const result = await paymongoFetch<PaymongoWalletListResponse>(
    `${PAYMONGO_API}/v2/wallets?${params.toString()}`,
    secretKey
  );

  if (!result.ok) {
    return { error: result.error };
  }

  const wallets = result.data.data ?? [];
  const wallet =
    wallets.find(
      (item) => item.account?.account_number?.trim() === accountNumber
    ) ?? wallets[0];

  if (!wallet) {
    return { error: "PayMongo wallet not found for configured account number" };
  }

  const merchantId = wallet.merchant_id?.trim();
  if (!merchantId) {
    return { error: "PayMongo wallet response missing merchant ID" };
  }

  const accountNum = wallet.account?.account_number?.trim() ?? accountNumber;
  const available = wallet.balance?.available ?? 0;
  const pending = wallet.balance?.pending ?? 0;

  return {
    availableBalance: centavosToPeso(available),
    pendingBalance: centavosToPeso(pending),
    accountLast4: maskAccountLast4(accountNum),
    merchantId,
  };
}

export async function fetchUpcomingPayout(
  merchantId: string
): Promise<
  | { amount: number; receiveBy: string }
  | { error: string }
  | { empty: true }
> {
  const secretKey = getSecretKey();
  if (!secretKey) {
    return { error: "PayMongo not configured" };
  }

  const result = await paymongoFetch<PaymongoScheduleResponse>(
    `${PAYMONGO_PAYOUTS_API}/v1/merchants/${encodeURIComponent(merchantId)}/schedules`,
    secretKey
  );

  if (!result.ok) {
    return { error: result.error };
  }

  const lineup = result.data.data?.attributes?.lineup ?? [];
  const upcoming = lineup[0];
  if (!upcoming) {
    return { empty: true };
  }

  const amount =
    upcoming.amount != null ? centavosToPeso(upcoming.amount) : null;
  const receiveAt = upcoming.receive_at;

  if (amount == null || receiveAt == null) {
    return { empty: true };
  }

  const receiveBy = format(
    new Date(receiveAt * 1000),
    "EEE, MMM d, yyyy"
  );

  return { amount, receiveBy };
}

export async function getPaymongoDashboardData(): Promise<PaymongoDashboardData> {
  const secretKey = getSecretKey();
  const accountNumber = getWalletAccountNumber();

  if (!secretKey || !accountNumber) {
    return {
      configured: false,
      totalBalance: null,
      pendingBalance: null,
      walletAccountLast4: null,
      upcomingPayoutAmount: null,
      upcomingPayoutReceiveBy: null,
    };
  }

  const walletResult = await fetchPaymongoWalletSnapshot();
  if ("error" in walletResult) {
    return {
      configured: true,
      totalBalance: null,
      pendingBalance: null,
      walletAccountLast4: null,
      upcomingPayoutAmount: null,
      upcomingPayoutReceiveBy: null,
      error: walletResult.error,
    };
  }

  const payoutResult = await fetchUpcomingPayout(walletResult.merchantId);

  let upcomingPayoutAmount: number | null = null;
  let upcomingPayoutReceiveBy: string | null = null;
  let payoutError: string | undefined;

  if ("error" in payoutResult) {
    payoutError = payoutResult.error;
  } else if ("amount" in payoutResult) {
    upcomingPayoutAmount = payoutResult.amount;
    upcomingPayoutReceiveBy = payoutResult.receiveBy;
  }

  return {
    configured: true,
    totalBalance: walletResult.availableBalance,
    pendingBalance: walletResult.pendingBalance,
    walletAccountLast4: walletResult.accountLast4,
    upcomingPayoutAmount,
    upcomingPayoutReceiveBy,
    ...(payoutError ? { error: payoutError } : {}),
  };
}
