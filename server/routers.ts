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
        })
      )
      .mutation(async ({ input }) => {
        try {
          const buffer = Buffer.from(input.imageData, "base64");
          const result = await storagePut(
            `products/${input.fileName}`,
            buffer,
            "image/jpeg"
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
        return await db.updateOrderStatus(input.id, input.status);
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
});

export type AppRouter = typeof appRouter;
