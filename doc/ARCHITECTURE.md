# Chess Sandbox architecture

This document describes the implemented system. Update it in the same commit as changes to module boundaries, game state, rules, AI behavior, dependencies, hosting, or storage. Keep proposed features clearly separate from shipped behavior.

## Product and design constraints

Chess Sandbox is a single-page chess game against a local AI, with customizable rules. Both human move validation and AI search must use the same engine and active rule configuration. Game execution requires no remote inference service, API key, or paid AI calls.

The current product supports local two-player games, but has no online multiplayer service, clocks, board editor, database-backed games, or browser persistence. Reloading starts a fresh game. The main route is `/`.

## System boundaries

```mermaid
flowchart TD
  User[Player] --> UI[React game UI: app/page.tsx]
  UI --> Engine[Pure rules engine: lib/chess/engine.ts]
  UI -->|Position, Rules, Difficulty| Worker[Browser Web Worker]
  Worker --> Search[AI search: lib/chess/ai.ts]
  Search --> Engine
  Worker -->|Move or error| UI
  UI --> History[In-memory position history]
  Browser[Browser request] --> Server[Cloudflare Worker / Vinext]
  Server --> Assets[HTML and client assets]
  Assets --> UI
```

The Cloudflare Worker serves the application; it does not play the game. The browser Web Worker is a separate runtime used for CPU-heavy AI search.

## Module map

| Module | Responsibility |
| --- | --- |
| `app/page.tsx` | Board, setup controls, turn lifecycle, promotion dialogs, history, undo, resignation, and optional WebMCP state reads |
| `app/layout.tsx` | Document metadata and product icon references |
| `app/globals.css` | Shared theme, board rendering, responsive layout, and branding |
| `lib/chess/engine.ts` | Types, presets, positions, attacks, move generation, move application, outcomes, repetition keys, notation |
| `lib/chess/ai.ts` | Evaluation and time-bounded iterative-deepening negamax search |
| `lib/chess/ai.worker.ts` | Browser worker message adapter for search |
| `components/ui/` | Vendored accessible UI primitives, composed by the game screen |
| `tests/engine.test.ts` | Engine correctness checks, special moves, and variant semantics |
| `vite.config.ts` | Vinext, Cloudflare, and retained hosting/preview plugins |
| `build/sites-worker.ts` | Server fetch entry point delegating to Vinext |
| `scripts/run-framework.mjs` | Selects framework execution using the local execution profile |
| `public/chess-sandbox-icon.png` | Canonical product icon, used in the header and document metadata |

## Position and rule model

`Position.board` is a 64-element array of pieces or null, indexed from a8 (0) to h1 (63). A piece stores color (`w` or `b`), kind (`p`, `n`, `b`, `r`, `q`, `k`), and an optional `promoted` flag. When `duckChess` is active, `Position.duck` tracks the neutral blocker's square index (`null` before the first placement). When `pieceDrops` is active, `Position.pockets` tracks available reserve pieces for White and Black (`p`, `n`, `b`, `r`, `q`). The position also stores side to move, castling rights, en passant target, halfmove counter, and ply count.

`Move` contains source and destination indexes (`from: -1` for pocket drops), with optional `duck` square index, `drop` piece kind, promotion kind, en passant victim index, and rook relocation for castling. `applyMove` returns a new position, updating board, duck placement, and pocket reserves. In Duck Chess, notation appends `@<duckSquare>` (e.g., `e4@d5`). When a piece is captured in Crazyhouse, it enters the capturer's pocket in the captured piece's kind, except promoted pieces (`promoted: true`) which return as pawns. Callers must supply a legal move; move application itself is not a validation boundary.

`Rules` contains twelve options: victory condition, duck chess blocker, piece drops / reserves, forced captures, castling, en passant, pawn double step, backward pawn captures, super knights, promotion policy, random starting position, and eligible-piece marking. Presets are Classic, Duck Chess, Crazyhouse, King of the Hill, Giveaway, and Wild Knights.

