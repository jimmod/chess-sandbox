# Chess Sandbox Developer Guide

This guide describes how to set up the development environment, execute the test suite, implement new chess variants, and verify changes in **Chess Sandbox**.

---

## Environment Prerequisites

* **Node.js**: Version 22.13.0 or higher.
* **Package Manager**: `npm` (always use `npm ci` to ensure lockfile fidelity).

---

## Quick Reference Scripts

| Command | Purpose | Notes |
| --- | --- | --- |
| `npm ci` | Clean install | Reproducible dependency graph from committed `package-lock.json` |
| `npm run dev` | Start dev server | Launches Vite/Vinext local server on `http://localhost:3000` |
| `npm test` | Run test suite | Executes Node.js native test runner via `--experimental-strip-types` |
| `npm run typecheck` | Run type checking | Strict TypeScript verification via `tsc --noEmit` |
| `npm run build` | Production build | Compiles Cloudflare Worker entry, Wrangler config, and static client assets |

---

## Step-by-Step: Adding a New Rule or Variant

Follow this systematic procedure when contributing a new chess variant or rule toggle:

### Step 1: Extend the Rules Model in `lib/chess/engine.ts`
1. Add the new configuration property to the [`Rules`](file:///Users/jhalim/dev/chess-sandbox/chess-lab/lib/chess/engine.ts#L5-L19) type.
2. Provide a default value in the [`CLASSIC`](file:///Users/jhalim/dev/chess-sandbox/chess-lab/lib/chess/engine.ts#L26) baseline configuration object.

### Step 2: Implement Engine Semantics in `lib/chess/engine.ts`
1. **Move Generation**: If the rule affects piece mobility or legal destination squares, update [`legalMoves`](file:///Users/jhalim/dev/chess-sandbox/chess-lab/lib/chess/engine.ts#L309).
2. **Attacks & Check**: If the rule modifies threat calculations, update [`attacked`](file:///Users/jhalim/dev/chess-sandbox/chess-lab/lib/chess/engine.ts#L248) or [`inCheck`](file:///Users/jhalim/dev/chess-sandbox/chess-lab/lib/chess/engine.ts#L295).
3. **Move Application**: If the rule adds special side effects on move execution, update [`applyMove`](file:///Users/jhalim/dev/chess-sandbox/chess-lab/lib/chess/engine.ts#L416).
4. **Adjudication**: If the rule alters win, loss, or draw conditions, update [`outcome`](file:///Users/jhalim/dev/chess-sandbox/chess-lab/lib/chess/engine.ts#L457).

### Step 3: Align the AI in `lib/chess/ai.ts`
1. **Move Ordering**: If the new mechanic creates high-impact tactical actions (like explosions or instant drops), adjust `priority` in [lib/chess/ai.ts](file:///Users/jhalim/dev/chess-sandbox/chess-lab/lib/chess/ai.ts#L80) to order those moves earlier in Alpha-Beta pruning.
2. **Position Evaluation**: Add variant-specific scoring incentives to [`evaluate`](file:///Users/jhalim/dev/chess-sandbox/chess-lab/lib/chess/ai.ts#L5) so the AI recognizes favorable tactical states.

### Step 4: Expose Controls in the User Interface
1. **Presets**: If creating a new preset, add an entry to [`PRESETS`](file:///Users/jhalim/dev/chess-sandbox/chess-lab/lib/chess/engine.ts#L27) in `lib/chess/engine.ts` with `id`, `name`, `description`, `icon`, `rules`, and `details` (summary and bullet points).
2. **Rule Switches**: If creating an individual switch, add a toggle in the rule customization drawer in [app/page.tsx](file:///Users/jhalim/dev/chess-sandbox/chess-lab/app/page.tsx).

### Step 5: Write Comprehensive Tests
Add dedicated unit tests to [tests/engine.test.ts](file:///Users/jhalim/dev/chess-sandbox/chess-lab/tests/engine.test.ts):
* Validate piece move generation in custom positions.
* Validate that human and AI move validation share the engine.
* Validate that `chooseMove` successfully computes moves without throwing or timing out.

### Step 6: Update Documentation
Per repository guidelines, update [doc/ARCHITECTURE.md](file:///Users/jhalim/dev/chess-sandbox/chess-lab/doc/ARCHITECTURE.md) and [doc/VARIANTS.md](file:///Users/jhalim/dev/chess-sandbox/chess-lab/doc/VARIANTS.md) in the same commit.

---

## Pre-Commit Verification Checklist

Before opening a pull request or committing changes:

- [ ] **Type Check**: `npm run typecheck` completes with 0 errors.
- [ ] **Test Suite**: `npm test` runs and all 26+ tests pass.
- [ ] **Production Build**: `npm run build` succeeds without warnings or bundle errors.
- [ ] **Manual UI Check**:
  - Test moving a piece and receiving an AI response.
  - Test the **Undo** button.
  - Test switching presets and starting a **New Game**.
  - Test local two-player mode (**Human** opponent).
  - Verify mobile/responsive layout on narrow viewports.
- [ ] **Clean Git Workspace**: Verify that no credentials, `.env` files, or `.sites-runtime/` caches are staged.
