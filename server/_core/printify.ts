import { ENV } from "./env";

const BASE_URL = "https://api.printify.com/v1";

class PrintifyNotConfiguredError extends Error {
  constructor() {
    super("Printify isn't configured — set PRINTIFY_API_TOKEN in your environment.");
  }
}

async function printifyFetch(path: string, options: RequestInit = {}) {
  if (!ENV.printifyApiToken) {
    throw new PrintifyNotConfiguredError();
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${ENV.printifyApiToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Printify API error (${response.status}): ${body || response.statusText}`);
  }

  return response.json();
}

export type PrintifyShop = {
  id: number;
  title: string;
  sales_channel: string;
};

export async function listShops(): Promise<PrintifyShop[]> {
  return printifyFetch("/shops.json");
}

export type PrintifyProductSummary = {
  id: string;
  title: string;
  images: Array<{ src: string; is_default?: boolean }>;
};

export async function listProducts(shopId: string): Promise<PrintifyProductSummary[]> {
  const result = await printifyFetch(`/shops/${shopId}/products.json`);
  // Printify paginates; the "data" field holds the array for this page.
  return result?.data ?? result;
}

export type PrintifyVariant = {
  id: number;
  title: string;
  price: number; // in cents
  is_enabled: boolean;
  is_available: boolean;
};

export type PrintifyProductDetail = {
  id: string;
  title: string;
  description: string;
  images: Array<{ src: string; is_default?: boolean }>;
  variants: PrintifyVariant[];
};

export async function getProduct(shopId: string, productId: string): Promise<PrintifyProductDetail> {
  return printifyFetch(`/shops/${shopId}/products/${productId}.json`);
}

export type PrintifyOrderAddress = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  country: string;
  region: string;
  address1: string;
  city: string;
  zip: string;
};

export async function createOrder(
  shopId: string,
  data: {
    external_id: string;
    line_items: Array<{ product_id: string; variant_id: number; quantity: number }>;
    shipping_method: number;
    address_to: PrintifyOrderAddress;
  }
): Promise<{ id: string; status: string }> {
  return printifyFetch(`/shops/${shopId}/orders.json`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function isPrintifyConfigured(): boolean {
  return Boolean(ENV.printifyApiToken);
}
