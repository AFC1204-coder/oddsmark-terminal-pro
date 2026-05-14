import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { storage } from "./storage";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  const indexHtml = fs.readFileSync(path.resolve(distPath, "index.html"), "utf-8");
  const publicAppUrl = (process.env.APP_URL || "https://oddsmark.app").replace(/\/$/, "");

  app.use(express.static(distPath));

  // Dynamic OG meta tags for public tipster profiles
  app.get("/tipster/:username", async (req, res) => {
    try {
      const profile = await storage.getTipsterByUsername(req.params.username);
      if (profile && profile.isPublic) {
        const title = `${profile.displayName} (@${profile.username}) — Oddsmark`;
        const description = profile.bio
          || (profile.isVerified
            ? "Tipster con ledger verificado en Oddsmark. Stats con prueba pre-evento."
            : "Perfil público en Oddsmark. Stats construidas desde apuestas con prueba pre-evento cuando existe hash.");
        const url = `${publicAppUrl}/tipster/${profile.username}`;
        const html = injectOgTags(indexHtml, { title, description, url });
        return res.send(html);
      }
    } catch {}
    res.send(indexHtml);
  });

  // Dynamic OG meta tags for verification pages
  app.get("/verify", async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code.trim() : "";
    if (code.length >= 8 && code.length <= 64) {
      try {
        const v = await storage.getVerificationByHash(code);
        if (v) {
          let snapshot: Record<string, unknown> = {};
          try { snapshot = JSON.parse(v.betDataSnapshot); } catch {}
          const event = (snapshot.event as string) || "Apuesta";
          const odds = snapshot.odds ? ` @${Number(snapshot.odds).toFixed(2)}` : "";
          const title = `Verificación: ${event}${odds}`;
          const description = v.isPreEvent
            ? "Apuesta verificada pre-evento. Registrada antes del partido."
            : "Apuesta registrada post-evento.";
          const url = `${publicAppUrl}/verify?code=${code}`;
          const html = injectOgTags(indexHtml, { title, description, url });
          return res.send(html);
        }
      } catch {}
    }
    res.send(indexHtml);
  });

  // Embed widget — serve with minimal OG tags
  app.get("/embed/:username", async (req, res) => {
    try {
      const profile = await storage.getTipsterByUsername(req.params.username);
      if (profile && profile.isPublic) {
        const title = `${profile.displayName} — Oddsmark Widget`;
        const description = profile.isVerified
          ? `Stats verificadas de @${profile.username} en Oddsmark`
          : `Stats públicas de @${profile.username} en Oddsmark`;
        const url = `${publicAppUrl}/embed/${profile.username}`;
        const html = injectOgTags(indexHtml, { title, description, url });
        return res.send(html);
      }
    } catch {}
    res.send(indexHtml);
  });

  // Dynamic OG for leaderboard
  app.get("/ranking", (_req, res) => {
    const html = injectOgTags(indexHtml, {
      title: "Perfiles Públicos — Oddsmark",
      description: "Perfiles con apuestas registradas antes del evento, métricas auditables y menos dependencia de capturas.",
      url: `${publicAppUrl}/ranking`,
    });
    res.send(html);
  });

  // All other routes -> SPA
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

function injectOgTags(html: string, meta: { title: string; description: string; url: string }): string {
  // Replace existing OG tags with dynamic ones
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${escHtml(meta.title)}</title>`)
    .replace(
      /<meta property="og:title"[^>]*>/,
      `<meta property="og:title" content="${escAttr(meta.title)}" />`
    )
    .replace(
      /<meta property="og:description"[^>]*>/,
      `<meta property="og:description" content="${escAttr(meta.description)}" />`
    )
    .replace(
      /<meta property="og:url"[^>]*>/,
      `<meta property="og:url" content="${escAttr(meta.url)}" />`
    )
    .replace(
      /<meta name="twitter:title"[^>]*>/,
      `<meta name="twitter:title" content="${escAttr(meta.title)}" />`
    )
    .replace(
      /<meta name="twitter:description"[^>]*>/,
      `<meta name="twitter:description" content="${escAttr(meta.description)}" />`
    );
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
