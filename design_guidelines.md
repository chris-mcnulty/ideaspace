# Nebula - Collaborative Envisioning Platform - Design Guidelines

## Design Inspiration
**Synozur Maturity Modeler Reference:** Dark mode professional platform with vibrant purple highlights, gradient text effects, and modern typography matching https://github.com/chris-mcnulty/synozur-maturitymodeler

## Design System: Dark Mode with Purple Highlights

**Principles:** 
- **Dark mode first** - Professional dark theme as default
- **Purple brand identity** - Vivid purple (`274 95% 52%`) throughout
- **Gradient text effects** - Blue→Purple→Pink gradients for hero headings
- **Clean card layouts** - Subtle borders, generous padding
- **Real-time collaboration** - Live indicators and smooth animations
- **Accessibility-first** - WCAG 2.1 AA compliance

**Font Stack:**
- Primary: **Avenir Next LT Pro** (custom font, 400 Regular & 700 Bold)
- Fallback: -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif
- Monospace: "Roboto Mono", "Courier New", monospace
- **Note**: Custom Avenir Next LT Pro fonts loaded via @font-face from `/fonts/`

---

## Color Palette

### Dark Mode (Default)

**Backgrounds:**
- Primary Background: `240 8% 6%` - Very dark blue-black (#0E0E12)
- Card/Surface: `240 12% 10%` - Slightly lighter (#15151E)
- Muted: `240 10% 14%` - Subtle variation
- Input: `240 12% 18%` - Form fields

**Text:**
- Foreground: `240 10% 92%` - Light gray (#EDEDF2)
- Muted: `240 5% 65%` - Medium gray for secondary text

**Borders:**
- Default: `240 10% 15%` - Subtle separation
- Card: `240 10% 12%` - Even more subtle

**Brand Colors:**
- **Primary Purple:** `274 95% 52%` (#810FFB) - Main brand color
- **Secondary Pink:** `315 92% 48%` (#E60CB3) - Accent highlights
- **Purple Foreground:** `0 0% 100%` - White text on purple

**Semantic:**
- Success: `141 73% 42%` (#1DB954 - Green)
- Warning: `41 100% 64%` (#FFC24A - Orange)  
- Error: `0 84% 60%` (#FF5A6E - Red)

**Charts:**
- Chart 1: Purple `274 95% 52%`
- Chart 2: Pink `315 92% 48%`
- Chart 3: Green `141 73% 42%`
- Chart 4: Orange `41 100% 64%`
- Chart 5: Red `0 84% 60%`

### Light Mode (Secondary)

**Backgrounds:**
- Background: `0 0% 100%` - White
- Card: `240 10% 98%` - Very light gray
- Muted: `240 10% 96%`

**Text:**
- Foreground: `240 10% 10%` - Almost black
- Muted: `240 5% 45%` - Medium gray

**Brand colors remain the same** - Purple `274 95% 52%` works in both modes

---

## Typography Scales

**Font Weights:**
- Regular: 400 (body text, buttons, nav)
- Bold: 700 (headings only)

**Hero Sections:**
- Main Title: `text-5xl md:text-6xl lg:text-7xl font-bold` with gradient
- Subtitle: `text-xl md:text-2xl font-normal leading-relaxed`
- Description: `text-lg leading-relaxed`

**Page Headers:**
- Page Title: `text-4xl md:text-5xl font-bold` with optional gradient
- Section: `text-2xl font-bold`
- Subsection: `text-xl font-bold`

**Cards:**
- Card Title: `text-lg font-bold`
- Card Body: `text-sm font-normal`
- Card Meta: `text-xs font-normal text-muted-foreground`

**Buttons & Actions:**
- Large CTA: `text-lg font-normal px-8 py-6`
- Primary: `text-base font-normal`
- Secondary: `text-sm font-normal`

**Facilitator Console:**
- Timer: `text-4xl font-bold tabular-nums`
- Status: `text-xs font-normal uppercase tracking-wide`
- Actions: `text-sm font-normal`

**Gradient Text (Hero Sections):**
```
className="text-gradient-blue-purple-pink"
// Blue (#60A5FA) → Purple (#810FFB) → Pink (#E60CB3)
```

---

## Layout & Spacing

**Spacing Units:** 1, 2, 3, 4, 6, 8, 12, 16, 20, 24, 32

**Containers:**
- Max-width Content: `max-w-7xl mx-auto px-4`
- Narrow Content: `max-w-4xl mx-auto px-4`
- Text Content: `max-w-3xl mx-auto`

**Hero Sections:**
- Min height: `min-h-[600px]` or `min-h-screen`
- Padding: `py-20`
- Background: Dark with gradient overlay or hero image
- Content: Centered, `text-center`

**Grids:**
- Model Cards: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6`
- Feature Grid: `grid-cols-1 md:grid-cols-2 gap-12`
- Metrics: `grid-cols-2 md:grid-cols-4 gap-4`

**Cards:**
- Standard padding: `p-6`
- Hero cards: `p-8`
- Border radius: `rounded-lg` (12px)

---

## Components

### Hero Sections

**Landing Hero with Image:**
```tsx
<section className="relative min-h-[600px] flex items-center bg-gray-900 overflow-hidden">
  <div className="absolute inset-0">
    <img src={heroImage} className="w-full h-full object-cover opacity-60" />
    <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/60" />
  </div>
  <div className="container relative z-10 mx-auto px-4 py-20 text-center">
    <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 text-white md:text-gradient-blue-purple-pink">
      Your Hero Title
    </h1>
    <p className="text-xl md:text-2xl text-white/90">Subtitle</p>
    <Button size="lg" variant="outline" className="bg-white/10 border-white/30">
      Get Started
    </Button>
  </div>
</section>
```

**Features:**
- Full viewport or 600px min-height
- Hero image with dark gradient overlay
- Gradient text for main heading
- White text on dark background
- Outline or primary buttons

### Cards

**Standard Card:**
```tsx
<Card className="p-6 border-2 hover-elevate">
  <h3 className="text-lg font-bold mb-2">{title}</h3>
  <p className="text-sm text-muted-foreground">{description}</p>
</Card>
```

**Features:**
- Dark surface background (`card`)
- Subtle border (`card-border`)
- Automatic hover elevation
- Generous padding

**Featured Card with Image:**
```tsx
<Card className="overflow-hidden border-2 border-primary/20 hover-elevate">
  <img src={image} className="w-full h-80 object-cover" />
  <div className="p-6">
    <h3 className="text-lg font-bold">{title}</h3>
  </div>
</Card>
```

### Buttons

**Primary (Purple):**
```tsx
<Button size="lg" className="px-8">
  Start Assessment
</Button>
```

**Outline (on images):**
```tsx
<Button variant="outline" className="bg-white/10 border-white/30">
  Sign Up
</Button>
```

**All buttons have:**
- Automatic hover/active elevation
- Purple primary color
- No manual hover states needed
- Min-height: 36px (sm), 40px (default), 44px (lg)

### Purple Highlights

**Where to Use Purple:**
1. ✅ Primary action buttons
2. ✅ Links and interactive text
3. ✅ Focus rings on inputs
4. ✅ Active navigation items
5. ✅ Selection highlights
6. ✅ Progress indicators
7. ✅ Category badges
8. ✅ Status indicators

**Gradient Usage:**
- Hero headings: `.text-gradient-blue-purple-pink`
- Accent text: `.text-gradient-purple-pink`
- Card backgrounds: `bg-gradient-to-br from-primary/20 to-accent/20`
- Button gradients: Use `bg-primary` (solid purple) for clarity

### Real-Time Elements

**Sticky Notes:**
```tsx
<div className="p-4 rounded-lg bg-yellow-100 dark:bg-yellow-900/20 border">
  <p className="text-sm">{noteContent}</p>
</div>
```

**Live Indicator:**
```tsx
<Badge variant="outline" className="gap-1">
  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
  Live
</Badge>
```

**Connection Status:**
```tsx
<div className="flex items-center gap-2 text-sm text-muted-foreground">
  <div className="w-2 h-2 rounded-full bg-purple-500" />
  <span>Connected</span>
</div>
```

### Forms

**Text Input:**
```tsx
<Input 
  className="bg-input border-border focus:ring-primary"
  placeholder="Enter text..."
/>
```

**Form Layout:**
- Labels above inputs
- Purple focus rings
- Error messages in red below
- Generous spacing (gap-4)

---

## Page-Specific Designs

### Landing Page (/)

**Hero:**
- Dark background with hero image
- Gradient overlay (`bg-gradient-to-b from-black/40 to-black/60`)
- Gradient text heading (blue→purple→pink)
- White text for body
- Outline buttons with blurred background

**Featured Section:**
- Gradient background (`bg-gradient-to-br from-primary/5 via-background to-accent/5`)
- Featured badge (purple)
- Large model card with image
- Purple CTAs

**Model Grid:**
- Card-based layout
- Hover elevation effects
- Images or gradient placeholders
- Purple highlights on hover

### Organization Home (/o/:org)

- Organization branding (logo, colors if customized)
- Space cards in grid
- Purple "Join" buttons
- Status badges

### Waiting Room (/o/:org/s/:space)

- Centered layout
- Participant count display
- Purple "Join" button
- Avatar list
- Dark card backgrounds

### Facilitator Workspace (/o/:org/s/:space/facilitate)

- Multi-panel layout
- Dark backgrounds
- Purple action buttons
- Note grid with hover states
- Bulk selection with purple highlights
- Session controls with status badges
- Participant sidebar
- Real-time indicators

### Participant View (/o/:org/s/:space/participate)

- Whiteboard/zone interface
- Sticky note creation
- Drag-and-drop interactions
- Purple category highlights
- Timer display

### Results View

- Large score display with purple badges
- Chart visualizations (purple/pink gradients)
- Category breakdown
- Export buttons

---

## Accessibility

- **Contrast**: 4.5:1 minimum for text on dark backgrounds
- **Touch targets**: 44x44px minimum
- **Focus indicators**: 2px purple ring on all interactive elements
- **Screen readers**: Proper ARIA labels
- **Keyboard navigation**: Full support
- **Motion**: Respect `prefers-reduced-motion`

---

## Animation Guidelines

**Use Sparingly:**
- Page load: 200ms fade-in
- Button hover: 150ms scale(1.02) + elevation
- Card hover: 200ms translateY(-2px) + shadow
- Progress: 300ms width transition
- Live updates: Subtle pulse (1s)

**Never:**
- Autoplay animations
- Infinite loops (except loading states)
- Jarring transitions
- Animations that move layout

---

## Dark Mode Implementation

**Technical Setup:**
```typescript
// App.tsx - Enable dark mode by default
useEffect(() => {
  document.documentElement.classList.add('dark');
}, []);
```

**CSS Variables:**
- All colors defined in `:root` (light) and `.dark` (dark)
- Purple primary works in both modes
- Automatic contrast adjustment via elevation system

**Best Practices:**
- Dark backgrounds: Use `bg-background` or `bg-card`
- Text: Use `text-foreground` or `text-muted-foreground`
- Borders: Use `border-border` or `border-card-border`
- Interactive: Use `bg-primary` for purple highlights

---

## Brand Voice

- **Empathetic**: "We're here to help you envision your future"
- **Action-oriented**: "Start your session", "Join now", "Create space"
- **Professional**: Clear, jargon-free language
- **Encouraging**: "Great progress!", "You're on track"
- **Inclusive**: People-first language

---

## Quick Reference

**Primary Color:** Purple `hsl(274, 95%, 52%)` (#810FFB)
**Background:** Dark `hsl(240, 8%, 6%)` (#0E0E12)
**Font:** Montserrat (or Avenir Next LT Pro)
**Gradient Text:** `.text-gradient-blue-purple-pink`
**Elevation:** `.hover-elevate`, `.active-elevate-2`
**Border Radius:** `rounded-lg` (12px)
**Spacing:** Generous (p-6, p-8, gap-6)
