import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import {
  createSessionToken,
  getDummyPasswordHash,
  hashPassword,
  verifyPassword,
} from "./_core/auth";
import { ENV } from "./_core/env";
import { serializePublicUser } from "./_core/publicUser";
import {
  authenticationRateLimiter,
  type RateLimitDecision,
} from "./_core/rateLimit";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";
import { notifyOwner } from "./_core/notification";
import Stripe from "stripe";
import { storagePut, storeRemoteVideo } from "./storage";
import { parseUserAgent } from "./_core/userAgent";
import { getChatbotReply, type ChatMessage } from "./_core/supportChat";
import { tryAutoFulfill } from "./_core/fulfillment";
import * as printify from "./_core/printify";
import * as momo from "./_core/momo";
import * as cj from "./_core/cjDropshipping";
import * as higgsfield from "./_core/higgsfield";
import { convertUsdToRwf } from "./_core/exchangeRate";

// Helper to check admin role
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getRequestIp(req: {
  ip?: string;
  socket?: { remoteAddress?: string };
}): string {
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

function enforceRateLimit(
  ctx: { res: { setHeader(name: string, value: string): unknown } },
  decision: RateLimitDecision,
  action: "login" | "registration" | "support chat"
): void {
  if (!decision.limited) return;
  ctx.res.setHeader("Retry-After", String(decision.retryAfterSeconds));
  console.warn(`[security] ${action} temporarily throttled`);
  throw new TRPCError({
    code: "TOO_MANY_REQUESTS",
    message: "Too many attempts. Please try again later.",
  });
}

function setSessionCookie(ctx: { req: any; res: any }, token: string): void {
  ctx.res.cookie(COOKIE_NAME, token, {
    ...getSessionCookieOptions(ctx.req),
    maxAge: ENV.sessionTtlMs,
  });
}

function isUniqueEmailConstraint(error: unknown): boolean {
  return (
    error instanceof Error &&
    /unique constraint failed:\s*users\.email/i.test(error.message)
  );
}

const positiveId = z
  .number()
  .int()
  .positive()
  .refine(Number.isSafeInteger, "ID must be a safe integer");
const productPrice = z
  .string()
  .trim()
  .max(12)
  .regex(/^\d{1,9}(?:\.\d{1,2})?$/)
  .refine(
    value => Number.isFinite(Number(value)) && Number(value) > 0,
    "Price must be greater than zero"
  );
const productImage = z
  .string()
  .max(30 * 1024 * 1024)
  .refine(value => {
    if (/^data:image\/(?:jpeg|jpg|png|webp|gif|avif);base64,/i.test(value))
      return true;
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "Image must be an HTTPS URL or supported raster image data URI");
const phoneNumber = z
  .string()
  .trim()
  .min(6)
  .max(32)
  .regex(/^\+?[0-9().\s-]+$/)
  .refine(value => {
    const digits = value.replace(/\D/g, "").length;
    return digits >= 9 && digits <= 15;
  }, "Enter a valid phone number");
const shippingAddressSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254),
  phone: phoneNumber,
  street: z.string().trim().min(1).max(300),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  zipCode: z.string().trim().min(1).max(32),
  country: z.string().trim().min(2).max(100),
});

function serializePaymentSettings(
  settings: Awaited<ReturnType<typeof db.getPaymentSettings>>
) {
  if (!settings) return null;
  return {
    id: settings.id,
    stripePublishableKey: settings.stripePublishableKey,
    stripeSecretConfigured: Boolean(settings.stripeSecretKey),
    stripeEnabled: settings.stripeEnabled,
    paypalEnabled: settings.paypalEnabled,
    updatedAt: settings.updatedAt,
  };
}

function getOrderTotalAmount(amount: string): number {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This order has an invalid payment amount.",
    });
  }
  return value;
}

async function ensureCategoryExists(categoryId: number): Promise<void> {
  if (!(await db.getCategoryById(categoryId))) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Category not found.",
    });
  }
}

