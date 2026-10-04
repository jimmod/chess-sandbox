# Chess Sandbox

A customizable browser chess playground with variant-aware AI or two humans sharing a device.

## Development

Requires Node.js 22.13+ and npm.

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run build
```

See [the architecture document](doc/ARCHITECTURE.md) for system boundaries, state flow, AI behavior, hosting, and maintenance guidance. Update it alongside architectural changes.

## Stack and architecture

- React 19 and TypeScript for the interactive board and rule editor.
- Vinext/Vite with Cloudflare-compatible hosting.
- A pure TypeScript rules engine shared by the interface and AI. Standard-only chess libraries cannot enforce these rule combinations.
- A Web Worker runs iterative-deepening negamax with alpha-beta pruning. Easy adds occasional random moves; Medium searches up to 3 plies within 500ms; Hard up to 5 within 1600ms. These are relative strengths, not calibrated Elo ratings or Stockfish-level play.
- Radix/Shadcn primitives for accessible switches, selectors, difficulty radios, and dialogs.
- No external AI API, paid inference, or game backend is required.

Choose White, Black, or Random in **Play as**. Random chooses your side independently for each new game and orients the board for you.

Choose **Human** under Meet your opponent for local two-player play. Use the header theme selector for Forest, Ocean, Violet, or Amber colors.

## Rules

Six presets: Classic, Duck Chess, Crazyhouse, King of the Hill, Giveaway, and Wild Knights. Twelve controls customize win condition, duck chess blocker, piece drops / pockets, forced captures, castling, en passant, pawn double steps, backward pawn captures, super knights, promotion, randomized starting positions, and eligible-piece marking. Marking is enabled by default for Giveaway and highlights only your pieces with a legal move (only capturing pieces when captures are mandatory). Random starts offer three options: Off, Except the pawns (shuffles back ranks identically for both colors while pawns stay in place), and All (shuffles all 16 pieces and pawns across both home ranks with a non-check opening guarantee). Both active random modes mirror armies symmetrically and disable castling. New rule settings apply when starting a new game; AI difficulty changes immediately.

Both players use identical move generation. Duck Chess features a neutral duck (🦆) that blocks squares and movement lines (knights can jump over it). Each turn requires moving a piece, then moving the duck to any other empty square. Duck Chess uses capture-the-king (no check or checkmate). Crazyhouse sends captured pieces to the capturer's reserve pocket; promoted pieces return as pawns (`~` marks promoted pieces on board). Pocket pieces can be dropped onto any vacant square on your turn (pawns restricted to ranks 2–7). Drops obey king safety (can block a check, cannot leave the king exposed). Giveaway forces captures, disables check and castling, and wins by losing all pieces or having no legal moves. King of the Hill also allows checkmate wins. Capture-the-king ignores check. Super knights retain their normal jumps and gain king-like steps. Backward pawn captures do not allow backward quiet moves.

Threefold repetition and 50-move draws are automatic (50-move rule and insufficient material draws are disabled when piece drops are active). Classic insufficient-material detection covers bare kings, single bishop/knight, and bishops confined to one square color; this is not a complete FIDE dead-position solver. AI search does not track repetition history. No clock, online human multiplayer, arbitrary board editor, or persisted games in this iteration. Reloading starts a new game.

## Code map

- `lib/chess/engine.ts`: positions, move generation, variants, adjudication, notation.
- `lib/chess/ai.ts`: search and evaluation.
- `lib/chess/ai.worker.ts`: background search protocol.
- `app/page.tsx`: gameplay, configuration, promotion, undo, accessible board navigation.
- `tests/engine.test.ts`: known perft counts and special/variant rule tests.

The optional browser WebMCP `read_chess_game` tool exposes current public board state and validates its empty-object input. It does not change games or access accounts.

## Verification

Engine tests include opening perft 20/400/8902, Fool's mate, en passant, castling through attack, promotion, pinned pieces, giveaway, hill, and modified movement. Browser checks cover human/AI turns, undo, rule activation, and valid/invalid WebMCP reads.

## License

This project is licensed under the [MIT License](LICENSE). Third-party dependencies and vendored code retain their respective licenses and notices.
