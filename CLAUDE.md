# Terminal PRO - Sport Betting Tracker

## What is this?
A professional sports betting tracking platform with cryptographic bet verification, a social tipster network, and advanced analytics. Spanish-language UI, targeting the Spanish/LATAM market for Champions League, Liga, and World Cup 2026.

## Tech Stack
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + Shadcn/ui + Framer Motion + Recharts
- **Backend**: Express.js + Drizzle ORM + PostgreSQL
- **Auth**: Supabase Auth (email/password + Google OAuth)
- **AI**: Google Gemini Vision (ticket scanning)
- **Routing**: Wouter (lightweight client router)
- **State**: TanStack Query (React Query) for server state

## Project Structure
```
client/src/
  pages/          - dashboard.tsx, profile.tsx, tipster-hub.tsx, verify.tsx, auth.tsx
  components/
    terminal/     - Dashboard components (Header, BetEditor, BetCard, BetFeed, StatsSection, etc.)
    tipster/      - Tipster Hub components (TipsterProfileModal, Comparator, Sparkline, etc.)
    share/        - ViralTicket, social share
    ui/           - Shadcn/ui components + skeleton-loaders
    profile/      - SkillRadar
  lib/            - bet-verification.ts, bet-math.ts, social-share.ts, animations.ts, export-utils.ts, theme-provider.tsx
  services/       - betService.ts, profileService.ts, transactionService.ts
  contexts/       - AuthContext.tsx, WidgetContext.tsx
  hooks/          - use-auth.ts, use-toast.ts
server/
  index.ts        - Express app setup with CORS, helmet, rate limiting
  routes.ts       - All API routes with auth, sanitization, audit logging
  storage.ts      - Database abstraction layer (Drizzle)
  db.ts           - Database connection
  telegram.ts     - Telegram bot integration with encrypted tokens
  security.ts     - Sanitization, encryption (AES-256-GCM), audit logger
  scan-ticket.ts  - Gemini Vision ticket scanner
shared/
  schema.ts       - Drizzle ORM schema (bets, strategies, userConfigs, transactions, tipsterProfiles, betVerifications)
```

## Key Features Implemented
1. **Bet CRUD** with full tracking (sport, league, event, market, odds, stake, status, cashout, etc.)
2. **Cryptographic Verification** - SHA-256 hash per bet, pre-event timestamp proof
3. **Tipster Hub** - Social network with verified profiles, tier rankings (Bronze-Diamond), comparator, sparklines
4. **5 Theme Presets** - Dark, Light, Terminal (neon green), Bloomberg (financial blue), Clean
5. **Command Palette** (Cmd+K) - Quick navigation to any feature
6. **Smart Banners** - Auto-detects win streaks, weekly profit, milestones
7. **Skeleton Loading** - Shimmer effect for all dashboard sections
8. **Framer Motion Animations** - Page transitions, staggered BetCard entrance
9. **Social Media Integration** - Twitter/X share, Telegram bot, Instagram caption
10. **Ticket Scanner** - Gemini Vision AI extracts bet data from photos
11. **CSV Export** - Full bet history download
12. **Onboarding Wizard** - 4-step setup for new users
13. **Expandable FAB** - Radial menu with shortcuts
14. **Referral System** - Shareable invite links
15. **P&L Calendar** - Daily profit/loss heatmap
16. **Analytics Modal** - Yield, ROI, distributions, Z-score, CLV, temporal data

## Security
- `helmet` for HTTP headers
- `express-rate-limit`: 100 req/min API, 30/min writes, 10/5min auth
- `cors` with strict origin whitelist in production
- Request size limit: 1MB
- Input sanitization (XSS prevention) on all write endpoints
- AES-256-GCM encryption for Telegram bot tokens
- Audit log for all write operations
- Auth verification on all protected routes (userId ownership checks)

