import "dotenv/config";
import express, { type ErrorRequestHandler } from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import {
  getDb,
  deleteExpiredAuthRateLimits,
  bootstrapAdminForEmail,
} from "../db";
import { ENV } from "./env";
import { securityHeaders } from "./securityHeaders";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

const productionErrorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (!ENV.isProduction) {
    next(error);
    return;
  }

  const status = Number(
    (error as { status?: number } | undefined)?.status ?? 500
  );
  const safeStatus = status >= 400 && status <= 599 ? status : 500;
  const message =
    safeStatus === 413
      ? "Request payload too large"
      : safeStatus === 400
        ? "Invalid request"
        : "Internal server error";

  if (!res.headersSent) {
    res.status(safeStatus).json({ error: message });
  }
};

async function startServer() {
  // The bootstrap operation is an atomic conditional UPDATE. It only promotes
  // the explicitly configured ADMIN_EMAIL when no administrator exists.
  getDb();
  if (ENV.adminEmail) {
    await bootstrapAdminForEmail(ENV.adminEmail);
  }

  const app = express();
  const server = createServer(app);
  app.disable("x-powered-by");
  // Render terminates TLS at one trusted proxy hop. Set TRUST_PROXY_HOPS=0
  // for a direct deployment or to the exact number of trusted proxy hops.
  app.set("trust proxy", ENV.trustProxyHops);
  app.use(securityHeaders);

  // Large JSON payloads are needed for the existing base64 product-image
  // upload flow; urlencoded forms do not need the same allowance.
  app.use(express.json({ limit: "50mb", strict: true }));
  app.use(
    express.urlencoded({ limit: "1mb", extended: true, parameterLimit: 100 })
  );

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, path }) {
        if (error.code === "INTERNAL_SERVER_ERROR") {
          console.error("API request failed:", { path, code: error.code });
        } else if (error.code === "FORBIDDEN") {
          console.warn("[security] forbidden API request:", path);
        }
      },
    })
  );

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  app.use(productionErrorHandler);

  // Expired pseudonymous rate-limit buckets are periodically removed; this
  // cleanup is safe across instances because counters are stored in the DB.
  const cleanupTimer = setInterval(
    () => {
      void deleteExpiredAuthRateLimits(Date.now() - 24 * 60 * 60 * 1000).catch(
        () => {
          console.error("Authentication rate-limit cleanup failed.");
        }
      );
    },
    60 * 60 * 1000
  );
  cleanupTimer.unref();

  const preferredPort = parseInt(process.env.PORT || "3000", 10);
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);
  });
}

startServer().catch(error => {
  // Startup errors can contain database URLs or other provider details. The
  // JWT validator itself emits a safe, explicit configuration error before
  // this entry point is evaluated; all other startup failures stay redacted.
  const name = error instanceof Error ? error.name : "UnknownError";
  console.error("Server startup failed:", name);
  process.exitCode = 1;
});
