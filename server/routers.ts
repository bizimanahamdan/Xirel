import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { createSessionToken, hashPassword, verifyPassword } from "./_core/auth";
import { ENV } from "./_core/env";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";
import { notifyOwner } from "./_core/notification";
import Stripe from "stripe";
import { storagePut } from "./storage";
import { parseUserAgent } from "./_core/userAgent";
import { getChatbotReply, type ChatMessage } from "./_core/supportChat";
import { tryAutoFulfill } from "./_core/fulfillment";
import * as printify from "./_core/printify";
import * as momo from "./_core/momo";
import * as cj from "./_core/cjDropshipping";
import { convertUsdToRwf } from "./_core/exchangeRate";

// Helper to check admin role
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),

    register: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string().min(8, "Password must be at least 8 characters"),
          name: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await db.getUserByEmail(input.email);
        if (existing) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "An account with this email already exists",
          });
        }

        // Admin bootstrapping:
        // - If ADMIN_EMAIL is set (recommended for any public deployment),
        //   only that exact email can ever become admin, and only once.
        // - If it's not set (fine for local/offline use), the very first
        //   account created becomes admin.
        const existingUsers = await db.getAllUsers();
        const noAdminYet = !existingUsers.some((u) => u.role === "admin");
        const isDesignatedAdmin =
          ENV.adminEmail.length > 0 && input.email.toLowerCase() === ENV.adminEmail.toLowerCase();
        const shouldBeAdmin = ENV.adminEmail
          ? isDesignatedAdmin && noAdminYet
          : existingUsers.length === 0;

        const passwordHash = await hashPassword(input.password);
        const user = await db.createUser({
          email: input.email,
          passwordHash,
          name: input.name ?? null,
          role: shouldBeAdmin ? "admin" : "user",
        });

        if (!user) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create account",
          });
        }

        const sessionToken = await createSessionToken(user.id, ONE_YEAR_MS);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        return user;
      }),

    login: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserByEmail(input.email);
        if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password",
          });
        }

        await db.touchLastSignedIn(user.id);

        const sessionToken = await createSessionToken(user.id, ONE_YEAR_MS);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        return user;
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
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
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        return await db.getCategoryBySlug(input.slug);
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getCategoryById(input.id);
      }),

    create: adminProcedure
      .input(
        z.object({
          name: z.string(),
          slug: z.string(),
          description: z.string().optional(),
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
          categoryId: z.number().optional(),
          search: z.string().optional(),
          minPrice: z.number().optional(),
          maxPrice: z.number().optional(),
        })
      )
      .query(async ({ input }) => {
        return await db.getAllProducts(input);
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const product = await db.getProductById(input.id);
        if (!product) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return product;
      }),

    create: adminProcedure
      .input(
        z.object({
          name: z.string(),
          description: z.string().optional(),
          price: z.string(),
          categoryId: z.number(),
          stock: z.number(),
          imageUrl: z.string().optional(),
          imageKey: z.string().optional(),
          sku: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await db.createProduct(input);
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          description: z.string().optional(),
          price: z.string().optional(),
          categoryId: z.number().optional(),
          stock: z.number().optional(),
          imageUrl: z.string().optional(),
          imageKey: z.string().optional(),
          sku: z.string().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await db.updateProduct(id, data);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteProduct(input.id);
      }),

    uploadImage: adminProcedure
      .input(
        z.object({
          imageData: z.string(),
          fileName: z.string(),
          contentType: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const buffer = Buffer.from(input.imageData, "base64");
          const result = await storagePut(
            `products/${input.fileName}`,
            buffer,
            input.contentType || "image/jpeg"
          );
          return result;
        } catch (error) {
          console.error("Image upload error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to upload image",
          });
        }
      }),
  }),

  // ============ CART ============
  cart: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const cartItems = await db.getCartItems(ctx.user.id);

      // Enrich with product details
      const enriched = await Promise.all(
        cartItems.map(async (item) => {
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
          productId: z.number(),
          quantity: z.number().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const product = await db.getProductById(input.productId);
        if (!product) {
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
          cartItemId: z.number(),
          quantity: z.number().min(0),
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
      .input(z.object({ cartItemId: z.number() }))
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
    create: protectedProcedure
      .input(
        z.object({
          shippingAddress: z.object({
            firstName: z.string(),
            lastName: z.string(),
            email: z.string().email(),
            phone: z.string(),
            street: z.string(),
            city: z.string(),
            state: z.string(),
            zipCode: z.string(),
            country: z.string(),
          }),
          paymentMethod: z.string().optional(),
          stripePaymentIntentId: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Get cart items
        const cartItems = await db.getCartItems(ctx.user.id);
        if (cartItems.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cart is empty",
          });
        }

        // Enrich with product details and calculate total
        let totalAmount = 0;
        const orderItems = await Promise.all(
          cartItems.map(async (item) => {
            const product = await db.getProductById(item.productId);
            if (!product) {
              throw new TRPCError({ code: "NOT_FOUND" });
            }

            // Check stock
            if (product.stock < item.quantity) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `${product.name} has insufficient stock`,
              });
            }

            const itemTotal = parseFloat(product.price) * item.quantity;
            totalAmount += itemTotal;

            return {
              productId: product.id,
              name: product.name,
              price: product.price,
              quantity: item.quantity,
            };
          })
        );

        // Create order
        const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const order = await db.createOrder({
          userId: ctx.user.id,
          orderNumber,
          totalAmount: totalAmount.toFixed(2),
          shippingAddress: input.shippingAddress,
          paymentMethod: input.paymentMethod,
          stripePaymentIntentId: input.stripePaymentIntentId,
          items: orderItems,
        });

        // Clear cart
        await db.clearCart(ctx.user.id);

        // Notify owner
        try {
          await notifyOwner({
            title: "New Order Received",
            content: `Order ${orderNumber} from ${input.shippingAddress.firstName} ${input.shippingAddress.lastName} for $${totalAmount.toFixed(2)}`,
          });
        } catch (error) {
          console.error("Failed to notify owner:", error);
        }

        return order;
      }),

    createPaymentIntent: protectedProcedure
      .input(
        z.object({
          amount: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const paymentSettings = await db.getPaymentSettings();
        if (!paymentSettings?.stripeSecretKey || !paymentSettings.stripeEnabled) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Stripe payment is not configured",
          });
        }

        const stripe = new Stripe(paymentSettings.stripeSecretKey);

        try {
          const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(input.amount * 100), // Convert to cents
            currency: "usd",
            metadata: {
              userId: ctx.user.id.toString(),
            },
          });

          return {
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
          };
        } catch (error) {
          console.error("Stripe error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create payment intent",
          });
        }
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
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
          id: z.number(),
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
  }),

  // ============ USERS ============
  users: router({
    list: adminProcedure.query(async () => {
      return await db.getAllUsers();
    }),

    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getUserById(input.id);
      }),

    updateRole: adminProcedure
      .input(
        z.object({
          id: z.number(),
          role: z.enum(["user", "admin"]),
        })
      )
      .mutation(async ({ input }) => {
        return await db.updateUserRole(input.id, input.role);
      }),
  }),

  // ============ PAYMENT SETTINGS ============
  paymentSettings: router({
    get: adminProcedure.query(async () => {
      return await db.getPaymentSettings();
    }),

    update: adminProcedure
      .input(
        z.object({
          stripePublishableKey: z.string().optional(),
          stripeSecretKey: z.string().optional(),
          stripeEnabled: z.boolean().optional(),
          paypalEnabled: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await db.updatePaymentSettings(input);
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
          path: z.string(),
          query: z.string().optional(),
          categorySlug: z.string().optional(),
          resultCount: z.number().int().optional(),
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
      .input(z.object({ days: z.number().int().min(1).max(365).optional() }).optional())
      .query(async ({ input }) => {
        return await db.getAnalyticsSummary(input?.days ?? 30);
      }),

    emptyResults: adminProcedure
      .input(z.object({ days: z.number().int().min(1).max(365).optional() }).optional())
      .query(async ({ input }) => {
        return await db.getEmptyResultEvents(input?.days ?? 30);
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
                content: z.string().min(1).max(2000),
              })
            )
            .min(1)
            .max(20),
        })
      )
      .mutation(async ({ input }) => {
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
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PRINTIFY_SHOP_ID isn't set" });
        }
        return await printify.listProducts(ENV.printifyShopId);
      }),

      getProduct: adminProcedure
        .input(z.object({ productId: z.string() }))
        .query(async ({ input }) => {
          if (!ENV.printifyShopId) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PRINTIFY_SHOP_ID isn't set" });
          }
          return await printify.getProduct(ENV.printifyShopId, input.productId);
        }),

      importProduct: adminProcedure
        .input(
          z.object({
            productId: z.string(),
            variantId: z.number(),
            categoryId: z.number(),
            stock: z.number().int().min(0).default(50),
          })
        )
        .mutation(async ({ input }) => {
          if (!ENV.printifyShopId) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PRINTIFY_SHOP_ID isn't set" });
          }

          const detail = await printify.getProduct(ENV.printifyShopId, input.productId);
          const variant = detail.variants.find(v => v.id === input.variantId);
          if (!variant) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Variant not found on that product" });
          }

          const image = detail.images.find(i => i.is_default) ?? detail.images[0];

          const product = await db.createProduct({
            name: `${detail.title} - ${variant.title}`,
            description: detail.description?.replace(/<[^>]+>/g, "").slice(0, 2000),
            price: (variant.price / 100).toFixed(2),
            categoryId: input.categoryId,
            stock: input.stock,
            imageUrl: image?.src,
          });

          if (!product) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create product" });
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
            keyword: z.string().optional(),
            pageNum: z.number().int().min(1).default(1),
          })
        )
        .query(async ({ input }) => {
          return await cj.searchProducts({ keyword: input.keyword, pageNum: input.pageNum });
        }),

      importProduct: adminProcedure
        .input(
          z.object({
            productId: z.string(),
            vid: z.string(),
            name: z.string(),
            price: z.string(),
            imageUrl: z.string().optional(),
            categoryId: z.number(),
            stock: z.number().int().min(0).default(50),
          })
        )
        .mutation(async ({ input }) => {
          const product = await db.createProduct({
            name: input.name,
            price: input.price,
            categoryId: input.categoryId,
            stock: input.stock,
            imageUrl: input.imageUrl,
          });

          if (!product) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create product" });
          }

          return await db.linkProductToDropship(product.id, {
            dropshipProvider: "cj",
            dropshipProductId: input.productId,
            dropshipVariantId: input.vid,
          });
        }),
    }),
  }),

  payments: router({
    momo: router({
      // Public: the checkout page needs to know whether to show the MoMo
      // flow or fall back to "we'll confirm payment manually" messaging.
      status: publicProcedure.query(() => ({
        configured: momo.isMomoConfigured(),
      })),

      // Lets the client show the real RWF amount that will actually be
      // charged (converted from this store's USD prices) before the
      // customer commits to paying — uses the same conversion requestToPay
      // uses below, so what's displayed matches what's charged.
      previewAmount: protectedProcedure
        .input(z.object({ orderId: z.number() }))
        .query(async ({ ctx, input }) => {
          const order = await db.getOrderById(input.orderId);
          if (!order || order.userId !== ctx.user.id) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
          }

          const { rwfAmount, rate, source } = await convertUsdToRwf(parseFloat(order.totalAmount));
          return { usdAmount: order.totalAmount, rwfAmount, rate, source };
        }),

      requestToPay: protectedProcedure
        .input(z.object({ orderId: z.number(), phone: z.string().min(6) }))
        .mutation(async ({ ctx, input }) => {
          const order = await db.getOrderById(input.orderId);
          if (!order || order.userId !== ctx.user.id) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
          }
          if (order.status !== "pending") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "This order isn't awaiting payment" });
          }

          try {
            const { rwfAmount } = await convertUsdToRwf(parseFloat(order.totalAmount));

            const { referenceId } = await momo.requestToPay({
              amount: rwfAmount,
              phone: input.phone,
              externalId: order.orderNumber,
              payerMessage: `Xirel order ${order.orderNumber}`,
            });

            await db.setOrderPaymentReference(order.id, referenceId);
            return { referenceId, rwfAmount };
          } catch (error) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: error instanceof Error ? error.message : "Failed to start MoMo payment",
            });
          }
        }),

      checkStatus: protectedProcedure
        .input(z.object({ orderId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          const order = await db.getOrderById(input.orderId);
          if (!order || order.userId !== ctx.user.id) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
          }
          if (!order.paymentReference) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "No payment in progress for this order" });
          }

          const { status } = await momo.checkRequestToPayStatus(order.paymentReference);

          if (status === "SUCCESSFUL" && order.status === "pending") {
            const updated = await db.updateOrderStatus(order.id, "paid");
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
