# Aurora Design Guidelines (Compacted)

## Design System: Linear + Notion Hybrid

**Principles:** Role-based clarity, real-time transparency, progressive disclosure, accessibility-first

**Font Stack:**
- Primary: Inter (Google Fonts)
- Monospace: JetBrains Mono (IDs, timestamps, timers)

---

## Typography Scales

**Admin/Publisher:**
- Page Title: `text-2xl font-semibold tracking-tight`
- Section: `text-lg font-semibold`
- Card Title: `text-base font-medium`
- Body: `text-sm font-normal`
- Meta: `text-xs font-normal tracking-wide uppercase`
- Table Headers: `text-xs font-semibold uppercase tracking-wider`

**Facilitator Console:**
- Header: `text-xl font-semibold`
- Timer: `text-4xl font-bold tabular-nums`
- Actions: `text-sm font-semibold`
- Status: `text-xs font-medium uppercase tracking-wide`

**Participant:**
- Instructions: `text-lg font-medium leading-relaxed`
- Notes: `text-sm font-normal leading-snug`
- Voting: `text-base font-normal`
- Readouts: `text-2xl font-semibold` / `text-base leading-relaxed`

---

## Layout & Spacing

**Spacing Units:** 1, 2, 3, 4, 6, 8, 12, 16, 20, 24

**Common Patterns:**
- Micro: `gap-1`, `space-x-1`
- Component: `p-3`, `p-4`
- Cards: `p-6`
- Sections: `gap-6`, `space-y-6`
- Page: `px-6 md:px-12`, `space-y-8`

**Containers:**
- Max-width: `max-w-7xl mx-auto` (content), `max-w-3xl` (readouts), `max-w-2xl` (modals)
- Sidebar: `w-64` (standard), `w-80` (wide)

**Grids:**
- Admin: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Metrics: `grid-cols-2 md:grid-cols-4`

---

## Components

### Navigation
**Top Bar:** `h-16`, sticky, backdrop-blur, border-b
- Left: Logo + breadcrumbs (`text-sm`, `/` separator with `opacity-40`)
- Right: Role badge, avatar, notifications

**Sidebar:** `w-64`, fixed
- Nav items: `p-3 rounded-md`, active with `border-l-4` accent
- Sections: `text-xs uppercase tracking-wide font-semibold mb-2 mt-6`
- Icons: Heroicons (outline/solid)

### Cards
**Standard:** `border rounded-lg p-6 shadow-sm hover:shadow-md`

**Metric:** `p-4`
- Number: `text-3xl font-bold tabular-nums mb-1`
- Label: `text-sm opacity-60`

**Space Card:** `p-6`, title `text-lg font-semibold`, hover `scale-[1.02]`

**Session:** Border accent by status, icon + timestamp (monospace)

### Forms
**Layout:** `space-y-6`
- Label: `text-sm font-medium mb-1.5 block`
- Input: `px-4 py-2.5 rounded-md border w-full focus:ring-2 focus:ring-offset-2`
- Helper: `text-xs opacity-60 mt-1.5`
- Error: `text-xs mt-1.5` (destructive)

**Profile Form:** `grid-cols-1 md:grid-cols-2 gap-6`

**Variants:**
- Textarea: `min-h-[120px] resize-y`
- Select: Custom arrow (Heroicons chevron-down) `absolute right-3`
- Checkbox: `w-4 h-4`

### Buttons
**Base:** `px-4 py-2.5 rounded-md font-semibold text-sm`
- Secondary: Add `border`
- Ghost: `px-3 py-2`, no border
- Icon-only: `p-2 rounded-md`

**Groups:** `flex space-x-3` or inline-flex for segmented controls

**Facilitator Actions:** Sticky bottom bar (`sticky bottom-0 border-t p-4 backdrop-blur`)

### Collaborative
**Sticky Note:** `w-48 h-48 p-3`
- Header: Author + timestamp
- Content: Scrollable `text-sm`
- Footer: Category pill
- Drag: `cursor-move`, grip icon

**Zone:** `border-2 border-dashed rounded-lg`, badge label, subtle tint background

**Category Pill:** `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium`
- AI: Italic + robot icon
- Manual: Standard