The engine generates pseudo-legal moves, filters king exposure for royal variants, then enforces mandatory captures. In Duck Chess, royal checks are disabled (`goal: 'capture'`), sliding piece rays and pawn moves cannot pass through or land on the duck (knights jump over it), and the player must move the duck to any other empty square after each piece move. Drops are generated for all empty squares (pawns restricted to ranks 2–7). Drops obey king safety: they can block an existing check, cannot be played elsewhere while leaving the king in check, and cannot expose the king to check. Giveaway always requires available captures, disables castling, and treats kings as ordinary pieces. Capture-the-king ignores check. Hill wins by reaching d4/e4/d5/e5 with a king or by checkmate. Super knights retain knight jumps and gain adjacent steps; backward pawn captures do not permit backward non-capturing moves.

## State and move lifecycle

1. Setup edits update `draft` rules and `draftHuman`. Active `rules` and `human` remain unchanged until a new game starts. Difficulty changes apply immediately.
2. Selecting a human piece or pocket reserve reveals legal destinations from `legalMoves`. Selecting a pocket piece highlights all legal drop squares on the board. A destination with multiple promotion moves opens a choice dialog.
3. In Duck Chess, selecting a piece move sets `pendingDuckMove` (unless the move captures the king to win immediately), highlighting all legal duck placement squares with pulsating indicators and a banner. Clicking any valid duck square invokes `commitMove` with `{ ...pendingDuckMove, duck }`.
4. `commitMove` applies the move, computes notation (e.g. `e4@d5`, `N@e4`, or `Q@g7#`), appends a snapshot, and clears selection.
5. The UI checks terminal engine outcomes, resignation, and threefold repetition (which incorporates pocket reserves, promoted piece marks, and duck placement) across its stored history.
6. On an AI turn, an effect creates a browser worker and sends `{ position, rules, difficulty }`. It returns `{ move }` or `{ error }`.
7. The effect terminates the worker on cleanup. New game, undo, resignation, and difficulty changes cancel obsolete search. Errors show a retry action.

History is the source of truth for the current position. Undo removes the human move and its AI reply, or only the pending human move if the AI has not replied. A new game resets history and selects the board orientation from the chosen human color. Board flipping is presentation-only.

## AI behavior and limits

The AI uses iterative-deepening negamax, alpha-beta pruning, capture/promotion move ordering, and variant-aware material/position evaluation. The last completed search iteration supplies the move when the time budget expires.

| Difficulty | Maximum depth | Search budget | Behavior |
| --- | --- | --- | --- |
| Easy | 1 ply | 120 ms | 35% random-move chance, otherwise noisy evaluation |
| Medium | 3 plies | 500 ms | Deterministic evaluation |
| Hard | 5 plies | 1600 ms | Deeper deterministic search |

Budgets are cooperative checks, not hard real-time guarantees. A 300 ms UI delay precedes search. Strength depends on device speed and variant branching factor; levels are not calibrated Elo ratings. Search has no repetition-history evaluation, transposition table, opening book, or quiescence search.

Threefold repetition and the 50-move rule are automatically adjudicated. Insufficient-material detection covers a useful subset of classic positions, not every FIDE dead position. Avoid claiming full tournament rules compliance.

## Browser interfaces and accessibility

The board supports click/tap selection, arrow-key focus movement, and Escape to clear selection. Squares expose coordinates and piece names. A prominent banner above the board contains the turn/result heading, human color, move number or terminal reason, and a compact White-versus-Black matchup. White is always on the left and Black on the right, independent of board orientation. Each side shows a Human icon or its AI difficulty icon (smile/easy, bolt/medium, flame/hard), with the side to move outlined. Turn and result changes are announced through an atomic live region. Check, thinking, and finished states have distinct visual treatments; thinking animation respects reduced-motion preferences. Radix/Shadcn supplies dialogs, switches, selectors, and radios.

When supported, the page registers `read_chess_game` through WebMCP. This read-only tool accepts only an empty object and returns the current board, rules, status, and engine-generated legal moves. Unsupported browsers proceed normally. Registration is cleaned up with an abort signal.

## Build and hosting

Use Node.js 22.13+ and the committed npm lockfile. `npm ci` installs the reproducible dependency graph. Keep Wrangler and `@cloudflare/workers-types` peer requirements compatible; change their package declarations and lockfile together.