function detectSupportedImageType(
  buffer: Buffer
):
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif"
  | "image/avif"
  | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  )
    return "image/jpeg";
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (
    buffer.length >= 6 &&
    ["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6))
  )
    return "image/gif";
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 4, 8) === "ftyp" &&
    ["avif", "avis"].includes(buffer.toString("ascii", 8, 12))
  )
    return "image/avif";
  return null;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => serializePublicUser(ctx.user)),

    register: publicProcedure
      .input(
        z.object({
          email: z.string().trim().email().max(254),
          password: z
            .string()
            .min(8, "Password must be at least 8 characters")
            .max(1024),
          name: z.string().trim().max(120).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const decision =
          await authenticationRateLimiter.consumeRegistrationAttempt(
            getRequestIp(ctx.req)
          );
        enforceRateLimit(ctx, decision, "registration");

        const email = normalizeEmail(input.email);
        if (await db.getUserByEmail(email)) {
          // Do not reveal whether the address is already registered.
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Unable to create an account with those details.",
          });
        }

        const passwordHash = await hashPassword(input.password);
        let user;
        try {
          // Public registration always creates an ordinary user. The caller
          // cannot choose or submit a role.
          user = await db.createUser({
            email,
            passwordHash,
            name: input.name || null,
          });
        } catch (error) {
          if (isUniqueEmailConstraint(error)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Unable to create an account with those details.",
            });
          }
          throw error;
        }

        if (!user) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create account",
          });
        }

        // Only the server-configured email can be considered for bootstrap;
        // the database performs the promotion atomically and only if no admin
        // already exists. With ADMIN_EMAIL unset, all public registrations stay users.
        if (ENV.adminEmail && email === ENV.adminEmail) {
          await db.bootstrapAdminForEmail(ENV.adminEmail);
          user = (await db.getUserById(user.id)) ?? user;
        }

        const sessionToken = await createSessionToken(
          user.id,
          ENV.sessionTtlMs
        );
        setSessionCookie(ctx, sessionToken);

        return serializePublicUser(user);
      }),

    login: publicProcedure
      .input(
        z.object({
          email: z.string().trim().email().max(254),
          password: z.string().min(1).max(1024),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const email = normalizeEmail(input.email);
        const ip = getRequestIp(ctx.req);
        const decision = await authenticationRateLimiter.consumeLoginAttempt(
          ip,
          email
        );
        enforceRateLimit(ctx, decision, "login");

        const user = await db.getUserByEmail(email);
        let passwordMatches = false;
        try {
          const candidateHash =
            user?.passwordHash ?? (await getDummyPasswordHash());
          passwordMatches = await verifyPassword(input.password, candidateHash);
        } catch {
          // Do not expose corrupt hash details or sensitive values; emit a
          // non-sensitive security event and retain the generic login failure.
          console.warn("[security] password verification failed");
        }

        if (!user || !passwordMatches) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password",
          });
        }

        await authenticationRateLimiter.clearSuccessfulLogin(ip, email);
        await db.touchLastSignedIn(user.id);
        const refreshedUser = (await db.getUserById(user.id)) ?? user;

        const sessionToken = await createSessionToken(
          user.id,
          ENV.sessionTtlMs
        );
        setSessionCookie(ctx, sessionToken);

        return serializePublicUser(refreshedUser);
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: -1,
      });
      return {
        success: true,
      } as const;
    }),
  }),

  // ============ CATEGORIES ============
  categories: router({
    list: publicProcedure.query(async () => {
      return await db.getAllCategories();
    }),

    getBySlug: publicProcedure
      .input(z.object({ slug: z.string().trim().min(1).max(120) }))
      .query(async ({ input }) => {
        return await db.getCategoryBySlug(input.slug);
      }),

    getById: publicProcedure
      .input(z.object({ id: positiveId }))
      .query(async ({ input }) => {
        return await db.getCategoryById(input.id);
      }),

    create: adminProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(120),
          slug: z
            .string()
            .trim()
            .min(1)
            .max(120)
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
          description: z.string().max(2000).optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await db.createCategory(input);
      }),
  }),

  // ============ PRODUCTS ============
  products: router({
    list: publicProcedure
      .input(
        z.object({
          categoryId: positiveId.optional(),
          search: z.string().trim().max(200).optional(),
          minPrice: z.number().min(0).max(1_000_000_000).optional(),
          maxPrice: z.number().min(0).max(1_000_000_000).optional(),
        })
      )
      .query(async ({ input }) => {
        return await db.getAllProducts(input);
      }),

    getById: publicProcedure
      .input(z.object({ id: positiveId }))
      .query(async ({ input }) => {
        const product = await db.getProductById(input.id);
        if (!product || !product.isActive) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return product;
      }),

    create: adminProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(200),
          description: z.string().max(10000).optional(),
          price: productPrice,
          categoryId: positiveId,
          stock: z.number().int().min(0).max(1_000_000),
          imageUrl: productImage.optional(),
          imageKey: z.string().max(500).optional(),
          images: z.array(productImage).max(20).optional(),
          sku: z.string().trim().max(100).optional(),
        })
      )
      .mutation(async ({ input }) => {
        await ensureCategoryExists(input.categoryId);
        return await db.createProduct(input);
      }),

    update: adminProcedure
      .input(
        z.object({
          id: positiveId,
          name: z.string().trim().min(1).max(200).optional(),
          description: z.string().max(10000).optional(),
          price: productPrice.optional(),
          categoryId: positiveId.optional(),
          stock: z.number().int().min(0).max(1_000_000).optional(),
          imageUrl: productImage.optional(),
          imageKey: z.string().max(500).optional(),
          images: z.array(productImage).max(20).optional(),
          sku: z.string().trim().max(100).optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        if (data.categoryId !== undefined)
          await ensureCategoryExists(data.categoryId);
        return await db.updateProduct(id, data);
      }),

    delete: adminProcedure
      .input(z.object({ id: positiveId }))
      .mutation(async ({ input }) => {
        return await db.deleteProduct(input.id);
      }),

    uploadImage: adminProcedure
      .input(
        z.object({
          imageData: z
            .string()
            .min(1)
            .max(28 * 1024 * 1024)
            .regex(/^[A-Za-z0-9+/]+={0,2}$/),
          fileName: z
            .string()
            .min(1)
            .max(255)
            .regex(/^[A-Za-z0-9._ ()-]+$/),
          contentType: z
            .enum([
              "image/jpeg",
              "image/png",
              "image/webp",
              "image/gif",
              "image/avif",
            ])
            .optional(),
        })
      )
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.imageData, "base64");
        if (buffer.byteLength === 0 || buffer.byteLength > 20 * 1024 * 1024) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Image must be no larger than 20 MB.",
          });
        }
        const detectedContentType = detectSupportedImageType(buffer);
        if (
          !detectedContentType ||
          (input.contentType && input.contentType !== detectedContentType)
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "The uploaded file is not a supported raster image.",
          });
        }

        try {
          const result = await storagePut(
            `products/${input.fileName}`,
            buffer,
            detectedContentType
          );
          return result;
        } catch (error) {
          console.error(
            "Image upload failed:",
            error instanceof Error ? error.name : "UnknownError"
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to upload image",
          });
        }
      }),
  }),

  // ============ REVIEWS ============
  reviews: router({
    list: publicProcedure
      .input(z.object({ productId: positiveId }))
      .query(async ({ input }) => {
        const [items, stats] = await Promise.all([
          db.getProductReviews(input.productId),
          db.getProductReviewStats(input.productId),
        ]);
        return { items, stats };
      }),

    myReview: protectedProcedure
      .input(z.object({ productId: positiveId }))
      .query(async ({ ctx, input }) => {
        return await db.getUserReviewForProduct(ctx.user.id, input.productId);
      }),

    submit: protectedProcedure
      .input(
        z.object({
          productId: positiveId,
          rating: z.number().int().min(1).max(5),
          title: z.string().max(120).optional(),
          comment: z.string().max(2000).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const product = await db.getProductById(input.productId);
        if (!product) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Product not found",
          });
        }

        return await db.upsertReview({
          productId: input.productId,
          userId: ctx.user.id,
          rating: input.rating,
          title: input.title,
          comment: input.comment,
        });
      }),

    delete: protectedProcedure
      .input(z.object({ id: positiveId }))
      .mutation(async ({ ctx, input }) => {
        const review = await db.getReviewById(input.id);
        if (!review) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        // Authors can remove their own review; admins can moderate any.
        if (review.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.deleteReview(input.id);
        return { success: true } as const;
      }),
  }),

  // ============ CART ============
  cart: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const cartItems = await db.getCartItems(ctx.user.id);

      // Enrich with product details
      const enriched = await Promise.all(
        cartItems.map(async item => {
          const product = await db.getProductById(item.productId);
          return {
            ...item,
            product,
          };
        })
      );

      return enriched;
    }),

    add: protectedProcedure
      .input(
        z.object({
          productId: positiveId,
          quantity: z.number().int().min(1).max(1000),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const product = await db.getProductById(input.productId);
        if (!product || !product.isActive) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        if (product.stock < input.quantity) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Insufficient stock",
          });
        }

        await db.addToCart(ctx.user.id, input.productId, input.quantity);
        return await db.getCartItems(ctx.user.id);
      }),

    updateQuantity: protectedProcedure
      .input(
        z.object({
          cartItemId: positiveId,
          quantity: z.number().int().min(0).max(1000),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Verify ownership
        const cartItem = await db.getCartItemById(input.cartItemId);
        if (!cartItem || cartItem.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.updateCartItemQuantity(input.cartItemId, input.quantity);
        return true;
      }),

    remove: protectedProcedure
      .input(z.object({ cartItemId: positiveId }))
      .mutation(async ({ ctx, input }) => {
        // Verify ownership
        const cartItem = await db.getCartItemById(input.cartItemId);
        if (!cartItem || cartItem.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.removeFromCart(input.cartItemId);
        return true;
      }),

    clear: protectedProcedure.mutation(async ({ ctx }) => {
      await db.clearCart(ctx.user.id);
      return true;
    }),
  }),

  // ============ ORDERS ============
  orders: router({
    create: publicProcedure
      .input(
        z.object({
          shippingAddress: shippingAddressSchema,
          paymentMethod: z.enum(["momo", "manual"]).optional(),
          // Required for guest checkout (no server-side cart to read from).
          // Ignored for logged-in users, who use their real cart below.
          items: z
            .array(
              z.object({
                productId: positiveId,
                quantity: z.number().int().min(1).max(1000),
              })
            )
            .max(50)
            .optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Guest checkout must never create a session for an existing account
        // based only on a customer-supplied shipping email. Existing customers
        // must authenticate before the order can be attached to their history.
        const shippingAddress = {
          ...input.shippingAddress,
          email: normalizeEmail(input.shippingAddress.email),
        };
        let userId: number;
        let isGuestOrder = false;

        if (ctx.user) {
          userId = ctx.user.id;
        } else {
          isGuestOrder = true;
          if (await db.getUserByEmail(shippingAddress.email)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Unable to place an order with those details.",
            });
          }

          const randomPassword = crypto.randomUUID() + crypto.randomUUID();
          const passwordHash = await hashPassword(randomPassword);
          let guestUser;
          try {
            guestUser = await db.createUser({
              email: shippingAddress.email,
              passwordHash,
              name: `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim(),
            });
          } catch (error) {
            if (isUniqueEmailConstraint(error)) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Unable to place an order with those details.",
              });
            }
            throw error;
          }

          if (!guestUser) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to start checkout",
            });
          }
          userId = guestUser.id;
        }

        // Get cart items — from the server cart for logged-in users, or
        // directly from the request for guests.
        let orderItems: Array<{
          productId: number;
          name: string;
          price: string;
          quantity: number;
        }>;
        let totalAmount = 0;

        if (isGuestOrder) {
          if (!input.items || input.items.length === 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Cart is empty",
            });
          }

          orderItems = await Promise.all(
            input.items.map(async item => {
              const product = await db.getProductById(item.productId);
              if (!product || !product.isActive) {
                throw new TRPCError({
                  code: "NOT_FOUND",
                  message: "A product in your cart is no longer available",
                });
              }
              if (product.stock < item.quantity) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: `${product.name} has insufficient stock`,
                });
              }
              const unitPrice = Number(product.price);
              if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: "A product price is unavailable.",
                });
              }
              totalAmount += unitPrice * item.quantity;
              return {
                productId: product.id,
                name: product.name,
                price: product.price,
                quantity: item.quantity,
              };
            })
          );
        } else {
          const cartItems = await db.getCartItems(userId);
          if (cartItems.length === 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Cart is empty",
            });
          }

          orderItems = await Promise.all(
            cartItems.map(async item => {
              const product = await db.getProductById(item.productId);
              if (!product || !product.isActive) {
                throw new TRPCError({
                  code: "NOT_FOUND",
                  message: "A product in your cart is no longer available",
                });
              }
              if (product.stock < item.quantity) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: `${product.name} has insufficient stock`,
                });
              }
              const unitPrice = Number(product.price);
              if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: "A product price is unavailable.",
                });
              }
              const itemTotal = unitPrice * item.quantity;
              totalAmount += itemTotal;
              return {
                productId: product.id,
                name: product.name,
                price: product.price,
                quantity: item.quantity,
              };
            })
          );
        }

        // Create order
        const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const order = await db.createOrder({
          userId,
          orderNumber,
          totalAmount: totalAmount.toFixed(2),
          shippingAddress,
          paymentMethod: input.paymentMethod,
          items: orderItems,
        });

        // Clear cart (only meaningful for the logged-in path — guests never
        // had a server-side cart to clear)
        if (!isGuestOrder) {
          await db.clearCart(userId);
        }

        // Notify owner
        try {
          await notifyOwner({
            title: "New Order Received",
            content: `Order ${orderNumber} from ${shippingAddress.firstName} ${shippingAddress.lastName} for $${totalAmount.toFixed(2)}`,
          });
        } catch (error) {
          console.error(
            "Failed to notify owner:",
            error instanceof Error ? error.name : "UnknownError"
          );
        }

        // Guests can immediately pay via MoMo and see this order in the
        // current session, but the session is limited to the configured TTL.
        if (isGuestOrder) {
          const sessionToken = await createSessionToken(
            userId,
            ENV.sessionTtlMs
          );
          setSessionCookie(ctx, sessionToken);
        }

        return order;
      }),

    createPaymentIntent: protectedProcedure
      .input(z.object({ orderId: positiveId }))
      .mutation(async ({ ctx, input }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order || order.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Order not found",
          });
        }
        if (order.status !== "pending") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This order isn't awaiting payment",
          });
        }

        const amount = getOrderTotalAmount(order.totalAmount);

        const paymentSettings = await db.getPaymentSettings();
        if (
          !paymentSettings?.stripeSecretKey ||
          !paymentSettings.stripeEnabled
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Stripe payment is not configured",
          });
        }

        try {
          const stripe = new Stripe(paymentSettings.stripeSecretKey);
          const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100),
            currency: "usd",
            metadata: {
              userId: ctx.user.id.toString(),
              orderId: order.id.toString(),
            },
          });
          await db.setOrderStripePaymentIntentId(order.id, paymentIntent.id);

          return {
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
          };
        } catch (error) {
          console.error(
            "Stripe payment intent creation failed:",
            error instanceof Error ? error.name : "UnknownError"
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create payment intent",
          });
        }
      }),

    getById: protectedProcedure
      .input(z.object({ id: positiveId }))
      .query(async ({ ctx, input }) => {
        const order = await db.getOrderById(input.id);
        if (!order) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        // Check authorization
        if (order.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        return order;
      }),

    getUserOrders: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserOrders(ctx.user.id);
    }),

    getAllOrders: adminProcedure.query(async () => {
      return await db.getAllOrders();
    }),

    updateStatus: adminProcedure
      .input(
        z.object({
          id: positiveId,
          status: z.enum([
            "pending",
            "paid",
            "processing",
            "shipped",
            "delivered",
            "cancelled",
          ]),
        })
      )
      .mutation(async ({ input }) => {
        const order = await db.updateOrderStatus(input.id, input.status);
        if (order) {
          // Fire-and-forget from the caller's perspective, but fully awaited
          // here so failures are recorded before we return — never throws,
          // since fulfillment failures are stored on the order, not surfaced
          // as an error on the status update itself.
          await tryAutoFulfill(order);
        }
        return await db.getOrderById(input.id);
      }),

    delete: adminProcedure
      .input(z.object({ id: positiveId }))
      .mutation(async ({ input }) => {
        await db.deleteOrder(input.id);
        return { success: true } as const;
      }),

    // Bulk cleanup — handy for clearing out test orders. Deletes every
    // order, no filtering, so the client should confirm hard before calling.
    deleteAll: adminProcedure.mutation(async () => {
      await db.deleteAllOrders();
      return { success: true } as const;
    }),
  }),

  // ============ USERS ============
  users: router({
    list: adminProcedure.query(async () => {
      const users = await db.getAllUsers();
      return users.map(user => serializePublicUser(user));
    }),

    getById: adminProcedure
      .input(z.object({ id: positiveId }))
      .query(async ({ input }) => {
        return serializePublicUser(await db.getUserById(input.id));
      }),

    updateRole: adminProcedure
      .input(
        z.object({
          id: positiveId,
          role: z.enum(["user", "admin"]),
        })
      )
      .mutation(async ({ input }) => {
        return serializePublicUser(
          await db.updateUserRole(input.id, input.role)
        );
      }),
  }),

  // ============ PAYMENT SETTINGS ============
  paymentSettings: router({
    get: adminProcedure.query(async () => {
      return serializePaymentSettings(await db.getPaymentSettings());
    }),

    update: adminProcedure
      .input(
        z.object({
          stripePublishableKey: z.string().max(255).optional(),
          // Write-only compatibility: administrators may update this value,
          // but it is never included in the mutation response or another API response.
          stripeSecretKey: z.string().min(1).max(500).optional(),
          stripeEnabled: z.boolean().optional(),
          paypalEnabled: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return serializePaymentSettings(await db.updatePaymentSettings(input));
      }),
  }),

  analytics: router({
    // Public: any visitor's browser fires this. Device/browser/OS are
    // derived server-side from the real request header, not trusted client
    // input, so this can't be spoofed to pollute the numbers.
    track: publicProcedure
      .input(
        z.object({
          eventType: z.enum(["page_view", "search", "category_view"]),
          path: z.string().trim().min(1).max(2048),
          query: z.string().max(500).optional(),
          categorySlug: z.string().max(120).optional(),
          resultCount: z.number().int().min(0).max(1_000_000).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const userAgent = ctx.req.headers["user-agent"];
        const { device, browser, os } = parseUserAgent(userAgent);

        await db.logAnalyticsEvent({
          eventType: input.eventType,
          path: input.path,
          query: input.query ?? null,
          categorySlug: input.categorySlug ?? null,
          resultCount: input.resultCount ?? null,
          device,
          browser,
          os,
          userAgent: userAgent ?? null,
        });

        return { success: true } as const;
      }),

    summary: adminProcedure
      .input(
        z
          .object({ days: z.number().int().min(1).max(365).optional() })
          .optional()
      )
      .query(async ({ input }) => {
        return await db.getAnalyticsSummary(input?.days ?? 30);
      }),

    emptyResults: adminProcedure
      .input(
        z
          .object({ days: z.number().int().min(1).max(365).optional() })
          .optional()
      )
      .query(async ({ input }) => {
        return await db.getEmptyResultEvents(input?.days ?? 30);
      }),
  }),

  newsletter: router({
    subscribe: publicProcedure
      .input(z.object({ email: z.string().trim().email().max(254) }))
      .mutation(async ({ input }) => {
        await db.subscribeToNewsletter(normalizeEmail(input.email));
        return { success: true } as const;
      }),

    list: adminProcedure.query(async () => {
      return await db.getAllNewsletterSubscribers();
    }),
  }),

  support: router({
    chat: publicProcedure
      .input(
        z.object({
          messages: z
            .array(
              z.object({
                role: z.enum(["user", "assistant"]),
                content: z.string().trim().min(1).max(2000),
              })
            )
            .min(1)
            .max(20),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const decision = await authenticationRateLimiter.consumeSupportChatAttempt(
          getRequestIp(ctx.req)
        );
        enforceRateLimit(ctx, decision, "support chat");
        const reply = await getChatbotReply(input.messages as ChatMessage[]);
        return { reply };
      }),
  }),

  integrations: router({
    printify: router({
      status: adminProcedure.query(() => ({
        tokenConfigured: printify.isPrintifyConfigured(),
        shopIdConfigured: Boolean(ENV.printifyShopId),
      })),

      listShops: adminProcedure.query(async () => {
        return await printify.listShops();
      }),

      listProducts: adminProcedure.query(async () => {
        if (!ENV.printifyShopId) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "PRINTIFY_SHOP_ID isn't set",
          });
        }
        return await printify.listProducts(ENV.printifyShopId);
      }),

      getProduct: adminProcedure
        .input(z.object({ productId: z.string().trim().min(1).max(120) }))
        .query(async ({ input }) => {
          if (!ENV.printifyShopId) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "PRINTIFY_SHOP_ID isn't set",
            });
          }
          return await printify.getProduct(ENV.printifyShopId, input.productId);
        }),

      importProduct: adminProcedure
        .input(
          z.object({
            productId: z.string().trim().min(1).max(120),
            variantId: z.number().int().positive(),
            categoryId: positiveId,
            stock: z.number().int().min(0).max(1_000_000).default(50),
          })
        )
        .mutation(async ({ input }) => {
          if (!ENV.printifyShopId) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "PRINTIFY_SHOP_ID isn't set",
            });
          }

          const detail = await printify.getProduct(
            ENV.printifyShopId,
            input.productId
          );
          const variant = detail.variants.find(v => v.id === input.variantId);
          if (!variant || !variant.is_enabled || !variant.is_available) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "An enabled, available variant was not found on that product.",
            });
          }
          if (!Number.isSafeInteger(variant.price) || variant.price <= 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "The selected variant has an invalid price.",
            });
          }
          await ensureCategoryExists(input.categoryId);

          const images = detail.images
            .map(i => i.src)
            .filter(Boolean)
            .slice(0, 20)
            .map(src => productImage.parse(src));
          const image =
            detail.images.find(i => i.is_default) ?? detail.images[0];
          const imageUrl = image?.src
            ? productImage.parse(image.src)
            : images[0];
          if (!imageUrl) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "The selected supplier product has no supported image.",
            });
          }

          const product = await db.createProduct({
            name: `${detail.title} - ${variant.title}`.trim().slice(0, 200),
            description: detail.description
              ?.replace(/<[^>]+>/g, "")
              .slice(0, 2000),
            price: (variant.price / 100).toFixed(2),
            categoryId: input.categoryId,
            stock: input.stock,
            imageUrl,
            images: images.length > 0 ? images : [imageUrl],
          });

          if (!product) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create product",
            });
          }

          return await db.linkProductToDropship(product.id, {
            dropshipProvider: "printify",
            dropshipProductId: input.productId,
            dropshipVariantId: input.variantId.toString(),
          });
        }),
    }),

    cj: router({
      status: adminProcedure.query(() => ({
        configured: cj.isCJConfigured(),
      })),

      searchProducts: adminProcedure
        .input(
          z.object({
            keyword: z.string().trim().max(200).optional(),
            pageNum: z.number().int().min(1).max(10000).default(1),
          })
        )
        .query(async ({ input }) => {
          return await cj.searchProducts({
            keyword: input.keyword,
            pageNum: input.pageNum,
          });
        }),

      importProduct: adminProcedure
        .input(
          z.object({
            productId: z.string().trim().min(1).max(120),
            vid: z.string().trim().min(1).max(120),
            keyword: z.string().trim().max(200).optional(),
            categoryId: positiveId,
            stock: z.number().int().min(0).max(1_000_000).default(50),
          })
        )
        .mutation(async ({ input }) => {
          // Re-fetch canonical supplier data instead of accepting client prices,
          // titles, images, or supplier variant details.
          const searchResult = await cj.searchProducts({
            keyword: input.keyword,
            pageNum: 1,
          });
          const supplierProduct = searchResult.content.find(
            product =>
              product.productId === input.productId && product.vid === input.vid
          );
          if (!supplierProduct) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "The selected CJ product is no longer available.",
            });
          }

          const price = productPrice.parse(supplierProduct.sellPrice);
          const imageUrl = productImage.parse(supplierProduct.bigImage);
          await ensureCategoryExists(input.categoryId);
          const product = await db.createProduct({
            name: supplierProduct.nameEn.trim().slice(0, 200) || "CJ product",
            price,
            categoryId: input.categoryId,
            stock: input.stock,
            imageUrl,
            images: [imageUrl],
          });

          if (!product) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create product",
            });
          }

          return await db.linkProductToDropship(product.id, {
            dropshipProvider: "cj",
            dropshipProductId: supplierProduct.productId,
            dropshipVariantId: supplierProduct.vid,
          });
        }),
    }),

    higgsfield: router({
      status: adminProcedure.query(() => ({
        configured: higgsfield.isHiggsfieldConfigured(),
      })),

      generateShowcaseVideo: adminProcedure
        .input(
          z.object({
            productId: positiveId,
            prompt: z.string().trim().max(1000).optional(),
          })
        )
        .mutation(async ({ input }) => {
          const product = await db.getProductById(input.productId);
          if (!product) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Product not found",
            });
          }

          const sourceImage = product.imageUrl ?? product.images?.[0];
          if (!sourceImage) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "This product has no image to generate a video from yet",
            });
          }
          // Higgsfield needs a URL it can fetch — a local base64 data URI
          // (the no-Cloudinary fallback) won't work as input.
          if (sourceImage.startsWith("data:")) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Connect Cloudinary first — Higgsfield needs a real image URL, not an inline data URI.",
            });
          }

          try {
            const higgsfieldUrl = await higgsfield.generateProductShowcaseVideo(
              sourceImage,
              input.prompt
            );
            const finalUrl = await storeRemoteVideo(higgsfieldUrl);
            return await db.setProductShowcaseVideo(product.id, finalUrl);
          } catch (error) {
            console.error(
              "Higgsfield operation failed:",
              error instanceof Error ? error.name : "UnknownError"
            );
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to generate showcase video",
            });
          }
        }),
    }),
  }),

  payments: router({
    momo: router({
      // Public: the checkout page needs to know whether to show the MoMo
      // flow or fall back to "we'll confirm payment manually" messaging.
      status: publicProcedure.query(() => ({
        configured: momo.isMomoConfigured(),
        targetEnvironment: ENV.momoTargetEnvironment,
        currency:
          ENV.momoTargetEnvironment === "sandbox" ? "EUR" : ENV.momoCurrency,
      })),

      // Lets the client show the real RWF amount that will actually be
      // charged (converted from this store's USD prices) before the
      // customer commits to paying — uses the same conversion requestToPay
      // uses below, so what's displayed matches what's charged.
      previewAmount: protectedProcedure
        .input(z.object({ orderId: positiveId }))
        .query(async ({ ctx, input }) => {
          const order = await db.getOrderById(input.orderId);
          if (!order || order.userId !== ctx.user.id) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Order not found",
            });
          }

          const { rwfAmount, rate, source } = await convertUsdToRwf(
            getOrderTotalAmount(order.totalAmount)
          );
          return { usdAmount: order.totalAmount, rwfAmount, rate, source };
        }),

      requestToPay: protectedProcedure
        .input(
          z.object({
            orderId: positiveId,
            phone: phoneNumber,
          })
        )
        .mutation(async ({ ctx, input }) => {
          const order = await db.getOrderById(input.orderId);
          if (!order || order.userId !== ctx.user.id) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Order not found",
            });
          }
          if (order.status !== "pending") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "This order isn't awaiting payment",
            });
          }

          try {
            const { rwfAmount } = await convertUsdToRwf(
              getOrderTotalAmount(order.totalAmount)
            );

            const { referenceId } = await momo.requestToPay({
              amount: rwfAmount,
              phone: input.phone,
              externalId: order.orderNumber,
              payerMessage: `Xirel order ${order.orderNumber}`,
            });

            await db.setOrderPaymentReference(order.id, referenceId);
            return { referenceId, rwfAmount };
          } catch (error) {
            console.error(
              "MoMo payment request failed:",
              error instanceof Error ? error.name : "UnknownError"
            );
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to start MoMo payment",
            });
          }
        }),

      checkStatus: protectedProcedure
        .input(z.object({ orderId: positiveId }))
        .mutation(async ({ ctx, input }) => {
          const order = await db.getOrderById(input.orderId);
          if (!order || order.userId !== ctx.user.id) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Order not found",
            });
          }
          if (!order.paymentReference) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "No payment in progress for this order",
            });
          }

          const { status } = await momo.checkRequestToPayStatus(
            order.paymentReference
          );

          if (status === "SUCCESSFUL" && order.status === "pending") {
            // A concurrent admin cancellation/status update must not be
            // overwritten by a delayed provider response.
            const updated = await db.markOrderPaidIfPending(order.id);
            if (updated) {
              await tryAutoFulfill(updated);
            }
          }

          return { status };
        }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
