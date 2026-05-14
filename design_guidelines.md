# Design Guidelines - Sports Betting Terminal Pro

## Design Approach
**Reference-Based**: Terminal/Trading application aesthetic inspired by professional betting platforms and financial dashboards. Dark, high-contrast interface optimized for data density and quick decision-making.

## Core Design Principles
- **Data-First**: All information must be instantly scannable and hierarchically organized
- **Professional Terminal**: Dark theme with neon accents mimicking trading platforms
- **Mobile-Optimized**: Touch-friendly targets, swipe gestures, safe-area awareness for iOS/Android
- **Real-Time Feel**: Subtle animations and live status indicators for active bets

---

## Color System

**Background Layers**:
- Body: Pure black (#050505) with subtle radial gradient (dark gray to black)
- Glass surfaces: Semi-transparent dark (#0a0a0a at 85% opacity) with blur
- Cards: Very dark gray (#0f0f0f)
- Elevated elements: Slightly lighter dark (#161616)

**Functional Colors**:
- Primary/Win: Neon green (#00e676) with glow effect
- Loss: Bright red (#ff1744)
- Pending: Amber (#ffab00)
- Cashout: Electric blue (#2979ff)
- Parlay: Magenta (#d500f9)
- Accent: Purple (#7c4dff)

**Text Hierarchy**:
- Main text: Pure white (#ffffff)
- Secondary text: Medium gray (#9e9e9e)
- Borders: White at 10% opacity

---

## Typography

**Font Families**:
- UI Text: Inter (400, 500, 600, 700, 800 weights)
- Numbers/Data: JetBrains Mono (monospaced for tabular alignment)

**Hierarchy**:
- Brand: 1.1rem, weight 800, tight letter-spacing (-0.5px)
- Headers: 0.75-0.95rem, weight 700-800, uppercase with wide tracking (1px)
- Body: 0.75-0.85rem, weight 600
- Small labels: 0.6-0.65rem, weight 700, uppercase
- Numbers: Use JetBrains Mono, weight 700, sizes 0.9-1.15rem

---

## Layout System

**Spacing Units**: Use Tailwind's spacing scale, primary values: 2, 3, 4, 6, 8, 10, 12, 15, 16, 18, 20, 25

**Border Radius**:
- Large components: 16px
- Medium elements: 10-14px
- Small elements/tags: 6-8px
- Pills: 20px

**Safe Areas**: Account for mobile notches/home indicators - add bottom padding using `env(safe-area-inset-bottom)` plus 100px for navigation

**Grid Patterns**:
- KPI cards: 3-column grid on mobile, equal width
- Stats row: 2-column for wider metrics
- Bet feed: Single column, full-width cards with margins

---

## Component Library

### Header (Sticky)
- Glassmorphism background with blur
- Brand left (with "PRO" badge in neon green pill)
- Icon buttons right (36x36px, subtle background, 10px radius)
- KPI grid below (3 or 2 columns depending on metrics)
- Thin gradient accent line at top of KPI cards

### KPI Cards
- Dark background with subtle border
- Centered layout
- Small uppercase label (0.6rem)
- Large monospaced value (1rem+)
- Color-coded based on metric (green for positive, red for negative)
- Optional animated progress bar at bottom (2px height, neon glow)

### Analytics Chart
- Tab navigation centered (small pills, 0.7rem text)
- 250px height chart area
- Reset zoom button (top right, dark overlay)
- Chart.js integration with zoom/pan support

### Bet Cards (Feed)
- Dark background with subtle border
- 4px colored left edge indicator (status: win/loss/pending/cashout)
- Two-column grid: info left, financials right
- Header: League badge (small, neon green uppercase)
- Match title (0.95rem, bold)
- Market info (monospaced, light gray)
- Tags row: small pills for attributes (LIVE, VALUE, CASHOUT, PARLAY, strategy name)
- Actions footer: edit/delete links (small, bordered pills)
- Comment section if present (italic, darker text, top border)

### Tags System
- Tiny pills (0.6rem, bold, uppercase)
- Standard: Dark with subtle border
- LIVE: Red background with pulse animation
- VALUE/CASHOUT/PARLAY: Solid color backgrounds (green/blue/magenta) with black text
- Strategy: White border with semi-transparent white background

### Toast Notifications
- Fixed top-center positioning
- Dark semi-transparent background with heavy blur
- 4px colored left border (green/red/amber based on type)
- Slide-in animation from top
- Auto-dismiss with fade-out

### Floating Action Button (FAB)
- Bottom-right fixed position
- Large circular button (60-70px)
- Primary color with glow effect
- Plus icon centered
- Slight elevation shadow

---

## Animations & Interactions

**Micro-interactions**:
- Button press: scale(0.92) on active
- Card tap: scale(0.98) with background change
- LIVE tag: infinite pulse opacity animation (0.6 to 1)
- Progress bars: 1s smooth transition with cubic-bezier easing
- Toast: slide-in 0.3s, fade-out when dismissing

**Hover States** (Desktop):
- Subtle background brightening
- Border color change to lighter shade
- Smooth 0.2s transitions

**Constraints**:
- Disable text selection globally
- Remove tap highlights on mobile
- Smooth font rendering (antialiased)

---

## Images

**Not Required**: This is a data-heavy dashboard application. No hero images or decorative photography needed. All visual interest comes from:
- Color-coded data visualization
- Chart graphics
- Iconography (use Font Awesome or Heroicons via CDN)
- Gradient overlays and glow effects

---

## Mobile-Specific

- Touch targets minimum 36x36px
- Swipe gestures enabled (via Hammer.js integration)
- Maximum viewport scale disabled
- Sticky header for persistent access
- Bottom navigation bar accounting for device safe areas
- Haptic feedback on critical actions (if supported)

---

**Critical Success Factors**: High information density without clutter, instant visual status recognition through color coding, professional terminal aesthetic that inspires confidence, smooth 60fps interactions on mobile devices.