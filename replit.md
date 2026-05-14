# Sports Betting Terminal Pro

## Overview

A professional sports betting tracking and bankroll management application built as a terminal-style dashboard. The app allows users to log bets, track performance metrics (profit, yield, ROI), manage betting strategies, and analyze their betting history. Features a dark, high-contrast terminal aesthetic inspired by financial trading platforms.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack Query for server state, React hooks for local state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom dark terminal theme (CSS variables for theming)
- **Form Handling**: React Hook Form with Zod validation

The frontend follows a feature-based component structure under `client/src/components/terminal/` for domain-specific components (BetCard, BetEditor, AnalyticsModal, etc.) and `client/src/components/ui/` for reusable shadcn components.

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Pattern**: RESTful JSON API under `/api/*` routes
- **Authentication**: Replit Auth (OpenID Connect) with session-based auth stored in PostgreSQL
- **Database ORM**: Drizzle ORM with PostgreSQL

The server uses a modular structure:
- `server/routes.ts` - API route definitions with authentication middleware
- `server/storage.ts` - Data access layer implementing `IStorage` interface
- `server/db.ts` - Database connection pool
- `server/replit_integrations/auth/` - Authentication module with Replit OIDC integration

### Data Storage
- **Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: `shared/schema.ts`
- **Key Tables**:
  - `bets` - Betting records with sport, event, odds, stake, status, etc.
  - `strategies` - User-defined betting strategies
  - `userConfigs` - User settings (unit value, initial capital, target bankroll)
  - `sessions` - Express session storage (required for Replit Auth)
  - `users` - User profiles (required for Replit Auth)

### Authentication Flow
Uses Replit Auth via OpenID Connect. The authentication module (`server/replit_integrations/auth/`) handles:
- Session management with `connect-pg-simple` for PostgreSQL session storage
- Token refresh and user session updates
- Protected route middleware (`isAuthenticated`)

### Build System
- **Development**: Vite dev server with HMR, proxied through Express
- **Production**: Vite builds to `dist/public`, esbuild bundles server to `dist/index.cjs`
- **Scripts**: `npm run dev` (development), `npm run build` (production build), `npm run db:push` (schema sync)

## External Dependencies

### Database
- PostgreSQL (via `DATABASE_URL` environment variable)
- Drizzle ORM for type-safe queries
- `connect-pg-simple` for session storage

### Authentication
- Replit Auth (OpenID Connect provider)
- `openid-client` and Passport.js for OIDC flow
- Requires `ISSUER_URL`, `REPL_ID`, and `SESSION_SECRET` environment variables

### UI Libraries
- Radix UI primitives (dialogs, selects, switches, etc.)
- Tailwind CSS with custom terminal theme
- Lucide React icons
- React Day Picker for calendar
- Embla Carousel for carousels
- Recharts for charts

### Development Tools
- Vite with React plugin
- Replit-specific plugins for development (error overlay, cartographer, dev banner)
- TypeScript with strict mode
- drizzle-kit for database migrations

## Recent Changes

