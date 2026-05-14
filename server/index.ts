import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { runRuntimeMigrations } from "./db-migrations";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// ─── CORS: strict origin whitelist ───
const allowedOrigins = [
  process.env.APP_URL || "http://localhost:5000",
  "https://oddsmark.app",
  "https://www.oddsmark.app",
  "https://terminalpro.app",
  "https://www.terminalpro.app",
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (process.env.NODE_ENV !== "production") {
      callback(null, true); // Allow all in dev
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token", "X-Confirm-Action"],
}));

// ─── Request size limit: prevent payload attacks ───
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// ─── Request logging ───
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse).slice(0, 200)}`;
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  // Install runtime SQL migrations (triggers, functions) before routes go live.
  if (process.env.SKIP_RUNTIME_MIGRATIONS === "true") {
    log("Runtime migrations skipped by SKIP_RUNTIME_MIGRATIONS");
  } else {
    await runRuntimeMigrations();
  }

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    console.error("Unhandled error:", err);
    // Don't expose internal error details in production
    const message = process.env.NODE_ENV === "production" && status >= 500
      ? "Internal Server Error"
      : err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  // Diagnostic: log that static serving is about to start
  if (process.env.NODE_ENV === "production") {
    try {
      serveStatic(app);
      log("Static file serving configured");
    } catch (err) {
      console.error("FATAL: serveStatic failed:", err);
    }
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "3000", 10);
  httpServer.listen(
    { port, host: "0.0.0.0" },
    () => { log(`serving on port ${port}`); },
  );
})();
