import { applyMove, legalMoves, outcome, POCKET_KINDS, attacked, opposite, candidateDuckSquares, legalDuckSquares } from './engine.ts';
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
    else if (rules.goal === 'annihilation') {
      if (p.kind === 'k') value = 380;
      value += 60; // every surviving piece is precious
      if (p.kind === 'p') value += (p.color === 'w' ? 6 - row : row - 1) * 12 + center * 3;
      if (p.kind === 'n' || p.kind === 'b') value += center * 10;
      if (p.kind === 'n' && rules.superKnights) value += 100;
    } else {
      if (p.kind === 'p') value += (p.color === 'w' ? 6 - row : row - 1) * 9 + center * 3 + (rules.atomic ? 40 : 0);
      if (p.kind === 'n' || p.kind === 'b') value += center * 10;
      if (p.kind === 'n' && rules.superKnights) value += 100;
      if (p.kind === 'k' && rules.goal === 'hill') value += center * 40;
    }
    score += p.color === pos.turn ? value : -value;
  });
  if (rules.atomic) {
    const myKing = pos.board.some(p => p?.color === pos.turn && p.kind === 'k');
    const oppKing = pos.board.some(p => p?.color === opposite(pos.turn) && p.kind === 'k');
    if (!myKing) return -90000;
    if (!oppKing) return 90000;
  }
  if (rules.pieceDrops && pos.pockets) for (const color of ['w', 'b'] as const) for (const kind of POCKET_KINDS) {
    score += (color === pos.turn ? 1 : -1) * pos.pockets[color][kind] * (rules.goal === 'giveaway' ? -100 - values[kind] / 10 : values[kind] * 1.1);
  }
  if (rules.duckChess) {
    const myKing = pos.board.findIndex(p => p?.color === pos.turn && p.kind === 'k');
    if (myKing >= 0 && attacked(pos, myKing, opposite(pos.turn), rules)) score -= 8000;
    const oppKing = pos.board.findIndex(p => p?.color === opposite(pos.turn) && p.kind === 'k');
    if (oppKing >= 0 && attacked(pos, oppKing, pos.turn, rules)) score += 8000;
  }
  return score;
}
export function chooseMove(pos: Position, rules: Rules, difficulty: Difficulty, random = Math.random): Move | null {
  const rawMoves = legalMoves(pos, rules); if (!rawMoves.length || outcome(pos, rules, rawMoves)) return null;

  if (rules.duckChess) {
    const kingWin = rawMoves.find(m => pos.board[m.to]?.kind === 'k');
    if (kingWin) return kingWin;
  }
  if (rules.atomic) {
    const atomicWin = rawMoves.find(m => !applyMove(pos, m, rules).board.some(p => p?.color === opposite(pos.turn) && p.kind === 'k'));
    if (atomicWin) return atomicWin;
  }

  function getDuckMoves(p: Position, isRoot: boolean): Move[] {
    const ms = legalMoves(p, rules);
    if (!rules.duckChess) return ms;
    const kingCapture = ms.find(m => p.board[m.to]?.kind === 'k');
    if (kingCapture) return [kingCapture];
    const res: Move[] = [];
    for (const m of ms) {
      const nextPos = applyMove(p, m, rules);
      const candidates = candidateDuckSquares(nextPos, p.duck);
      const count = candidates.length ? (isRoot ? Math.min(candidates.length, 2) : 1) : 0;
      if (count === 0) res.push(m);
      else for (let i = 0; i < count; i++) res.push({ ...m, duck: candidates[i] });
    }
    return res;
  }

  const moves = getDuckMoves(pos, true);
  if (difficulty === 'easy' && random() < .35) {
    const m = moves[Math.floor(random() * moves.length)];
    if (rules.duckChess && m.duck === undefined) {
      const after = applyMove(pos, m, rules);
      const sqs = legalDuckSquares(pos, after.board);
      return sqs.length ? { ...m, duck: sqs[Math.floor(random() * sqs.length)] } : m;
    }
    return m;
  }
  const deadline = Date.now() + ({ easy: 120, medium: 500, hard: 1600 }[difficulty]);
  const maxDepth = { easy: 1, medium: 3, hard: 5 }[difficulty];
  let nodes = 0;
  function ordered(p: Position, ms: Move[]) {
    return ms.slice().sort((a, b) => priority(p, b) - priority(p, a));
  }
  function priority(p: Position, m: Move) {
    if (rules.atomic) {
      const next = applyMove(p, m, rules);
      if (!next.board.some(pc => pc?.color === opposite(p.turn) && pc.kind === 'k')) return 100000;
    }
    if (rules.goal !== 'annihilation' && p.board[m.to]?.kind === 'k') return 100000;
    if (m.drop) return 40 + (7 - Math.abs(3.5 - Math.floor(m.to / 8)) - Math.abs(3.5 - m.to % 8)) * 5;
    const target = p.board[m.to] || (m.ep !== undefined ? p.board[m.ep] : null);
    const targetVal = target ? (rules.goal === 'annihilation' && target.kind === 'k' ? 380 : values[target.kind]) : 0;
    const fromPiece = p.board[m.from];
    const fromVal = fromPiece ? (rules.goal === 'annihilation' && fromPiece.kind === 'k' ? 380 : values[fromPiece.kind]) : 0;
    return (target ? targetVal * 10 - fromVal : 0) + (m.promotion ? values[m.promotion] : 0) + (m.duck !== undefined ? 5 : 0);
  }
  function search(p: Position, depth: number, alpha: number, beta: number, ply: number): number {
    if ((++nodes & 15) === 0 && Date.now() >= deadline) throw new Error('timeout');
    const ms = getDuckMoves(p, false), end = outcome(p, rules, ms);
    if (end) return end.winner === null ? 0 : end.winner === p.turn ? 100000 - ply : -100000 + ply;
    if (depth === 0) return evaluate(p, rules);
    let bestScore = -Infinity;
    for (const m of ordered(p, ms)) {
      const score = -search(applyMove(p, m, rules), depth - 1, -beta, -alpha, ply + 1);
      bestScore = Math.max(bestScore, score); alpha = Math.max(alpha, score); if (alpha >= beta) break;
    }
    return bestScore;
  }
  let best = moves[0];
  for (let depth = 1; depth <= maxDepth; depth++) {
    let iterationBest = best, score = -Infinity;
    try {
      const sorted = ordered(pos, moves); sorted.sort((a, b) => Number(b === best) - Number(a === best));
      for (const m of sorted) {
        const value = -search(applyMove(pos, m, rules), depth - 1, -Infinity, -score, 1) + (difficulty === 'easy' ? random() * 90 : 0);
        if (value > score) { score = value; iterationBest = m; }
      }
      best = iterationBest;
    } catch { break; }
    if (Date.now() >= deadline) break;
  }
  if (rules.duckChess && best.duck === undefined) {
    const after = applyMove(pos, best, rules);
    const sqs = legalDuckSquares(pos, after.board);
    if (sqs.length) best = { ...best, duck: candidateDuckSquares(after, pos.duck)[0] ?? sqs[0] };
  }
  return best;
}
