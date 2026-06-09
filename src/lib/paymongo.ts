import crypto from "crypto";

const PAYMONGO_API = "https://api.paymongo.com/v1";

function getAuthHeader(secretKey: string) {
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

export function isPaymongoTestMode() {
  const secretKey = process.env.PAYMONGO_SECRET_KEY ?? "";
  return secretKey.startsWith("sk_test_");
}

export async function getPaymentIntentStatus(intentId: string) {
  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  if (!secretKey) throw new Error("Paymongo not configured");

  const res = await fetch(`${PAYMONGO_API}/payment_intents/${intentId}`, {
    headers: { Authorization: getAuthHeader(secretKey) },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Payment intent lookup failed: ${err}`);
  }

  const data = await res.json();
  return data.data.attributes.status as string;
}

export async function createQrPhPaymentIntent(amountInCentavos: number) {
  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  if (!secretKey) throw new Error("Paymongo not configured");

  const intentRes = await fetch(`${PAYMONGO_API}/payment_intents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(secretKey),
    },
    body: JSON.stringify({
      data: {
        attributes: {
          amount: amountInCentavos,
          payment_method_allowed: ["qrph"],
          currency: "PHP",
        },
      },
    }),
  });

  if (!intentRes.ok) {
    const err = await intentRes.text();
    throw new Error(`Payment intent failed: ${err}`);
  }

  const intentData = await intentRes.json();
  const intentId = intentData.data.id;
  const clientKey = intentData.data.attributes.client_key;

  const publicKey = process.env.NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY;
  if (!publicKey) throw new Error("Paymongo public key not configured");

  const methodRes = await fetch(`${PAYMONGO_API}/payment_methods`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(publicKey),
    },
    body: JSON.stringify({
      data: { attributes: { type: "qrph" } },
    }),
  });

  if (!methodRes.ok) {
    const err = await methodRes.text();
    throw new Error(`Payment method failed: ${err}`);
  }

  const methodData = await methodRes.json();
  const paymentMethodId = methodData.data.id;

  const attachRes = await fetch(
    `${PAYMONGO_API}/payment_intents/${intentId}/attach`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: getAuthHeader(publicKey),
      },
      body: JSON.stringify({
        data: {
          attributes: {
            payment_method: paymentMethodId,
            client_key: clientKey,
          },
        },
      }),
    }
  );

  if (!attachRes.ok) {
    const err = await attachRes.text();
    throw new Error(`Attach failed: ${err}`);
  }

  const attachData = await attachRes.json();
  const nextAction = attachData.data.attributes.next_action;
  const qrImageUrl = nextAction?.code?.image_url ?? "";
  const testUrl = nextAction?.code?.test_url ?? null;

  return {
    intentId,
    clientKey,
    qrImageUrl,
    testUrl,
  };
}

export function verifyPaymongoSignature(
  payload: string,
  signatureHeader: string | null,
  webhookSecret: string
): boolean {
  if (!signatureHeader) return false;
  const parts = signatureHeader.split(",").reduce(
    (acc, part) => {
      const [k, v] = part.split("=");
      if (k && v) acc[k.trim()] = v.trim();
      return acc;
    },
    {} as Record<string, string>
  );
  const timestamp = parts.t;
  const signature = parts.te || parts.v1;
  if (!timestamp || !signature) return false;

  const signed = crypto
    .createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  return signed === signature;
}