## Database Schema (key tables)
- `bets` - Main betting records (40+ fields)
- `strategies` - User betting strategies
- `user_configs` - Settings (unitValue, initialCapital, targetBankroll)
- `transactions` - Deposits/withdrawals
- `tipster_profiles` - Social tipster profiles with stats
- `tipster_follows` - Follow relationships
- `bet_verifications` - Cryptographic proof chain

## Environment Variables
```
DATABASE_URL=postgresql://...
SESSION_SECRET=...
SUPABASE_URL=... (check client/src/lib/supabase.ts)
SUPABASE_ANON_KEY=...
AI_INTEGRATIONS_GEMINI_API_KEY=... (for ticket scanning)
AI_INTEGRATIONS_GEMINI_BASE_URL=...
APP_URL=https://terminalpro.app (for CORS)
```

## Commands
```bash
npm run dev       # Dev server (Vite + Express)
npm run build     # Production build
npm start         # Run production
npm run check     # TypeScript check
npm run db:push   # Push Drizzle schema to DB
```

## Deploy
- `render.yaml` - Render.com blueprint (auto-deploy with free PostgreSQL)
- `Dockerfile` - Multi-stage Node 20 slim build

## Development Guidelines
- All UI text is in Spanish
- Use Tailwind CSS utilities, avoid custom CSS
- Follow existing component patterns in terminal/ directory
- Use TanStack Query for all API calls
- Framer Motion for animations (see lib/animations.ts for presets)
- TypeScript strict: run `npx tsc --noEmit --skipLibCheck` before committing
- The theme system uses CSS variables - see index.css for all theme presets

## What Needs Work Next (Roadmap)
### Phase 2 - Growth
- Public tipster profiles with SEO-friendly URLs (/tipster/:username)
- Public leaderboard (no login required)
- Freemium paywall (Stripe integration)
- Telegram bot auto-publish on bet creation (currently manual)
- Embeddable widget for tipster blogs

### Phase 3 - Monetization
- Tipster marketplace (paid subscriptions)
- Affiliate links for betting houses
- Copy trading (follow a tipster's bets)
- Monthly tournaments/challenges

### Phase 4 - Scale
- Redis cache for leaderboards and stats
- Background job queue (Bull/BullMQ) for heavy computations
- Horizontal scaling with Docker + load balancer
- GDPR compliance (data export, account deletion)
- 2FA via Supabase

## Session Start Protocol

At the start of every session in this repo, before touching any task:

1. **Detect the current branch** with `git branch --show-current`.
2. **Check for an open PR on that branch** via `mcp__github__list_pull_requests`
   with `owner: "afc1204-coder"`, `repo: "sport-bet-pro"`,
   `head: "afc1204-coder:<branch>"`, `state: "open"`.
3. **If a PR exists**, immediately call `mcp__github__subscribe_pr_activity`
   with that PR number. CI failures, review comments and new pushes will then
   arrive as `<github-webhook-activity>` events during the session, so you can
   respond without the user asking. Mention the subscription in one sentence
   so the user knows it happened.
4. **If no PR exists**, skip silently — no subscription needed.

This is a per-session bootstrap. It's cheap (one API call) and it means no
review comment or CI failure gets missed mid-session.

## Autonomous Agents

Two scheduled agents run against this repo (see Anthropic Console → Agents for
IDs and logs). They are deliberately narrow — each has one job, runs on a
fixed cron, and posts to GitHub instead of committing directly.

1. **weekly-audit** (Mondays 08:00 UTC): runs the simplify review pattern
   (reuse / quality / efficiency agents in parallel) over commits landed in
   `main` during the previous 7 days. Opens a GitHub issue tagged `audit`
   with findings, or comments "clean week" if nothing surfaces.
2. **daily-main-test** (every day 06:00 UTC): checks out `main`, runs
   `npm ci && npx tsc --noEmit --skipLibCheck && npx vitest run`. If
   anything fails, opens a GitHub issue tagged `regression` with the stack
   trace. Never touches code.

Neither agent has commit or merge permissions. Both are bounded: weekly-audit
has a token budget of ~200k per run; daily-main-test exits early on first
failure. If you see them spamming issues, disable via `schedule` skill.
