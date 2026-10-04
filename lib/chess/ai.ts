import { applyMove, legalMoves, outcome, POCKET_KINDS } from './engine.ts';
import type { Position, Rules, Move } from './engine.ts';
export type Difficulty = 'easy' | 'medium' | 'hard';
const values = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 20000 };
function evaluate(pos: Position, rules: Rules): number {
  let score = 0;
  pos.board.forEach((p, i) => {
    if (!p) return;
    const row = Math.floor(i / 8), col = i % 8;
    const center = 7 - Math.abs(3.5 - row) - Math.abs(3.5 - col);
    let value = values[p.kind];
    if (rules.goal === 'giveaway') value = -100 - (p.kind === 'k' ? 0 : value / 10);
    else {
      if (p.kind === 'p') value += (p.color === 'w' ? 6 - row : row - 1) * 9 + center * 3;
      if (p.kind === 'n' || p.kind === 'b') value += center * 10;
      if (p.kind === 'n' && rules.superKnights) value += 100;
      if (p.kind === 'k' && rules.goal === 'hill') value += center * 40;
    }
    score += p.color === pos.turn ? value : -value;
  });
  if (rules.pieceDrops && pos.pockets) for (const color of ['w', 'b'] as const) for (const kind of POCKET_KINDS) {
    score += (color === pos.turn ? 1 : -1) * pos.pockets[color][kind] * (rules.goal === 'giveaway' ? -100 - values[kind] / 10 : values[kind] * 1.1);
  }
  return score;
}
export function chooseMove(pos: Position, rules: Rules, difficulty: Difficulty, random = Math.random): Move | null {
  const moves = legalMoves(pos, rules); if (!moves.length || outcome(pos, rules, moves)) return null;
  if (difficulty === 'easy' && random() < .35) return moves[Math.floor(random() * moves.length)];
  const deadline = Date.now() + ({ easy: 120, medium: 500, hard: 1600 }[difficulty]);
  const maxDepth = { easy: 1, medium: 3, hard: 5 }[difficulty];
  let nodes = 0;
  function ordered(p: Position, ms: Move[]) {
    return ms.slice().sort((a, b) => priority(p, b) - priority(p, a));
  }
  function priority(p: Position, m: Move) {
    if (m.drop) return 40 + (7 - Math.abs(3.5 - Math.floor(m.to / 8)) - Math.abs(3.5 - m.to % 8)) * 5;
    const target = p.board[m.to] || (m.ep !== undefined ? p.board[m.ep] : null);
    return (target ? values[target.kind] * 10 - values[p.board[m.from]!.kind] : 0) + (m.promotion ? values[m.promotion] : 0);
  }
  function search(p: Position, depth: number, alpha: number, beta: number, ply: number): number {
    if ((++nodes & 15) === 0 && Date.now() >= deadline) throw new Error('timeout');
    const ms = legalMoves(p, rules), end = outcome(p, rules, ms);
    if (end) return end.winner === null ? 0 : end.winner === p.turn ? 100000 - ply : -100000 + ply;
    if (depth === 0) return evaluate(p, rules);
    let best = -Infinity;
    for (const m of ordered(p, ms)) {
      const score = -search(applyMove(p, m), depth - 1, -beta, -alpha, ply + 1);
      best = Math.max(best, score); alpha = Math.max(alpha, score); if (alpha >= beta) break;
    }
    return best;
  }
  let best = moves[0];
  for (let depth = 1; depth <= maxDepth; depth++) {
    let iterationBest = best, score = -Infinity;
    try {
      const sorted = ordered(pos, moves); sorted.sort((a, b) => Number(b === best) - Number(a === best));
      for (const m of sorted) {
        const value = -search(applyMove(pos, m), depth - 1, -Infinity, -score, 1) + (difficulty === 'easy' ? random() * 90 : 0);
        if (value > score) { score = value; iterationBest = m; }
      }
      best = iterationBest;
    } catch { break; }
    if (Date.now() >= deadline) break;
  }
  return best;
}
