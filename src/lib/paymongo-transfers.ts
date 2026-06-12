import {
  normalizeInstapayAccountNumber,
  resolveInstapayBankName,
  type InstapayAccountSnapshot,
} from "@/lib/console/instapay-banks";
import { getAppBaseUrl } from "@/lib/app-url";

const PAYMONGO_V1 = "https://api.paymongo.com/v1";
const PAYMONGO_V2 = "https://api.paymongo.com/v2";
const PAYMONGO_WALLET_BIC = "PAEYPHM2XXX";
export const PAYMONGO_TRANSFER_DESCRIPTION = "TradIQ Withdrawal";
const INSTAPAY_MAX_CENTAVOS = 50_000 * 100;

export type PaymongoTransferStatus = "pending" | "succeeded" | "failed";

export interface ReceivingInstitution {
  name: string;
  providerCode: string;
}

function getSecretKey(): string {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) throw new Error("Paymongo not configured");
  return key;
}

function getAuthHeader(secretKey: string): string {
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

function normalizeInstitutionName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function matchInstitutionByName(
  institutions: ReceivingInstitution[],
  bankName: string
): string | null {
  const target = normalizeInstitutionName(bankName);
  if (!target) return null;

  const exact = institutions.find(
    (inst) => normalizeInstitutionName(inst.name) === target
  );
  if (exact) return exact.providerCode;

  const partial = institutions.find((inst) => {
    const normalized = normalizeInstitutionName(inst.name);
    return normalized.includes(target) || target.includes(normalized);
  });
  return partial?.providerCode ?? null;
}

export async function fetchReceivingInstitutions(): Promise<ReceivingInstitution[]> {
  const res = await fetch(
    `${PAYMONGO_V1}/wallets/receiving_institutions?provider=instapay`,
    { headers: { Authorization: getAuthHeader(getSecretKey()) } }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Receiving institutions lookup failed: ${err}`);
  }

  const json = (await res.json()) as {
    data?: Array<{
      attributes?: { name?: string; provider_code?: string };
    }>;
  };

  return (json.data ?? [])
    .map((item) => ({
      name: item.attributes?.name?.trim() ?? "",
      providerCode: item.attributes?.provider_code?.trim() ?? "",
    }))
    .filter((item) => item.name && item.providerCode);
}

export async function resolveDestinationBic(
  account: InstapayAccountSnapshot
): Promise<string> {
  if (account.accountType === "Bank Account" && account.bankName === "Other") {
    throw new Error(
      'Bank "Other" is not supported for API payout — use InstaPay export or add a mapped bank'
    );
  }

  const bankName = resolveInstapayBankName(account);
  const institutions = await fetchReceivingInstitutions();
  const bic = matchInstitutionByName(institutions, bankName);

  if (!bic) {
    throw new Error(
      `No PayMongo institution found for "${bankName}". Use InstaPay export or add a bank mapping.`
    );
  }

  return bic;
}

export function getPaymongoTransferCallbackUrl(): string {
  return `${getAppBaseUrl()}/api/paymongo/webhook`;
}

export async function createInstapayTransfer(params: {
  centavos: number;
  accountName: string;
  accountNumber: string;
  bic: string;
  callbackUrl?: string;
}): Promise<{ transferId: string; status: PaymongoTransferStatus }> {
  const walletNumber = process.env.PAYMONGO_WALLET_ACCOUNT_NUMBER?.trim();
  const walletName = process.env.PAYMONGO_WALLET_ACCOUNT_NAME?.trim();
  if (!walletNumber || !walletName) {
    throw new Error(
      "PayMongo wallet not configured (PAYMONGO_WALLET_ACCOUNT_NUMBER / PAYMONGO_WALLET_ACCOUNT_NAME)"
    );
  }

  if (params.centavos <= 0) {
    throw new Error("Payout amount must be positive");
  }
  if (params.centavos > INSTAPAY_MAX_CENTAVOS) {
    throw new Error("Payout exceeds InstaPay per-transaction limit of ₱50,000");
  }

  const accountNumber = normalizeInstapayAccountNumber(params.accountNumber);
  const accountName = params.accountName.trim();
  if (!accountNumber || !accountName) {
    throw new Error("Recipient account name and number are required");
  }

  const res = await fetch(`${PAYMONGO_V2}/batch_transfers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(getSecretKey()),
    },
    body: JSON.stringify({
      transfers: [
        {
          source_account: {
            number: walletNumber,
            name: walletName,
            bic: PAYMONGO_WALLET_BIC,
          },
          destination_account: {
            number: accountNumber,
            name: accountName,
            bic: params.bic,
          },
          amount: params.centavos,
          currency: "PHP",
          provider: "instapay",
          description: PAYMONGO_TRANSFER_DESCRIPTION,
          callback_url: params.callbackUrl ?? getPaymongoTransferCallbackUrl(),
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayMongo transfer failed: ${err}`);
  }

  const json = (await res.json()) as {
    data?: { transfers?: Array<{ id?: string; status?: string }> };
    transfers?: Array<{ id?: string; status?: string }>;
  };

  const transfer = json.data?.transfers?.[0] ?? json.transfers?.[0];
  if (!transfer?.id) {
    throw new Error("PayMongo transfer response missing transfer id");
  }

  const status = (transfer.status ?? "pending") as PaymongoTransferStatus;
  return { transferId: transfer.id, status };
}

export async function getTransferStatus(transferId: string): Promise<{
  status: PaymongoTransferStatus;
  failureMessage?: string;
}> {
  const res = await fetch(`${PAYMONGO_V2}/transfers/${transferId}`, {
    headers: { Authorization: getAuthHeader(getSecretKey()) },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Transfer status lookup failed: ${err}`);
  }

  const json = (await res.json()) as {
    data?: {
      status?: string;
      failure?: { message?: string };
      failure_message?: string;
    };
    status?: string;
    failure?: { message?: string };
    failure_message?: string;
  };

  const transfer = json.data ?? json;
  const status = (transfer.status ?? "pending") as PaymongoTransferStatus;
  const failureMessage =
    transfer.failure?.message ??
    transfer.failure_message ??
    undefined;

  return { status, failureMessage };
}