**Pairwise Duel:** `grid-cols-2 gap-8`
- Cards: `border-2` on hover
- Keyboard hints: `text-xs absolute` ("← Press 1" / "Press 2 →")
- Divider: "vs" badge
- Selected: Thick border pulse
- Progress: "X of Y" at top

**Stack Ranking:** 
- Items: `flex items-center gap-3 p-4 border rounded-md`
- Rank: `w-8 h-8 rounded-full` badge, `font-bold text-lg`
- Drag handle: Six-dot icon, `cursor-grab`
- Drop zones: `border-dashed border-2` pulse

### Data Display
**Participant List:** Grid of `w-8 h-8` avatar circles, online indicator (`w-2 h-2` dot), "+X more" overflow

**Tables:**
- Header: `sticky top-0 text-xs uppercase font-semibold tracking-wide`
- Rows: `px-4 py-3`, hover bg, `border-b`
- Top 3: Medal icons (Heroicons trophy)

**Results Tabs:** `border-b` with indicator, active `border-b-2`

**Cohort Comparison:** `grid-cols-1 lg:grid-cols-2 gap-6`, pulse differences

### Modals & Overlays
**Modal:** `max-w-lg mx-auto mt-20 rounded-lg shadow-xl p-6`
- Backdrop: `fixed inset-0 backdrop-blur-sm`
- Close: `absolute top-4 right-4` (x-mark icon)

**AI Overlay:** Full-screen gradient, spinner + progress, cancel button

**Timer Bar:** Sticky top, `text-lg font-semibold tabular-nums`, pulse when <1min

### Status & Feedback
**Badges:** `inline-flex px-2 py-0.5 rounded text-xs font-medium`
- States: Draft, Open, Closed, Processing
- Dot: `w-2 h-2 rounded-full mr-1.5`

**Toasts:** `fixed bottom-4 right-4 max-w-sm`, slide-in, auto-dismiss 5s

**Activity Feed:** `max-h-64 overflow-y-auto`, items `flex items-start gap-3 p-2`, recent highlight fade

**Loading:** Pulse skeletons, `w-4 h-4 animate-spin` inline

### Branding
**Org Header:** `flex items-center justify-between`, logo `max-h-12 object-contain`

**Publisher Badge:** "Synozur Publisher Portal" with org switcher dropdown

---

## Whiteboard Canvas (Konva.js)

**Container:** `min-h-[calc(100vh-4rem)]`, sticky toolbar, subtle dot grid, zoom controls bottom-right

**Interactions:**
- Toolbar click → cursor mode
- Drag zones (rectangle preview)
- Double-click → add note
- Shift+click → multi-select
- Delete key → confirm removal

**Feedback:**
- Selected: Dashed border + transform handles
- Hover: Shadow elevation
- Dragging: Opacity 0.7 + ghost
- Snap guides: Thin alignment lines

---

## Accessibility (WCAG 2.1 AA)

**Keyboard:**
- Skip links, visible focus (`ring-2 ring-offset-2`)
- Tab order = visual hierarchy
- ESC closes modals
- Arrows reorder rankings
- 1/2 keys pairwise vote
- Space select/activate

**Screen Readers:**
- Semantic HTML (`nav`, `main`, `article`)
- ARIA labels on icon buttons
- Live regions: `aria-live="polite"` (notifications), `"assertive"` (critical)
- `role="status"` for timer
- Alt: "Sticky note by [author]: [content preview]"

**Color Independence:** Icons + text for all status, sufficient contrast, visible focus always

---

## Responsive (Mobile-First)

**Breakpoints:**
- Base: Single column, stacked nav, bottom actions
- `md: 768px`: Two columns, toggleable sidebar
- `lg: 1024px`: Fixed sidebar, multi-column
- `xl: 1280px`: Max-width, increased whitespace

**Mobile:**
- Hamburger menu
- Full-width cards
- Bottom sheet modals
- `min-h-[44px]` touch targets
- Notes: `w-32 h-32`

---

## Visual Assets

**Icons Only:** Heroicons (CDN) - outline primary, solid emphasis

**No Images:** Content-driven visuals (notes, charts, avatars, real-time indicators)