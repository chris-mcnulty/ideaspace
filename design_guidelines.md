# Aurora Design Guidelines

## Design Inspiration
**models.synozur.com Aesthetic:** Professional maturity assessment platform with dark hero sections, clean card layouts, and modern typography.

## Design System: Synozur Professional

**Principles:** 
- Professional enterprise aesthetic
- Dark hero sections with gradient backgrounds
- Clean, card-based layouts with imagery
- Clear visual hierarchy
- Accessibility-first (WCAG 2.1 AA)

**Font Stack:**
- Primary: Inter (Google Fonts) - Clean, professional sans-serif
- Monospace: JetBrains Mono (IDs, timestamps, timers)

---

## Color Palette

**Primary (Synozur Purple):** `hsl(269, 97%, 52%)` - Deep violet for CTAs and key actions
**Secondary (Synozur Magenta):** `hsl(314, 90%, 47%)` - Accent color for highlights
**Accent (Light Blue):** `hsl(212, 51%, 93%)` - Subtle backgrounds and hover states

**Neutrals:**
- Background: White `hsl(0, 0%, 100%)`
- Card: Light gray `hsl(180, 7%, 97%)`
- Border: Subtle gray `hsl(201, 30%, 91%)`
- Muted: Medium gray `hsl(240, 2%, 90%)`

**Dark Mode:**
- Background: Pure black `hsl(0, 0%, 0%)`
- Card: Dark gray `hsl(228, 10%, 10%)`
- Foreground: Light gray `hsl(200, 7%, 91%)`

---

## Typography Scales

**Hero Sections:**
- Main Title: `text-4xl md:text-5xl font-bold tracking-tight`
- Subtitle: `text-lg md:text-xl font-normal leading-relaxed`
- Description: `text-base md:text-lg leading-relaxed`

**Page Headers:**
- Page Title: `text-2xl md:text-3xl font-semibold tracking-tight`
- Section: `text-lg font-semibold`
- Subsection: `text-base font-medium`

**Cards:**
- Card Title: `text-lg font-semibold`
- Card Subtitle: `text-sm font-medium`
- Card Body: `text-sm font-normal`
- Card Meta: `text-xs font-normal text-muted-foreground`

**Buttons & Actions:**
- Primary CTA: `text-base font-semibold`
- Secondary: `text-sm font-medium`
- Links: `text-sm font-normal underline-offset-4`

**Facilitator Console:**
- Timer: `text-4xl font-bold tabular-nums`
- Status: `text-xs font-medium uppercase tracking-wide`
- Actions: `text-sm font-semibold`

**Participant UI:**
- Instructions: `text-lg font-medium leading-relaxed`
- Notes: `text-sm font-normal leading-snug`
- Results: `text-2xl font-semibold`

---

## Layout & Spacing

**Spacing Units:** 1, 2, 3, 4, 6, 8, 12, 16, 20, 24

**Containers:**
- Max-width Content: `max-w-7xl mx-auto px-6 md:px-12`
- Narrow Content: `max-w-4xl mx-auto px-6`
- Form Modals: `max-w-2xl mx-auto`

**Hero Sections:**
- Padding: `py-16 md:py-24 lg:py-32`
- Background: Dark gradient or image with overlay
- Content: Centered, `max-w-4xl mx-auto text-center`

