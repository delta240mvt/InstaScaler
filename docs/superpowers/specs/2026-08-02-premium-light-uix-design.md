# Premium Light UIX Design

**Status:** Approved through the user's selection of direction A and instruction to proceed autonomously.

## Goal

Turn OpenReply into a polished private creator dashboard that feels calm, deliberate and expensive without changing product behavior. Every administrator surface must be comfortable on a phone, including login, navigation, campaign management, inbox, settings, diagnostics and loading/error states.

## Considered directions

1. **Premium light dashboard — selected.** Editorial typography, quiet neutral surfaces, restrained indigo accent, precise spacing and subtle depth. This best fits a focused single-owner tool and preserves readability during long sessions.
2. **Dark creator studio.** More dramatic and media-oriented, but less comfortable for dense forms and operational diagnostics.
3. **Warm minimal evolution.** Lowest implementation risk, but too close to the current flat orange interface to deliver the requested “MUAH” improvement.

## Visual language

- Use an ink-and-paper palette: warm white canvas, white cards, cool neutral borders, deep navy text and a restrained indigo primary accent.
- Use soft elevation only where hierarchy needs it. No glass effects, neon glow or decorative gradients across application content.
- Use one small atmospheric treatment on login to make the first impression feel intentional.
- Increase radius, whitespace and typographic contrast while keeping dense operational information scannable.
- Prefer small inline SVG icons and semantic status dots over text-only navigation or decorative illustrations.
- Provide consistent interaction states: hover, pressed, focus-visible, disabled, loading, success, warning and destructive.

## Shell and navigation

- Desktop uses a compact 248px sidebar with brand mark, grouped navigation, clear active state and a quiet account/system footer.
- The top bar supplies mobile navigation, page context and account connection state without repeating large page headings.
- Mobile uses an accessible slide-over navigation with backdrop, close control, body-safe viewport height and 44px touch targets.
- Main content uses a responsive maximum width, reduced phone gutters and safe bottom spacing.

## Pages

### Login

- A two-column composition on wide screens and a single focused card on mobile.
- Clear private-workspace message, password-manager-friendly inputs, visible labels, show/hide password, loading feedback and a compact security reassurance.
- No horizontal overflow at 320px; keyboard focus and errors remain visible.

### Dashboard and overview

- Strong welcome header, primary campaign action, compact account selector and consistent metric cards.
- Charts and activity sections use meaningful empty states, aligned labels and responsive stacking.
- Follower history becomes a clean visual timeline rather than a row of raw boxes.

### Campaigns and builder

- Campaign list gets a clear toolbar, strong status hierarchy, better cards, touch-safe actions and polished skeleton/empty states.
- Builder retains its current data contract but improves section grouping, progress context, labels, helper text, validation and sticky mobile-safe actions.
- Preview remains secondary and never crowds the form on narrow screens.

### Inbox

- Desktop keeps split list/thread behavior.
- Mobile shows one pane at a time with a clear back action, sticky thread header, safe composer and message bubbles sized for thumbs and virtual keyboards.

### Logs, settings and diagnostics

- Dense data uses responsive cards/tables, readable status pills and obvious actions.
- Destructive controls remain visually separated from primary actions.
- Diagnostics retains full operational detail but gains clearer budget, incident and replay hierarchy.

### Public and legal pages

- Shared reports and legal pages inherit typography, spacing, brand and responsive rules without exposing administrator navigation.

## Component boundaries

- `app/globals.css` owns tokens and reusable semantic utility classes for buttons, fields, cards, skeletons and page headings.
- `components/ui-icons.tsx` owns dependency-free accessible SVG icons.
- Shell components own navigation and responsive layout only.
- Page components keep their existing data-fetching and business behavior; UI changes must not alter API contracts.
- Existing reusable components (`StatCard`, `StatusBadge`, `AccountSelect`, campaign inputs) become the canonical visual primitives for their domains.

## Accessibility and responsive requirements

- WCAG-aware contrast, visible focus, semantic labels and non-color status cues.
- Minimum 44px interactive targets on mobile.
- Inputs remain at least 16px on phones to prevent iOS zoom.
- Layout must work at 320, 375, 768, 1024 and 1440px without horizontal page overflow.
- Respect reduced motion. Motion is limited to short opacity/transform feedback.
- Mobile drawers and dialogs expose labels, close actions and appropriate modal semantics.

## Error and loading behavior

- Replace blank blocks with shaped skeletons that mirror final layouts.
- Empty states explain the next action.
- Errors are presented near the affected control and use `role="alert"` when action is required.
- Loading buttons preserve width and communicate progress.

## Verification

- Keep all unit and contract tests green.
- Add tests for new pure UI helpers and login behavior where introduced.
- Run typecheck, lint, Prisma validation, dependency audit and OpenNext/Workers dry runs.
- Run Playwright scenario discovery and production HTTP smoke tests without the Codex browser.
- Verify generated bundles remain within the Workers Free compressed limit.
- Commit, push `baza020826-cf-native` and deploy Jobs, Core and Web from the synchronized HEAD.

## Non-goals

- No backend, API, database or Meta behavior changes.
- No new paid service, UI framework or icon dependency.
- No dark mode, theme switcher, animation framework or marketing-site expansion.