### January 2026
- **Supabase Integration**: Migrated from Replit Auth to Supabase authentication
- **Database Column Fix**: Supabase uses `bet_type` column - all mappings in `betService.ts` use `bet_type` (SupabaseBetRow, rowToSchemaBet, betInputToRow, createBet, updateBet)
- **Hybrid League Input**: Competition/league input now uses HTML5 datalist pattern allowing both free text and selection from predefined list with premium styling (bg-zinc-900, rounded-xl, focus:ring-[#B0FB5D], ChevronDown icon)
- **GoalTracker Safety**: Added NaN/Infinity guards to all financial calculations (currentBankroll, progressPercent, growthPercent)
- **Escaleras Calculation**: Uses weighted average formula: (Sum(step.stake × step.odds)) / TotalStake - never multiply odds
- **Defensive Bet Creation**: createBet uses explicit dbPayload with proper parsing, removes undefined values before insert
- **YAxis Auto-Scale**: Bankroll chart uses 2% dynamic padding with minimum 1 unit: `Math.max(Math.abs(value) * 0.02, 1)` - chart fills space regardless of bankroll size
- **Calendar Date Normalization**: `getBetDisplayDate` splits on "T" and takes substring(0,10) to ensure YYYY-MM-DD format comparison
- **Settings via Supabase**: Profile settings (unitValue, initialCapital, targetBankroll) saved to Supabase `profiles` table via `profileService.ts` with upsert on `id` column
- **Date Formatting UX**: All dates now display as "7 Ene" format (capitalized month). Chart tooltip/X-axis uses `formatShortDate`, BetCard uses `formatBetDate(date, time)` returning "7 Ene, 18:30"
- **Complete Field Mapping**: betService.ts now maps ALL Supabase columns including is_live, is_cashout, cashout_val, is_long_term, resolution_date, comment, strategy_id, position, formation, player, is_substitute, tactic, tags, market_type, match_side, image_url, verified, closing_odds, is_value, is_parlay
- **YAxis Dynamic Padding**: Chart uses domain={['dataMin - (dataMax - dataMin) * 0.05', 'dataMax + (dataMax - dataMin) * 0.05']} with allowDataOverflow={true} - fills 90% of chart height
- **Date Filtering Fix**: filterBetsByWidgetPeriod and chartPeriodStats now use date-fns library (isSameDay, isWithinInterval, subDays, subMonths, subYears, startOfDay) for robust date comparisons without timezone issues
- **Analytics Filters Visible**: Accordion opens by default (defaultValue={["filters-basic"]}), "Mercado" filter moved from advanced to basic filters for visibility
- **DailyReport Date Fix**: DailyReport.tsx now uses date-fns (isSameDay, parseISO, startOfDay) for robust date filtering instead of direct string comparison. Fixes "Informe de Cierre" showing +0.00€ when dates exist
- **Advanced Filters Always Visible**: Removed conditional rendering of advanced filters section - now always shows with "Sin datos" message when no data exists for position/formation/matchSide fields
- **BetEditor Progressive Disclosure**: Reorganized form with visible zone (bet type, event, odds, stake, status switches, cashout) and collapsed zone (fecha/hora, deporte/liga, bookie, strategy, marketType chips, tipster, tags, position/formation/matchSide, CLV, comment). advancedOpen=false by default for cleaner UX
- **handleSaveBet Fix**: Added missing fields (position, formation, matchSide, tags, marketType) to handleSaveBet in dashboard.tsx - these were being dropped before reaching betService
- **Array Safety**: watchSelections now uses Array.isArray() check to prevent "reduce is not a function" error
- **Streak Display Format**: Widget de racha ahora muestra formato con signo (+3 para victorias, -2 para derrotas) en lugar de "3 W" / "2 L"
- **Streak Calculation Logic**: calcStreakForPeriod filtra por período, ordena cronológicamente, itera desde la más reciente y cuenta consecutivas (ignora void/pending)
- **Rolling Window Filters**: filterBetsByWidgetPeriod usa ventanas móviles (no calendario): 1S = hoy + 6 días = 7 días, 1M = hoy + 29 días = 30 días. Excluye fechas futuras.
- **Unified getBetTimestamp Helper**: Helper compartido que usa parseLocalDate + setHours para timestamps consistentes. Usado en riskStats y calcStreakForPeriod.
- **riskStats Refactored**: Usa ordenamiento DESC para racha (más reciente = índice 0) y ASC para max drawdown (cronológico)

## Critical Notes
- Supabase bets table column is `bet_type`, NOT `type` - all 5 places in betService.ts use `bet_type`
- Supabase bets table uses `competition` column (NOT `league`) - betService.ts maps competition↔league transparently
- Supabase bets table id is UUID (string) - `Bet.id` is `string`, NOT `number`. BetCard/BetFeed/dashboard all use `string` for bet ids
- Supabase profiles table uses `id` column (user's auth UUID) as primary key - NOT `user_id`
- Profile columns: `id`, `unit_value`, `initial_capital`, `target_bankroll`, `currency`, `created_at`, `updated_at`
- Drizzle schema (`shared/schema.ts`) is used ONLY for TypeScript types - bets CRUD goes through betService.ts → Supabase client, NOT Drizzle ORM
- Profit calculation in betService.ts: won = stake*(odds-1), lost = -stake, cashout = cashoutVal-stake, pending/void = 0
- Always validate financial calculations with Number.isFinite() before display
- Android WhatsApp sharing requires: cacheBust, skipAutoScale, type: 'image/jpeg', quality: 0.95, pixelRatio: 1