**Grids:**
- Space Cards: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`
- Metrics: `grid-cols-2 md:grid-cols-4 gap-4`
- Features: `grid-cols-1 md:grid-cols-2 gap-8`

**Cards:**
- Standard padding: `p-6`
- Compact: `p-4`
- Hero cards: `p-8`

---

## Components

### Hero Sections
**Landing Hero:**
```
bg-gradient-to-br from-background via-background to-primary/5
py-16 md:py-24 lg:py-32
text-center
max-w-4xl mx-auto px-6
```

**Features:**
- Large heading with gradient text effect (optional)
- Descriptive subtitle
- Primary CTA button
- Optional hero image/illustration
- Subtle gradient background

### Cards

**Space Card (models.synozur.com style):**
```
border rounded-lg overflow-hidden
shadow-sm hover:shadow-md transition
```
- Optional image at top (aspect-ratio-video or square)
- Content padding: `p-6`
- Title: `text-lg font-semibold mb-2`
- Description: `text-sm text-muted-foreground mb-4`
- Metadata badges: `text-xs` with icons
- CTA button: `w-full` at bottom
- Hover: Slight elevation with `hover:shadow-md`

**Assessment Card Pattern:**
- Image/icon at top (rounded corners)
- Title + short description
- Metadata row (questions, duration)
- Full-width CTA button
- Subtle border, clean shadows

**Metric Card:**
```
p-4 border rounded-lg
Number: text-3xl font-bold tabular-nums
Label: text-sm text-muted-foreground
```

### Navigation

**Top Bar (Branded):**
```
h-16 border-b bg-background/95 backdrop-blur
flex items-center justify-between px-6
sticky top-0 z-50
```
- Left: Logo + org name
- Right: User menu, notifications, role badge

**Breadcrumbs:**
```
text-sm text-muted-foreground
flex items-center gap-2
/  separator with opacity-40
```

### Buttons

**Primary CTA (Synozur style):**
```
bg-primary text-primary-foreground
px-6 py-3 rounded-lg
font-semibold text-base
hover:opacity-90 transition
shadow-sm hover:shadow-md
```

**Secondary:**
```
border border-border bg-background
px-6 py-3 rounded-lg
font-medium text-sm
hover:bg-accent transition
```

**Ghost:**
```
text-foreground hover:bg-accent
px-4 py-2 rounded-md
font-medium text-sm
```

**Button Groups:**
```
flex gap-3 flex-wrap
or
inline-flex items-center gap-2
```

### Forms

**Profile Registration Form (Waiting Room):**
```
space-y-6
max-w-md mx-auto
```
- Label: `text-sm font-medium mb-1.5`
- Input: `px-4 py-2.5 rounded-md border w-full`
- Focus: `focus:ring-2 focus:ring-primary focus:ring-offset-2`
- Helper text: `text-xs text-muted-foreground mt-1`

**Tabs (Join vs Register):**
```
border-b mb-6
Tab: px-6 py-3 relative
Active: border-b-2 border-primary font-semibold
Inactive: text-muted-foreground hover:text-foreground
```

### Collaborative Components

**Sticky Note:**
```
w-48 h-48 p-3 rounded-lg shadow-md
border-l-4 border-primary
bg-card
```
- Header: Author + timestamp (tiny text)
- Content: Scrollable, `text-sm`
- Footer: Category pill
- Drag handle: Cursor-move with grip icon

**Zone (Categorization):**
```
border-2 border-dashed rounded-lg p-6
min-h-[200px]
relative
```
- Label badge at top
- Accepts dropped notes
- Subtle tinted background per category

**Category Pill:**
```
inline-flex items-center px-2.5 py-0.5 
rounded-full text-xs font-medium
gap-1
```
- AI-generated: Italic with robot icon
- Manual: Standard styling

**Pairwise Duel Cards:**
```
grid grid-cols-2 gap-8
Each card: 
  border-2 rounded-lg p-6
  hover:border-primary cursor-pointer
  transition-all
Selected: border-primary shadow-lg
```
- "vs" divider badge between cards
- Keyboard hints: `text-xs absolute bottom-2`
- Progress indicator at top

**Stack Ranking:**
```
space-y-3
Item: 
  flex items-center gap-3 p-4 
  border rounded-md
  hover:shadow-md cursor-grab
Rank badge: 
  w-8 h-8 rounded-full bg-primary text-primary-foreground
  flex items-center justify-center font-bold
