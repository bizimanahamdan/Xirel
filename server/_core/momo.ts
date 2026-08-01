import { ENV } from "./env";

let cachedToken: { value: string; expiresAt: number } | null = null;

export function isMomoConfigured(): boolean {
  return Boolean(ENV.momoApiUser && ENV.momoApiKey && ENV.momoSubscriptionKey);
}

class MomoNotConfiguredError extends Error {
  constructor() {
    super("MTN MoMo isn't configured — set MOMO_API_USER, MOMO_API_KEY, and MOMO_SUBSCRIPTION_KEY.");
  }
}

async function getAccessToken(): Promise<string> {
  if (!isMomoConfigured()) throw new MomoNotConfiguredError();

  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  const basicAuth = Buffer.from(`${ENV.momoApiUser}:${ENV.momoApiKey}`).toString("base64");

  const response = await fetch(`${ENV.momoBaseUrl}/collection/token/`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Ocp-Apim-Subscription-Key": ENV.momoSubscriptionKey,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`MoMo token request failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

/** Normalizes a Rwandan phone number to the MSISDN format MoMo expects:
 * country code + number, digits only, no "+", no leading 0. */
export function normalizeRwandaMsisdn(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("250")) return digits;
  if (digits.startsWith("0")) return `250${digits.slice(1)}`;
  return `250${digits}`;
}

export async function requestToPay(params: {
  amount: number;
  phone: string;
  externalId: string;
  payerMessage: string;
}): Promise<{ referenceId: string }> {
  const token = await getAccessToken();
  const referenceId = crypto.randomUUID();

  // MTN's sandbox environment only accepts "EUR" as the currency code,
  // regardless of what you're actually charging in — production uses the
  // real local currency. The amount itself is unaffected either way; it's
  // purely the currency *code* that sandbox is picky about.
  const currency = ENV.momoTargetEnvironment === "sandbox" ? "EUR" : ENV.momoCurrency;

  const response = await fetch(`${ENV.momoBaseUrl}/collection/v1_0/requesttopay`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Reference-Id": referenceId,
      "X-Target-Environment": ENV.momoTargetEnvironment,
      "Ocp-Apim-Subscription-Key": ENV.momoSubscriptionKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: params.amount.toFixed(0),
      currency,
      externalId: params.externalId,
      payer: {
        partyIdType: "MSISDN",
        partyId: normalizeRwandaMsisdn(params.phone),
      },
      payerMessage: params.payerMessage,
      payeeNote: params.payerMessage,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`MoMo request-to-pay failed (${response.status}): ${body}`);
  }

  return { referenceId };
}

export type MomoStatus = "PENDING" | "SUCCESSFUL" | "FAILED";

export async function checkRequestToPayStatus(referenceId: string): Promise<{ status: MomoStatus }> {
  const token = await getAccessToken();

  const response = await fetch(`${ENV.momoBaseUrl}/collection/v1_0/requesttopay/${referenceId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Target-Environment": ENV.momoTargetEnvironment,
      "Ocp-Apim-Subscription-Key": ENV.momoSubscriptionKey,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`MoMo status check failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  return { status: data.status };
}