`npm run build` produces a Cloudflare-compatible server entry in `dist/server/index.js`, generated Wrangler configuration in `dist/server/wrangler.json`, and browser assets in `dist/client`. Direct Cloudflare deployments should use the generated configuration. Do not hand-edit generated output.

The repository retains the original hosting adapter and connector scaffolding. The chess route does not invoke external connectors or require D1/R2. `.openai/hosting.json` identifies the original hosting integration; it is not a GitHub repository setting. Local execution profile data under `.sites-runtime/` is ignored, and clean clones default to the portable profile.

## Verification and maintenance

Run `npm run typecheck`, `npm test`, and `npm run build` for changes affecting engine, worker, or application behavior. The engine suite checks opening perft counts 20/400/8902, checkmate, castling restrictions, en passant, promotions, pinned pieces, and custom variants. For dependency changes also verify `npm ci`.

For UI or worker changes, verify a human move plus AI reply, undo, rule activation, and narrow-screen layout in the browser. For rule changes, add a focused position test and verify both human and AI use the rule. For branding changes, check visible header, metadata, icon, package metadata, and README.

Keep this document about the shipped architecture. Update README links and relevant limitations when capabilities change. Do not commit generated build output, TypeScript caches, local credentials, or environment files.

## Randomized starting positions

`initialPosition(rules, random)` accepts the active rules and an injectable random source for reproducible tests. `randomStart` supports three options:

- `off`: Standard initial chess layout and castling rights.
- `except-pawns`: Fisher–Yates shuffles the eight back-rank pieces once and mirrors the order for both colors. Pawns stay on their usual ranks, shielding kings. A classic-order result swaps two pieces so the opening visibly differs.
- `all`: Shuffles all 16 pieces and pawns across each player's home ranks (ranks 1–2 for White, ranks 7–8 for Black), mirrored rank-symmetrically. Redraws if either king would start under check.

With any randomized start active (`except-pawns` or `all`), castling rights are empty throughout the game regardless of the stored castling preference, and the setup UI disables the castling switch.

Randomness runs only when starting a game, never during rendering or AI search. History retains the generated position so undo restores that same opening. Each new game samples a fresh arrangement; repeats are possible. Standard initial positions and preset defaults are unchanged.

## Eligible-piece marking

`Rules.markEligiblePieces` is a visual assistance option: it never changes legal moves or AI evaluation. It defaults to false except for the Giveaway preset. Selecting the Giveaway win condition also enables it; players can turn it off. Like other setup options, edits apply to the next game.

The UI derives eligible source squares directly from the shared engine's `legalMoves` result. On the human turn, and only while the game is ongoing, eligible pieces receive an inset outline, corner marker, and accessible “can move” label. Mandatory capture filtering therefore automatically restricts the markers to legal capturing pieces, including en passant, without separate UI rules. Markers are hidden during AI turns and after a result; destination markers remain separate.

## Random player side

The Play as selector accepts White, Black, or Random. `draftHuman` and `activeSideChoice` retain the selected preference separately from the resolved `human` color. Starting a game samples Random with equal probability for each color, updates the active preference, and orients the board for that color. Black starts trigger the normal AI opening turn. The preference remains Random for subsequent games, and does not incorrectly appear as an unapplied change after resolution. Changing the selector mid-game only stages the next game; flipping and undo do not reroll the side.

## Local opponent and themes

Meet your opponent offers Easy, Medium, Hard, and Human. Human switches the active board into local two-player mode, cancels AI search, and allows the side to move to select pieces. No network session is created. Status names White/Black, eligibility markers follow the active side, promotion uses the moving color, resignation records the resigning color, and undo removes one ply. Board orientation stays fixed until explicitly flipped; Play as is hidden in this mode. Switching back to an AI level resumes AI play using the previously selected human color. Mode changes clear pending selection and promotion without discarding history.

The header Color theme selector offers Forest, Ocean, Violet, and Amber. A React preference sets `data-theme` on the document root. CSS palette tokens recolor board squares, surfaces, accents, text tints, controls, and portaled dialogs together. Error/warning colors and the product icon retain their identity. Theme selection is session-only and does not affect game state or move legality. Preset buttons use compact icon/name/description rows.
