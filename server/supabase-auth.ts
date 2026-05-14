/**
 * Supabase JWT auth middleware — replaces the Replit OIDC layer so the app
 * can run on any host (Render, Railway, VPS, etc.), not just Replit.
 *
 * The client sends `Authorization: Bearer <supabase-access-token>` on every
 * API call. This middleware verifies the token with Supabase and populates
 * `req.user` with the same `{ claims: { sub: userId } }` shape the routes
 * already expect — zero changes needed in any route handler.
 */
import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Lazy-init so the module can be imported even if env vars are missing (tests).
let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set");
    }
    _supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabase;
}

export const isAuthenticated: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.slice(7);
  try {
    const { data: { user }, error } = await getSupabase().auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    // Populate req.user with the same shape routes expect from the old
    // Replit OIDC middleware: req.user.claims.sub = Supabase user ID.
    (req as any).user = { claims: { sub: user.id } };
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

/**
 * No-op setup — Supabase JWT auth is stateless, no session/passport needed.
 * Kept as a function so routes.ts doesn't need to change its call pattern.
 */
export async function setupAuth(_app: Express) {
  // Nothing to initialize — auth is verified per-request via the JWT.
}

/**
 * Auth routes — login/logout are handled entirely by Supabase client-side.
 * The server doesn't need /api/login or /api/callback endpoints.
 * Register a /api/auth/me endpoint so the client can verify server reachability.
 */
export function registerAuthRoutes(app: Express) {
  app.get("/api/auth/me", isAuthenticated, (req: any, res) => {
    res.json({ id: req.user.claims.sub });
  });
}
