
# LMS Design System

## Design Identity

Name: Navy Blue Academic

Visual direction:
- Modern Academic SaaS
- Professional but friendly
- Clean and intuitive
- Subtle creative details
- Spacious layouts

## Color Tokens

Primary Navy: #0B1F3A
Secondary Navy: #153C70
Action Blue: #2563EB
Hover Blue: #1D4ED8
Light Blue: #DBEAFE
Canvas: #F8FAFC
Surface: #FFFFFF
Text Primary: #0F172A
Text Secondary: #64748B
Border: #E2E8F0

Semantic colors:
Success: #16A34A
Warning: #D97706
Danger: #DC2626

Use accessible contrast for all text.

## Color Distribution

- 70% white / light surfaces
- 20% navy identity
- 10% blue interactive accents

Avoid covering the entire application
with a navy background.

## Typography

Preferred font: Inter or Geist Sans

Page Heading: 28-32px
Section Heading: 20-24px
Card Heading: 16-18px
Body: 14-16px
Caption: 12-13px

Use a consistent type scale.

## Spacing

Base spacing scale: 4px

Recommended page padding:
Desktop: 24-32px
Tablet: 20-24px
Mobile: 16px

Card padding: 20-24px
Card gap: 16-24px

## Radius

Cards: 12-16px
Buttons: 8-10px
Inputs: 8-10px
Dialogs: 16px

## Shadow

Prefer subtle shadows and soft borders.
Do not use exaggerated floating effects.

## App Shell

Desktop:
- Navy sidebar, 256px expanded
- Collapsible navigation
- White/light topbar
- Light canvas
- Flexible content region

Mobile:
- Sidebar becomes a drawer
- Compact topbar
- Single-column main content
- Scrollable tables or adapted cards

## Components

Shared:
- AppShell
- Sidebar
- PageHeader
- StatCard
- ClassCard
- DataTable
- ProgressCard
- StatusBadge
- EmptyState
- ConfirmationDialog
- ApprovalDialog
- NotificationItem

Use shadcn/ui where appropriate.

## Buttons

Primary:
- Action Blue background
- White text
- Main action of current context

Secondary:
- Neutral surface
- Subtle border

Destructive:
- Danger semantic styling
- Require confirmation for important actions

## Animation

Sidebar: 200-250ms
Page transition: 180-240ms
Hover: 150-180ms
Dialog: 160-220ms
Tab indicator: 150-200ms
Progress animation: 350-500ms

Prefer opacity and transform animations.

Respect prefers-reduced-motion.

## UX Rules

- Never rely on color alone for status.
- Use labels and icons together where useful.
- Keep primary actions predictable.
- Display meaningful loading and empty states.
- Preserve clear focus indicators.
- Avoid unnecessary decorative motion.
