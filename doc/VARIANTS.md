# Chess Sandbox Rules and Variants Guide

This guide details all game variants, preset configurations, customizable rule switches, and edge cases implemented in **Chess Sandbox**.

Both human move validation and AI search share the pure rules engine in [lib/chess/engine.ts](file:///Users/jhalim/dev/chess-sandbox/chess-lab/lib/chess/engine.ts). Rule modifications are applied uniformly across the entire system.

---

## Presets Overview

Chess Sandbox ships with nine built-in presets. Each preset configures the 15 rule switches and provides descriptive explanations in the UI:

| Preset | Icon | Key Rules / Mechanics | Primary Goal |
| --- | :---: | --- | --- |
| **Classic** | ♔ | Standard FIDE chess rules, castling, en passant, pawn double-step | `checkmate` |
| **Learning Mode** | 🎓 | Threat warnings, top 3 move recommendations, color-coded quality targets | `checkmate` |
| **Duck Chess** | 🦆 | Neutral Duck blocker, 2-phase move (piece + duck), capture the king | `capture` |
| **Crazyhouse** | ♜ | Captured pieces enter reserves; drops allowed on empty squares | `checkmate` |
| **Atomic Chess** | 💥 | Captures cause 3x3 explosions destroying non-pawns; connected kings | `checkmate` / King blast |
| **Total Annihilation** | ⚔ | King is an ordinary soldier; capture every enemy piece to win | `annihilation` |
| **King of the Hill** | ⚑ | Standard chess plus immediate win upon king reaching the 4 center squares | `hill` or `checkmate` |
| **Giveaway** | ♙ | Antichess: mandatory captures, lose all pieces or moves to win | `giveaway` |
| **Wild Knights** | ♞ | Super Knights (knight jump + king step), backward pawn captures | `checkmate` |

---

## Detailed Preset Specifications

### 1. Classic Chess
* **Goal**: `checkmate`
* **Rules**: FIDE standard rules with standard initial layout (`randomStart: 'off'`).
* **Special Moves**:
  * Castling (kingside and queenside) with standard rights (`KQkq`). Cannot castle through or out of check.
  * En passant capture on the immediate next turn following a two-square pawn push.
  * Pawn promotion to Queen, Rook, Bishop, or Knight (`promotion: 'choice'`).
* **Draw Conditions**: Stalemate, threefold repetition (incorporating castling rights and en passant availability), 50-move rule, and classic insufficient material (bare kings, king + bishop vs king, king + knight vs king, or same-color bishops).

### 2. Learning Mode (Beginner Tutor & Coach)
* **Goal**: `checkmate`
* **Rules**: Standard FIDE rules with real-time coaching assistance enabled: `dangerWarnings: true`, `moveScoring: true`, and `markEligiblePieces: true`.
* **Core Mechanics**:
  * **Top 3 Move Recommendations**: Automatically calculates and highlights the top 3 moves with darker to lighter green square blocks on pieces. Interactive coach chips allow the player to select any of the top 3 moves with a single click.
  * **Color-Coded Move Quality**: Evaluates candidate move destinations along a spectrum: darker green for best moves, medium green for excellent, lighter green for good, amber for inaccuracies, light red for mistakes, and darker red for blunders.
  * **Threat Warnings**: Flags friendly pieces under immediate capture threat by the opponent with a `!` badge. Warns when selecting a move destination that enters enemy fire or vacates cover and uncovers another friendly piece (`⚠`).
  * **Marked Pieces**: Visually indicates all pieces possessing legal moves with subtle styling.

### 3. Duck Chess
* **Goal**: `capture` (no check or checkmate; kings can be captured directly).
* **Core Mechanics**:
  * A neutral Duck (`🦆`) occupies a single square on the board (`Position.duck`).
  * The Duck is entirely neutral: it cannot be captured, never belongs to either player, and blocks any piece from moving onto or passing through its square.
  * **Knights can jump over the Duck** just as they jump over any other piece.
  * **Turn Structure**: Each player must first make a legal piece move, then move the Duck to any other unoccupied square on the board.
  * If a piece move captures the opponent's King, the game ends immediately with victory; no duck placement step is required.
  * Castling through or to the Duck is forbidden.
* **Notation**: Duck placements append `@<square>` to the standard move notation (e.g., `e4@d5`, `Nf3@e5`).

### 4. Crazyhouse
* **Goal**: `checkmate`
* **Core Mechanics**:
  * **Reserve Pockets**: Each player has a pocket of captured pieces (`Position.pockets`).
  * When a player captures an opponent's piece, that piece changes color and enters the capturer's reserve pocket.
  * **Promoted Pieces**: Pieces that were promoted on the board (`promoted: true`, marked with `~` in the UI) revert to pawns upon capture before entering the capturer's pocket.
  * **Piece Drops**: On their turn, instead of moving a piece on the board, a player may drop any piece from their pocket onto any empty square (`from: -1`).
  * **Pawn Drop Restriction**: Pawns cannot be dropped onto the 1st or 8th rank (ranks 2–7 only).
  * **King Safety**: Drops obey standard check and checkmate rules. A drop can block an existing check, cannot be played to leave the friendly king in check, and can deliver checkmate.
* **Notation**: Drops use piece kind and target square with an `@` symbol (e.g., `N@e4`, `Q@g7#`, `P@d5`).
* **Draw Rules**: 50-move rule and insufficient material draws are disabled when piece drops are active.

### 5. Atomic Chess
* **Goal**: `checkmate` or detonate the enemy King.
* **Core Mechanics**:
  * **Explosions on Capture**: Any capture causes an immediate detonation centered on the destination square:
    * The capturing piece is destroyed.
    * The captured piece is destroyed.
    * All pieces on the eight adjacent squares are destroyed, **except pawns**. Pawns are immune to the blast radius and are only destroyed if directly captured or capturing.
  * **King Safety and Inviolability**:
    * Kings **cannot capture** any piece, as doing so would detonate the king.
    * Moves that result in blowing up one's own king (either by detonating an adjacent square or exposing it) are strictly illegal.
    * **Connected Kings**: When two kings are on adjacent squares ("touching"), neither king can be in check from any piece, because any capture would explode both kings.
    * Detonating the opponent's king results in an immediate win (`lastExplosion` records detonated squares).

### 6. Total Annihilation
* **Goal**: `annihilation`
* **Core Mechanics**:
  * **The King is Just a Soldier**: Royal safety is completely disabled. Check, checkmate, and stalemate do not exist.
  * Kings can be captured freely at any time without ending the game.
  * Kings may move into attacked squares ("kill zones") and adjacent to enemy kings without restriction.
  * **Victory Condition**: A player wins when all opposing pieces (both on the board and in reserve pockets) are eliminated.
  * **Stalemate Defeat**: If a player still has pieces remaining but has no legal moves left on their turn, they lose immediately.

### 7. King of the Hill
* **Goal**: `hill`
* **Core Mechanics**:
  * In addition to standard checkmate, any player who moves their king onto one of the four center squares—**d4 (35), e4 (36), d5 (27), or e5 (28)**—wins the game immediately.
  * Kings cannot move into or through check; the central square must be legally accessible.

### 8. Giveaway (Antichess / Losing Chess)
* **Goal**: `giveaway`
* **Core Mechanics**:
  * **Mandatory Captures**: Whenever a capture is possible on a player's turn, that player *must* make a capture (`forcedCapture: true`). Non-capturing moves are strictly illegal if any capture exists.
  * If multiple captures are possible, the player may choose between them.
  * Kings are ordinary pieces: check and checkmate do not exist, and kings can be captured.
  * Castling is disabled.
  * **Victory Condition**: A player wins by losing all of their pieces, or by having no legal moves left on their turn (stalemate is a win for the stalemated player).
  * **Assistance**: Eligible-piece marking (`markEligiblePieces: true`) is enabled by default to highlight only the pieces with legal capture moves.

### 9. Wild Knights
* **Goal**: `checkmate`
* **Core Mechanics**:
  * **Super Knights** (`superKnights: true`): Knights retain their traditional L-shaped jumps (2 by 1) and also gain king-like 1-square steps in all eight directions.
  * **Backward Pawn Captures** (`backwardCapture: true`): Pawns retain forward movement and standard diagonal captures, and also gain the ability to capture backwards diagonally (1 square backward, 1 square left or right). Backward non-capturing pushes remain illegal.

---

## The 15 Customizable Rule Switches

Every preset is a combination of 15 independent flags in the [`Rules`](file:///Users/jhalim/dev/chess-sandbox/chess-lab/lib/chess/engine.ts#L5-L20) type:

```typescript
export type Rules = {
  goal: 'checkmate' | 'capture' | 'hill' | 'giveaway' | 'annihilation';
  randomStart: 'off' | 'except-pawns' | 'all';
  duckChess: boolean;
  pieceDrops: boolean;
  atomic: boolean;
  dangerWarnings: boolean;
  moveScoring: boolean;
  markEligiblePieces: boolean;
  forcedCapture: boolean;
  castling: boolean;
  enPassant: boolean;
  doubleStep: boolean;
  backwardCapture: boolean;
  superKnights: boolean;
  promotion: 'choice' | 'q' | 'n';
};
```

### 1. `goal`
* `'checkmate'`: Traditional FIDE objective. Check safety enforced; checkmate wins, stalemate draws.
* `'capture'`: Royal check safety ignored. Win by directly capturing the opponent's king. Used by Duck Chess.
* `'hill'`: Dual win condition. Checkmate or reaching center squares (d4, e4, d5, e5) with the king.
* `'giveaway'`: Antichess objective. Win by losing all pieces or having zero legal moves. Check ignored.
* `'annihilation'`: Wipeout objective. Win by capturing all enemy pieces on the board and in pockets. Zero legal moves with surviving pieces results in defeat.

### 2. `randomStart`
* `'off'`: Standard starting layout.
* `'except-pawns'`: Shuffles the back-rank pieces (R, N, B, Q, K, B, N, R) using Fisher–Yates. Pawns remain on ranks 2 and 7 to shield kings. Both sides mirror the back-rank layout. Automatically clears castling rights.
* `'all'`: Shuffles all 16 pieces and pawns across ranks 1–2 for White and 7–8 for Black. Both sides mirror rank-symmetrically. Redraws if either king would start in check. Automatically clears castling rights.

### 3. `duckChess`
* Enables the neutral Duck blocker. Requires a piece move followed by a duck repositioning step to an empty square. Blocks sliding rays and pawn pushes; knights jump over.

### 4. `pieceDrops`
* Enables Crazyhouse reserve pockets and piece drops. Captured pieces enter the capturer's pocket in their own color. Promoted pieces revert to pawns. Pawns can only be dropped on ranks 2–7.

### 5. `atomic`
* Every capture detonates a 3x3 blast destroying capturer, victim, and adjacent non-pawns. Pawns are immune to the blast radius. Kings cannot capture and moves blowing up own king are illegal. Connected kings cannot be in check. Detonating enemy king wins immediately.

### 6. `dangerWarnings`
* Beginner assistance switch. Displays warning indicators (`!`) on friendly pieces that can be captured by the opponent on the next move. When selecting a piece to move, highlights dangerous destination squares where the moving piece can be eaten, and displays a warning (`⚠`) plus exposed piece outline when a move vacates cover and exposes another friendly piece to capture. Does not alter move legality or AI search.

### 7. `moveScoring`
* Coach and move evaluation assistance switch. Calculates real-time positional scores for legal candidate moves using depth-2 minimax search, sorts and ranks the top 3 best moves (`#1` to `#3`), provides interactive quick-select coach chips, and colors candidate piece squares (darker to lighter green) and move destination dots (dark green to dark red) without text clutter. Does not alter move legality or AI search.

### 8. `markEligiblePieces`
* UI visual assistance switch. Highlights pieces on the board that currently possess legal moves. When `forcedCapture` is active, highlights only the pieces capable of capturing. Does not alter move legality or AI search.

### 9. `forcedCapture`
* If any capture is available, non-capturing moves are filtered out. If multiple captures exist, any of them may be selected.

### 10. `castling`
* Allows O-O and O-O-O when king and rook have not moved, squares between are empty, and king does not pass through or land in check. Automatically disabled when `randomStart` is not `'off'`.

### 11. `enPassant`
* Allows pawns to capture an enemy pawn that just advanced two squares on the immediately preceding turn.

### 12. `doubleStep`
* Allows pawns on their starting rank (rank 2 for White, rank 7 for Black) to advance two squares forward if both intermediate and destination squares are empty.

### 13. `backwardCapture`
* Grants pawns the ability to capture diagonally backward one square (1 rank backward, 1 file left/right). Does not permit backward quiet moves.

### 14. `superKnights`
* Grants knights all standard knight jumps plus one-square steps in all eight directions (horizontal, vertical, diagonal).

### 15. `promotion`
* `'choice'`: Player chooses Queen, Rook, Bishop, or Knight upon reaching the 8th rank.
* `'q'`: Automatically promotes to Queen.
* `'n'`: Automatically promotes to Knight (useful for tactical variant setups).

---

## Variant Interactions & Edge Cases

1. **Crazyhouse + Atomic**:
   * When an atomic explosion occurs, only the directly captured piece enters the capturer's pocket. Pieces destroyed in the blast radius are obliterated and do not enter any pocket.
2. **Duck Chess + Piece Drops**:
   * A dropped piece counts as the piece move for the turn; the player must then reposition the Duck to an empty square.
3. **Random Starts + Castling**:
   * Whenever `randomStart` is set to `'except-pawns'` or `'all'`, castling rights are stripped (`rights = ''`) and castling moves are never generated, even if a rook and king happen to land on standard squares.
4. **Draw Adjudication with Piece Drops**:
   * The 50-move rule and insufficient material draws are automatically suppressed whenever `pieceDrops` is enabled, as pocket pieces can alter material balance and checkmate capability at any point.
5. **Atomic Connected Kings**:
   * When White King and Black King stand on adjacent squares, check validation is suspended for both kings: neither king can be in check because no piece could legally capture a king without blowing up both kings simultaneously.
