# Repository working guidelines

- The product name is **Chess Sandbox**. Use it consistently in UI, metadata, documentation, and assets; use `chess-sandbox` for machine-readable package names.
- Maintain `doc/ARCHITECTURE.md` in the same commit whenever module boundaries, game state, rules, AI, dependencies, deployment, or storage change. Document actual behavior and limitations, and keep the README aligned.
- Human and AI move legality must share `lib/chess/engine.ts`; do not implement separate variant rules in the UI or worker.
- Commit each coherent feature or fix with a descriptive message. Preserve existing history.
- Run type checks, engine tests, and a production build for behavior changes. Check a clean npm install after dependency changes. Use focused browser checks for UI and worker changes.
- Preserve third-party license notices. Do not commit credentials, local environment files, generated build output, or TypeScript build caches.
