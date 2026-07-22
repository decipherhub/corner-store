# Design

## Source of truth
- Status: Active
- Last refreshed: 2026-07-23
- Primary product surfaces: RFQ Trader, Security demo, read-only Operator view
- Evidence reviewed: `services/operator-dashboard/index.html`, `services/operator-dashboard/README.md`, `share/RFQ Trading Console (standalone).html`, RFQ and Operator API contracts

## Brand
- Personality: institutional, precise, calm, compliance-first
- Trust signals: explicit live/fixture labels, exact quote payload review, transaction hashes, block numbers, policy status
- Avoid: consumer-exchange spectacle, unexplained mock data, hidden signing, decorative charts presented as live market data

## Product goals
- Goals: demonstrate quote request → review → compliant settlement without CLI steps; make policy enforcement and operator state visible
- Non-goals: production custody, hosted signing, real Securitize/TA integration, fake multi-maker liquidity
- Success signals: a first-time viewer can complete and explain the demo; every displayed datum has visible provenance

## Personas and jobs
- Primary personas: trader/demo viewer, compliance or product reviewer, protocol operator
- User jobs: request and settle a quote; prove stale signatures cannot bypass current policy; inspect deployment, manifest and confirmed demo events
- Key contexts of use: local Anvil demo, partner presentation, SDK integration review

## Information architecture
- Primary navigation: Trader · RFQ / Security demo / Operator
- Core routes/screens: single dashboard with three role-focused views
- Content hierarchy: environment → action → review → result → audit evidence

## Design principles
- Label provenance: Live, Preview, Demo fixture and Follow-up must never be visually conflated.
- Review before settlement: the exact signed quote is visible before execution.
- Current policy is authoritative: pre-checks are advisory; Router fill-time enforcement is explicit.
- Tradeoff: the MVP uses one live maker and local session history rather than implying a production order book.

## Visual language
- Color: ink `#12253f`, blue `#175ac4`, green `#0a8069`, red `#b7353d`, amber `#c98a2b`, line `#d2dce5`
- Typography: Georgia for display headings; system sans for UI; monospace for addresses, events and payloads
- Spacing/layout rhythm: flat bordered panels, 12–24px internal rhythm, two-column desktop layout
- Shape/radius/elevation: square institutional panels, minimal elevation
- Motion: limited to progress and status changes; no decorative motion
- Imagery/iconography: text and status-first; no unverified logos

## Components
- Existing components to reuse: status blocks, fact rows, quote cards, execution trace, event list, metrics strip
- New/changed components: compliance pre-check, session trade history, live indexed-event summary and log, live firm-rate marker over clearly labeled fixture market context, header help control and in-product presenter guide
- Variants and states: live/preview, available/expired, loading/empty/error/success/rejected
- Token/component ownership: dashboard CSS variables and classes in `services/operator-dashboard/index.html`

## Accessibility
- Target standard: WCAG 2.1 AA for core demo controls
- Keyboard/focus behavior: native buttons, inputs and details controls remain keyboard reachable; the demo guide traps focus, closes with Escape/backdrop/close control and restores focus to the help button
- Contrast/readability: status is conveyed with text in addition to color
- Screen-reader semantics: headings, labels, buttons and native details elements
- Reduced motion and sensory considerations: no essential information depends on animation

## Responsive behavior
- Supported breakpoints/devices: desktop presentation and mobile/tablet below 760px
- Layout adaptations: two columns collapse to one; event rows stack
- Touch/hover differences: controls retain explicit labels and at least practical touch padding

## Interaction states
- Loading: action-specific progress copy and disabled duplicate actions
- Empty: explain which action creates data
- Error: show actionable backend or settlement reason
- Success: show block, transaction and balance delta when available
- Disabled: explain prerequisite through nearby copy
- Offline/slow network: backend health and setup checks expose unavailable services

## Content voice
- Tone: concise, technical and demonstrable
- Terminology: quote, maker, Router, RFQAdapter, manifest, settlement, indexed event
- Microcopy rules: distinguish pre-check from fill-time enforcement; distinguish session state from persisted/indexed state

## Implementation constraints
- Framework/styling system: dependency-free vanilla HTML/CSS/JS served by Node
- Design-token constraints: reuse existing CSS variables; no new frontend dependency for the MVP
- Performance constraints: no blockchain calls or signing in the browser
- Compatibility constraints: current backend returns one live `SignedRFQQuote`; preview makers are non-selectable
- Data-provenance constraint: the live rate is derived from `/demo/quote`; comparison curves, spread, activity and non-live makers remain visibly labeled demo fixtures until market-data and multi-maker APIs exist
- Test/screenshot expectations: smoke and syntax tests are required; visual screenshot comparison is required when a browser runtime is available

## Open questions
- [ ] Replace session-only trade history with a persistent quote/trade lifecycle API.
- [ ] Replace demo event-file bridge with a production RPC ChainReader and finality-aware indexer.
- [ ] Add real multi-maker aggregation only when the backend returns multiple executable quotes.
