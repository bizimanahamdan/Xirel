import * as db from "../db";
import { ENV } from "./env";

const BASE_URL = "https://developers.cjdropshipping.com/api2.0/v1";

export function isCJConfigured(): boolean {
  return Boolean(ENV.cjApiKey);
}

class CJNotConfiguredError extends Error {
  constructor() {
    super("CJ Dropshipping isn't configured — set CJ_API_KEY in your environment.");
  }
}

/**
 * Gets a valid CJ access token, refreshing or re-authenticating as needed.
 * Cached in the database (not just memory) so a server restart doesn't force
 * a fresh login every time — useful since CJ rate-limits the login endpoint.
 */
async function getAccessToken(): Promise<string> {
  if (!isCJConfigured()) throw new CJNotConfiguredError();

  const stored = await db.getIntegrationToken("cj");

  if (stored && stored.accessTokenExpiresAt.getTime() > Date.now() + 60_000) {
    return stored.accessToken;
  }

  // Try refreshing first if we have a still-valid refresh token — avoids
  // hitting CJ's stricter rate limit on the fresh-login endpoint.
  if (
    stored?.refreshToken &&
    stored.refreshTokenExpiresAt &&
    stored.refreshTokenExpiresAt.getTime() > Date.now()
  ) {
    try {
      return await refreshAccessToken(stored.refreshToken);
    } catch (error) {
      console.error("CJ token refresh failed, falling back to fresh login:", error);
    }
  }

  return await freshLogin();
}

async function freshLogin(): Promise<string> {
  const response = await fetch(`${BASE_URL}/authentication/getAccessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: ENV.cjApiKey }),
  });

  const data = await response.json();
  if (!response.ok || data?.result === false) {
    throw new Error(`CJ login failed: ${data?.message ?? response.statusText}`);
  }

  return storeTokenResponse(data.data);
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/authentication/refreshAccessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  const data = await response.json();
  if (!response.ok || data?.result === false) {
    throw new Error(`CJ token refresh failed: ${data?.message ?? response.statusText}`);
  }

  return storeTokenResponse(data.data);
}

async function storeTokenResponse(data: any): Promise<string> {
  await db.upsertIntegrationToken("cj", {
    accessToken: data.accessToken,
    accessTokenExpiresAt: new Date(data.accessTokenExpiryDate ?? Date.now() + 15 * 60 * 60 * 1000),
    refreshToken: data.refreshToken ?? null,
    refreshTokenExpiresAt: data.refreshTokenExpiryDate ? new Date(data.refreshTokenExpiryDate) : null,
  });
  return data.accessToken;
}

async function cjFetch(path: string, options: RequestInit = {}) {
  const token = await getAccessToken();

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "CJ-Access-Token": token,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json();
  if (!response.ok || data?.result === false) {
    throw new Error(`CJ API error: ${data?.message ?? response.statusText}`);
  }

  return data;
}

export type CJProductRow = {
  productId: string;
  vid: string;
  nameEn: string;
  sku: string;
  sellPrice: string;
  bigImage: string;
};

/**
 * Searches CJ's product catalog. Each row already represents one sellable
 * variant (its own `vid`, price, and image) rather than a parent product
 * with nested variants — so browsing this list directly is the whole import
 * flow, no separate "get variants" call needed.
 */
export async function searchProducts(params: {
  keyword?: string;
  pageNum?: number;
  pageSize?: number;
}): Promise<{ content: CJProductRow[]; totalRecords: number }> {
  const query = new URLSearchParams();
  if (params.keyword) query.set("productNameEn", params.keyword);
  query.set("pageNum", String(params.pageNum ?? 1));
  query.set("pageSize", String(params.pageSize ?? 20));

  const result = await cjFetch(`/product/listV2?${query.toString()}`);
  return {
    content: result.data?.content ?? [],
    totalRecords: result.data?.totalRecords ?? 0,
  };
}

export async function createOrder(params: {
  orderNumber: string;
  shippingCustomerName: string;
  shippingAddress: string;
  shippingCity: string;
  shippingProvince: string;
  shippingCountryCode: string;
  shippingZip: string;
  shippingPhone: string;
  email: string;
  products: Array<{ vid: string; quantity: number }>;
}): Promise<{ orderId: string }> {
  const result = await cjFetch("/shopping/order/createOrderV2", {
    method: "POST",
    body: JSON.stringify({
      orderNumber: params.orderNumber,
      shippingCustomerName: params.shippingCustomerName,
      shippingAddress: params.shippingAddress,
      shippingCity: params.shippingCity,
      shippingProvince: params.shippingProvince,
      shippingCountryCode: params.shippingCountryCode,
      shippingZip: params.shippingZip,
      shippingPhone: params.shippingPhone,
      email: params.email,
      // NOTE: the exact field name/shape for line items here is our best
      // understanding from available docs (not verified against a live
      // account) — if CJ rejects this, the error message from cjFetch will
      // surface directly in the order's fulfillment status for debugging.
      productList: params.products.map(p => ({ vid: p.vid, quantity: p.quantity })),
    }),
  });

  return { orderId: result.data?.orderId ?? result.data?.orderNum ?? "" };
}
