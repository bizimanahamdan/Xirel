import * as db from "../db";
import * as printify from "./printify";
import { ENV } from "./env";
import type { Order } from "../../drizzle/schema";

/**
 * Called after an order's status changes. For any line item whose product
 * is linked to a dropship provider, places the corresponding order with
 * that provider and records the result on our order (success or failure —
 * failures are recorded, not thrown, so one bad line item doesn't block the
 * rest of the order update).
 *
 * Only fires on the transition into "paid" or "processing" — checkout alone
 * only creates a "pending" order, since payment is confirmed manually.
 */
export async function tryAutoFulfill(order: Order): Promise<void> {
  if (order.status !== "paid" && order.status !== "processing") return;
  if (!order.items || !order.shippingAddress) return;

  // Don't double-place: skip products we've already successfully fulfilled
  // for this order.
  const alreadyFulfilledProductIds = new Set(
    (order.fulfillments ?? []).filter(f => f.status === "placed").map(f => f.productId)
  );

  for (const item of order.items) {
    if (alreadyFulfilledProductIds.has(item.productId)) continue;

    const product = await db.getProductById(item.productId);
    if (!product?.dropshipProvider || !product.dropshipProductId || !product.dropshipVariantId) {
      continue; // Not a dropship-linked product — nothing to fulfill automatically.
    }

    if (product.dropshipProvider === "printify") {
      await fulfillWithPrintify(order, item, product);
    }
    // CJ Dropshipping support follows the same pattern once it's built.
  }
}

async function fulfillWithPrintify(
  order: Order,
  item: { productId: number; quantity: number },
  product: { dropshipProductId: string | null; dropshipVariantId: string | null }
) {
  const createdAt = new Date().toISOString();

  if (!printify.isPrintifyConfigured() || !ENV.printifyShopId) {
    await db.appendOrderFulfillment(order.id, {
      provider: "printify",
      productId: item.productId,
      status: "failed",
      error: "Printify isn't configured (missing API token or shop ID).",
      createdAt,
    });
    return;
  }

  const addr = order.shippingAddress!;

  try {
    const result = await printify.createOrder(ENV.printifyShopId, {
      external_id: order.orderNumber,
      line_items: [
        {
          product_id: product.dropshipProductId!,
          variant_id: Number(product.dropshipVariantId),
          quantity: item.quantity,
        },
      ],
      // 1 = standard shipping for most Printify print providers.
      shipping_method: 1,
      address_to: {
        first_name: addr.firstName,
        last_name: addr.lastName,
        email: addr.email,
        phone: addr.phone,
        country: addr.country,
        region: addr.state,
        address1: addr.street,
        city: addr.city,
        zip: addr.zipCode,
      },
    });

    await db.appendOrderFulfillment(order.id, {
      provider: "printify",
      productId: item.productId,
      externalOrderId: result.id,
      status: "placed",
      createdAt,
    });
  } catch (error) {
    await db.appendOrderFulfillment(order.id, {
      provider: "printify",
      productId: item.productId,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error placing Printify order",
      createdAt,
    });
  }
}
