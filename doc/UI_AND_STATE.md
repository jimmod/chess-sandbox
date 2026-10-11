# Chess Sandbox UI & State Machine Guide

This document describes the front-end architecture, state management lifecycle, interaction workflows, CSS animation pipeline, and accessibility features implemented in [app/page.tsx](file:///Users/jhalim/dev/chess-sandbox/chess-lab/app/page.tsx) and [app/globals.css](file:///Users/jhalim/dev/chess-sandbox/chess-lab/app/globals.css).

---

## State Architecture

```mermaid
flowchart TD
  subgraph Draft State
    DraftRules[draft: Rules]
    DraftHuman[draftHuman: 'w' | 'b' | 'random']
  end

  subgraph Active Game State
    Rules[rules: Rules]
    Human[human: 'w' | 'b']
    History[history: Position[]]
    Notations[notations: string[]]
    Difficulty[difficulty: 'easy' | 'medium' | 'hard' | 'human']
  end

  subgraph Transient Interaction State
    Selected[selectedSquare: number | null]
    SelectedPocket[selectedPocket: PocketKind | null]
    PendingDuck[pendingDuckMove: Move | null]
    Promotion[pendingPromotion: Move[] | null]
    Animations[activeAnimations: AnimationState]
  end

  DraftRules -->|New Game| Rules
  DraftHuman -->|New Game & Resolve Random| Human
  Rules --> Engine[Pure Rules Engine]
  History --> Engine
  Engine --> LegalMoves[legalMoves]
  LegalMoves --> TransientInteractionState
```

### 1. Draft vs. Active State
To provide a non-destructive configuration experience, rules and side preferences are split:
* **Draft State (`draft`, `draftHuman`)**: Holds choices made in the setup panels (preset selection, custom rule toggles, play-as choice). Changes do not alter the current game on the board.
* **Active State (`rules`, `human`, `activeSideChoice`)**: Defines the game in progress. Clicking **New Game** commits the draft settings to active state, resolves `'random'` color with equal probability, and sets the initial board orientation.
* **Instant Settings**: Opponent difficulty (`'easy'`, `'medium'`, `'hard'`, `'human'`) applies immediately to the current game without resetting.

### 2. History as the Single Source of Truth
* `history: Position[]` records every position snapshot since the initial move.
* The current board state is always derived from `history[history.length - 1]`.
* Threefold repetition detection computes position hashes across `history`, accounting for board layout, side to move, castling rights, en passant targets, reserve pockets, and duck placement.
* Clicking **Undo** removes:
  * 2 plies if playing an AI opponent (reverts human move and AI response).
  * 1 ply if the AI is currently thinking or if playing in local two-player mode (`'human'`).

---

## Move Lifecycle & Interaction Flows

### Standard Piece Move Flow
1. **Selection**: User clicks a square containing a friendly piece. The engine computes `legalMoves(currentPos, rules)` and highlights destination squares with indicator dots.
2. **Execution**: User clicks an eligible destination square:
   * **Promotion**: If the move triggers promotion with multiple choices (`rules.promotion === 'choice'`), opens the Radix dialog showing Queen, Rook, Bishop, and Knight options.
   * **Commit**: Calls `commitMove(move)`.

### Duck Chess Two-Phase Move Flow
In Duck Chess (`rules.duckChess === true`), every turn requires moving a piece, then moving the neutral Duck:
1. **Phase 1 (Piece Move)**: User selects and executes a piece move.
   * If the piece move captures the opponent's King, the game ends immediately with victory.
   * Otherwise, the engine does not commit the move immediately. It stores `pendingDuckMove = move` and sets the UI to duck placement mode.
2. **Phase 2 (Duck Placement)**:
   * The status banner informs the player: *"Move the Duck to any unoccupied square."*
   * All empty board squares display pulsating amber indicators.
   * Clicking any empty square commits `{ ...pendingDuckMove, duck: clickedSquare }`, triggers the duck glide animation, and advances the turn.

### Pocket Drop Flow (Crazyhouse)
1. User clicks an available piece in their reserve pocket tray.
2. The board highlights all valid drop squares (empty squares; ranks 2–7 for pawns).
3. Clicking a highlighted square commits `{ from: -1, to: clickedSquare, drop: pieceKind }`.

---

## Animation Pipeline

Move animations are triggered within `commitMove` and coordinated via CSS custom properties and an `animSeq` reference counter:

| Effect | CSS Keyframe | Duration & Easing | Implementation Details |
| --- | --- | :---: | --- |
| **Piece Glide** | `piece-glide` | 160 ms `cubic-bezier(0.2, 0, 0, 1)` | Sets `--dx` and `--dy` pixel offsets; smoothly translates moving piece or castling rook. |
| **Drop Entrance** | `piece-drop-in` | 180 ms `ease-out` | Scales the dropped piece from 0.4 to 1.0 with a soft overshoot. |
| **Capture Shatter** | `shard-tl`, `shard-tr`, `shard-bl`, `shard-br` | 340 ms `ease-out` | Splits captured piece into 4 polygon shards that rotate and burst outward with brightness pulse. |
| **Atomic Blast** | `blast-expand` | 750 ms `cubic-bezier(0.1, 0.9, 0.2, 1)` | Centered custom vector [ExplosionIcon](file:///Users/jhalim/dev/chess-sandbox/chess-lab/components/explosion-icon.tsx) with expanding glowing shockwave ring. |
| **Duck Reposition** | `piece-glide` | 160 ms `ease-out` | Animates the neutral SVG [DuckIcon](file:///Users/jhalim/dev/chess-sandbox/chess-lab/components/duck-icon.tsx) from its previous square to its new square. |

*Reduced Motion*: When `@media (prefers-reduced-motion: reduce)` is detected, transform and scale keyframes are suppressed, and moves render instantaneously.

---

## Color Theme Architecture

Themes are configured via `data-theme` on the root document element:

* **Forest** (Default): Balanced emerald, moss, and warm wood tones.
* **Ocean**: Deep navy, steel, and cyan accents.
* **Violet**: Slate, amethyst, and vibrant purple highlights.
* **Amber**: Warm mahogany, bronze, and golden hues.

### Token Architecture in `app/globals.css`
Each theme defines ~130 semantic `--tone-*` CSS variables that power the design system:
* Board squares: `--tone-board-light`, `--tone-board-dark`, `--tone-board-border`
* Piece highlights: `--tone-highlight-select`, `--tone-highlight-dest`, `--tone-highlight-capture`
* Surfaces & controls: `--tone-surface-card`, `--tone-surface-input`, `--tone-accent-primary`
* Modals & overlays: Radix dialogs inherit theme tokens directly.

Theme changes are strictly presentation-level and do not cause re-renders of the chess engine.

---

## Accessibility & Keyboard Navigation

1. **Keyboard Movement**:
   * Players can navigate the 64 board squares using the **Arrow Keys**.
   * **Enter** or **Space** selects the focused square or commits a legal move to that square.
   * **Escape** deselects the current square and cancels pending promotions.
2. **Screen Reader Live Regions**:
   * An atomic `aria-live="polite"` region announces every move notation, check warnings, and game outcomes.
   * Board squares contain descriptive `aria-label` attributes (e.g., *"White Knight on f3"*, *"Empty square e4"*).
3. **Eligible Piece Markers**:
   * Visual indicators (`markEligiblePieces`) place a distinctive high-contrast outline on pieces that have legal moves, enabling immediate visual scanning in variants with mandatory captures.

---

## WebMCP Integration

When hosted in browsers supporting WebMCP (Model Context Protocol for web agents), Chess Sandbox registers the `read_chess_game` inspection tool:

```typescript
// Exposed to browser agents
navigator.modelContextProtocol?.registerTool({
  name: 'read_chess_game',
  description: 'Inspect the current board, rules, status, and legal moves in Chess Sandbox.',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => ({
    turn: currentPos.turn,
    board: currentPos.board,
    rules: activeRules,
    status: gameStatus,
    legalMoves: engineLegalMoves,
    outcome: terminalOutcome,
  })
});
```

* The tool is read-only and accepts only an empty object (`{}`).
* Registration is automatically cleaned up using an `AbortController` signal when the component unmounts.
