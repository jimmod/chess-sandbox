# Chess Sandbox

A customizable browser chess playground with variant-aware AI.

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

## Rules

Four presets: Classic, King of the Hill, Giveaway, and Wild Knights. Nine controls customize win condition, forced captures, castling, en passant, pawn double steps, backward pawn captures, super knights, promotion, and randomized starting positions. Random starts shuffle the back ranks identically for both colors, keep pawns in place, and disable castling. New rule settings apply when starting a new game; AI difficulty changes immediately.

Both players use identical move generation. Giveaway forces captures, disables check and castling, and wins by losing all pieces or having no legal moves. King of the Hill also allows checkmate wins. Capture-the-king ignores check. Super knights retain their normal jumps and gain king-like steps. Backward pawn captures do not allow backward quiet moves.

Threefold repetition and 50-move draws are automatic. Classic insufficient-material detection covers bare kings, single bishop/knight, and bishops confined to one square color; this is not a complete FIDE dead-position solver. AI search does not track repetition history. No clock, online human multiplayer, arbitrary board editor, or persisted games in this iteration. Reloading starts a new game.

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
