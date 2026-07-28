import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { ENV } from "./env";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  // Reports which backends are actually active — useful for confirming a
  // deployment is really using Turso/Cloudinary rather than silently
  // falling back to local storage that won't survive a redeploy.
  status: adminProcedure.query(() => ({
    database: ENV.tursoUrl ? ("turso" as const) : ("local-file" as const),
    imageStorage:
      ENV.cloudinaryCloudName && ENV.cloudinaryApiKey && ENV.cloudinaryApiSecret
        ? ("cloudinary" as const)
        : ("inline-data-uri" as const),
  })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