```

### Data Display

**Participant List:**
- Grid of avatars: `w-8 h-8 rounded-full`
- Online indicator: `w-2 h-2 bg-green-500 rounded-full absolute`
- Overflow: "+X more" text

**Status Badges:**
```
inline-flex items-center gap-1.5
px-2 py-0.5 rounded text-xs font-medium
Dot: w-2 h-2 rounded-full
```
- Open: Green dot
- Draft: Gray dot
- Closed: Red dot
- Processing: Animated pulse

**Tables (Results):**
- Header: `sticky top-0 bg-background text-xs uppercase font-semibold`
- Rows: `px-4 py-3 hover:bg-accent border-b`
- Top 3 ranks: Trophy/medal icons

### Modals & Overlays

**Modal:**
```
max-w-lg mx-auto mt-20 rounded-lg shadow-xl
p-6 bg-card border
backdrop: fixed inset-0 bg-black/50 backdrop-blur-sm
```
- Close button: `absolute top-4 right-4`
- Title: `text-xl font-semibold mb-4`
- Actions: `flex justify-end gap-3 mt-6`

**AI Processing Overlay:**
```
fixed inset-0 bg-gradient-to-br from-primary/20 to-background
flex items-center justify-center
z-50
```
- Spinner + progress text
- Cancel button
- Backdrop blur

**Timer Bar:**
```
sticky top-0 z-40
bg-background border-b px-6 py-3
text-lg font-semibold tabular-nums
```
- Pulse animation when <1min remaining
- Color changes based on time

### Status & Feedback

**Toasts:**
```
fixed bottom-4 right-4 max-w-sm
slide-in animation
border rounded-lg shadow-lg p-4
```
- Auto-dismiss after 5s
- Close button
- Icon based on type

**Loading States:**
- Skeleton: `animate-pulse bg-muted rounded`
- Spinner: `w-4 h-4 animate-spin` (lucide-react Loader2)
- Full page: Centered spinner with text

**Activity Feed:**
```
max-h-64 overflow-y-auto
Item: flex items-start gap-3 p-2 hover:bg-accent rounded
```
- Recent items highlighted
- Relative timestamps
- User avatars

---

## Whiteboard Canvas (Future)

**Container:** `min-h-[calc(100vh-4rem)]`
- Sticky toolbar at top
- Subtle dot grid background
- Zoom controls bottom-right

**Interactions:**
- Click toolbar → change cursor mode
- Drag to create zones
- Double-click → add note
- Shift+click → multi-select
- Delete key → confirm removal

---

## Accessibility (WCAG 2.1 AA)

**Keyboard Navigation:**
- Skip links for main content
- Visible focus rings: `ring-2 ring-offset-2 ring-primary`
- Tab order follows visual hierarchy
- ESC closes modals/dropdowns
- Arrow keys for rankings/lists
- 1/2 keys for pairwise voting
- Space to select/activate

**Screen Readers:**
- Semantic HTML: `<nav>`, `<main>`, `<article>`, `<section>`
- ARIA labels on icon-only buttons
- Live regions: `aria-live="polite"` for notifications
- `role="status"` for timers
- Alt text for images: "Space card for [name]"

**Color Independence:**
- Never rely on color alone
- Icons + text for all status
- Sufficient contrast (4.5:1 for text)
- Visible focus always

---

## Responsive Design (Mobile-First)

**Breakpoints:**
- Base (mobile): Single column, stacked
- `md: 768px`: Two columns, toggleable sidebar
- `lg: 1024px`: Three columns, fixed sidebar
- `xl: 1280px`: Max width, increased whitespace

**Mobile Adaptations:**
- Touch targets: `min-h-[44px]`
- Full-width cards
- Bottom sheet modals
- Hamburger navigation
- Smaller notes: `w-32 h-32`
- Simplified tables (cards instead)

---

## Visual Assets

**Icons:** Heroicons or Lucide React
- Outline for navigation/secondary actions
- Solid for emphasis/primary actions

**Images:**
- Organization logos: `max-h-12 object-contain`
- Space thumbnails: `aspect-video` or `aspect-square`
- User avatars: `rounded-full`

**No Stock Photos:** Use real content, gradients, or abstract patterns for visual interest

---

## Brand Customization (Per Organization)

**Customizable Elements:**
- Organization logo
- Primary brand color (replaces default primary)
- Header background (solid or gradient)
- Optional welcome message

**Fixed Elements:**
- Typography system
- Layout patterns
- Component structure
- Spacing system

**Header Pattern:**
```
flex items-center justify-between
px-6 py-4 border-b
Logo + org name: text-lg font-semibold
User section: avatar + role badge
```
