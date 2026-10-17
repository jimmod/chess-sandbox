import { applyMove, legalMoves, outcome, POCKET_KINDS, attacked, opposite, candidateDuckSquares, legalDuckSquares, notation } from './engine.ts';
import type { Position, Rules, Move } from './engine.ts';

export type Difficulty = 'easy' | 'medium' | 'hard';
const values = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 20000 };

// Standard chess piece-square tables (PST) indexed [0..63] where row 0 is Rank 8 (enemy back rank for White),
// row 7 is Rank 1 (friendly back rank for White). Mirrored symmetrically for Black.
const PAWN_PST = [
    0,   0,   0,   0,   0,   0,   0,   0, // rank 8 (promotion)
   50,  50,  50,  50,  50,  50,  50,  50, // rank 7
   10,  10,  20,  30,  30,  20,  10,  10, // rank 6
    5,   5,  15,  28,  28,  15,   5,   5, // rank 5
    0,   0,  25,  30,  30,   0,   0,   0, // rank 4 (c4, d4, e4 central control)
    5,  -5, -10,   5,   5, -10,  -5,   5, // rank 3
    0,   5,   5, -15, -15,   5,   5,   0, // rank 2 (unmoved d2/e2 block bishops)
    0,   0,   0,   0,   0,   0,   0,   0  // rank 1
];

const KNIGHT_PST = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20,   0,   5,   5,   0, -20, -40,
  -30,   5,  15,  20,  20,  15,   5, -30,
  -30,   5,  20,  25,  25,  20,   5, -30,
  -30,   5,  20,  25,  25,  20,   5, -30,
  -35,   5,  15,  20,  20,  15,   5, -35, // rim squares a3, h3 are penalized
  -35, -10,   0,   5,   5,   0, -10, -35,
  -50, -30, -20, -20, -20, -20, -30, -50
];

const BISHOP_PST = [
  -20, -10, -10, -10, -10, -10, -10, -20,
  -10,   5,   0,   0,   0,   0,   5, -10,
  -10,  10,  10,  15,  15,  10,  10, -10,
  -10,   5,  12,  15,  15,  12,   5, -10,
  -10,   5,  12,  15,  15,  12,   5, -10,
  -10,   5,   5,  10,  10,   5,   5, -10,
  -10,   5,   0,   0,   0,   0,   5, -10,
  -20, -10, -10, -10, -10, -10, -10, -20
];

const ROOK_PST = [
    0,   0,   0,   5,   5,   0,   0,   0,
   15,  15,  15,  20,  20,  15,  15,  15, // 7th rank bonus
    0,   0,   0,   5,   5,   0,   0,   0,
    0,   0,   0,   5,   5,   0,   0,   0,
    0,   0,   0,   5,   5,   0,   0,   0,
    0,   0,   0,   5,   5,   0,   0,   0,
    0,   0,   0,   5,   5,   0,   0,   0,
    0,   0,   5,  10,  10,   5,   0,   0
];

const QUEEN_PST = [
  -10, -10, -10,  -5,  -5, -10, -10, -10,
  -10,   0,   5,   0,   0,   0,   0, -10,
  -10,   5,   5,   5,   5,   5,   0, -10,
    0,   0,   5,   5,   5,   5,   0,  -5,
   -5,   0,   5,   5,   5,   5,   0,  -5,
  -10,   0,   5,   5,   5,   5,   0, -10,
  -10,   0,   0,   0,   0,   0,   0, -10,
  -10, -10, -10,  -5,  -5, -10, -10, -10
];

const KING_PST = [
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -20, -30, -30, -40, -40, -30, -30, -20,
  -10, -20, -20, -20, -20, -20, -20, -10,
   10,  15,   0, -10, -10,   0,  15,  10,
   15,  25,  10, -10,   0, -10,  25,  15 // castled kingside/queenside safety
];

function getPstBonus(kind: string, color: 'w' | 'b', sq: number): number {
  const row = Math.floor(sq / 8);
  const col = sq % 8;
  const tSq = color === 'w' ? row * 8 + col : (7 - row) * 8 + col;
  if (kind === 'p') return PAWN_PST[tSq];
  if (kind === 'n') return KNIGHT_PST[tSq];
  if (kind === 'b') return BISHOP_PST[tSq];
  if (kind === 'r') return ROOK_PST[tSq];
  if (kind === 'q') return QUEEN_PST[tSq];
  if (kind === 'k') return KING_PST[tSq];
  return 0;
}

export function evaluate(pos: Position, rules: Rules): number {
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
      value += getPstBonus(p.kind, p.color, i);
      if (p.kind === 'n' && rules.superKnights) value += 100;
      if (p.kind === 'k' && rules.goal === 'hill') value += center * 40;
    }
    score += p.color === pos.turn ? value : -value;
  });

  // Castling safety bonus in standard checkmate goal
  if (rules.goal === 'checkmate') {
    if (pos.turn === 'w') {
      if (pos.rights.includes('K')) score += 15;
      if (pos.rights.includes('Q')) score += 10;
      if (pos.rights.includes('k')) score -= 15;
      if (pos.rights.includes('q')) score -= 10;
    } else {
      if (pos.rights.includes('k')) score += 15;
      if (pos.rights.includes('q')) score += 10;
      if (pos.rights.includes('K')) score -= 15;
      if (pos.rights.includes('Q')) score -= 10;
    }
  }

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

export function getSearchDuckMoves(p: Position, rules: Rules, isRoot: boolean): Move[] {
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

export function movePriority(p: Position, m: Move, rules: Rules): number {
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

export function orderMoves(p: Position, ms: Move[], rules: Rules): Move[] {
  return ms.slice().sort((a, b) => movePriority(p, b, rules) - movePriority(p, a, rules));
}

export function searchMinimax(
  p: Position,
  rules: Rules,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  deadline?: number,
  counter?: { nodes: number }
): number {
  if (deadline && counter && (++counter.nodes & 15) === 0 && Date.now() >= deadline) {
    throw new Error('timeout');
  }
  const ms = getSearchDuckMoves(p, rules, false);
  const end = outcome(p, rules, ms);
  if (end) return end.winner === null ? 0 : end.winner === p.turn ? 100000 - ply : -100000 + ply;
  if (depth === 0) return evaluate(p, rules);
  let bestScore = -Infinity;
  const sorted = orderMoves(p, ms, rules);
  for (const m of sorted) {
    const score = -searchMinimax(applyMove(p, m, rules), rules, depth - 1, -beta, -alpha, ply + 1, deadline, counter);
    bestScore = Math.max(bestScore, score);
    alpha = Math.max(alpha, score);
    if (alpha >= beta) break;
  }
  return bestScore;
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

  const moves = getSearchDuckMoves(pos, rules, true);
  const deadline = Date.now() + ({ easy: 120, medium: 500, hard: 1600 }[difficulty]);
  const maxDepth = { easy: 1, medium: 3, hard: 5 }[difficulty];
  const counter = { nodes: 0 };

  let best = moves[0];
  let moveScores: { move: Move; score: number }[] = moves.map(m => ({ move: m, score: 0 }));
  for (let depth = 1; depth <= maxDepth; depth++) {
    let iterationBest = best, score = -Infinity;
    const depthScores: { move: Move; score: number }[] = [];
    try {
      const sorted = orderMoves(pos, moves, rules); sorted.sort((a, b) => Number(b === best) - Number(a === best));
      for (const m of sorted) {
        const value = -searchMinimax(applyMove(pos, m, rules), rules, depth - 1, -Infinity, -score, 1, deadline, counter);
        depthScores.push({ move: m, score: value });
        if (value > score) { score = value; iterationBest = m; }
      }
      best = iterationBest;
      moveScores = depthScores;
    } catch { break; }
    if (Date.now() >= deadline) break;
  }

  // Softmax temperature-based selection for move variety
  const temp = { easy: 200, medium: 40, hard: 12 }[difficulty];
  const topScore = Math.max(...moveScores.map(s => s.score));
  const margin = topScore >= 90000 ? 0 : { easy: Infinity, medium: 200, hard: 80 }[difficulty];
  const candidates = moveScores.filter(s => s.score >= topScore - margin);
  if (candidates.length > 1) {
    const maxS = Math.max(...candidates.map(c => c.score));
    const weights = candidates.map(c => Math.exp((c.score - maxS) / temp));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let r = random() * totalWeight;
    for (let i = 0; i < candidates.length; i++) {
      r -= weights[i];
      if (r <= 0) { best = candidates[i].move; break; }
    }
  } else if (candidates.length === 1) {
    best = candidates[0].move;
  }
  if (rules.duckChess && best.duck === undefined) {
    const after = applyMove(pos, best, rules);
    const sqs = legalDuckSquares(pos, after.board);
    if (sqs.length) best = { ...best, duck: candidateDuckSquares(after, pos.duck)[0] ?? sqs[0] };
  }
  return best;
}

export type MoveQuality = 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export type EvaluatedMove = {
  move: Move;
  score: number;
  formattedScore: string;
  rank: number;
  isTopFive: boolean;
  quality: MoveQuality;
  label: string;
};

export function evaluatePositionMoves(pos: Position, rules: Rules): EvaluatedMove[] {
  const moves = legalMoves(pos, rules);
  if (!moves.length || outcome(pos, rules, moves)) return [];

  function completeDuckMove(p: Position, m: Move): Move {
    if (!rules.duckChess || m.duck !== undefined) return m;
    const after = applyMove(p, m, rules);
    const sqs = candidateDuckSquares(after, p.duck);
    return { ...m, duck: sqs[0] ?? legalDuckSquares(p, after.board)[0] };
  }

  // Adaptive reply depth: In endgames or positions with fewer candidate moves, search deeper (depth 3 on replies = 4 plies total).
  // In complex opening/middlegames, depth 2 on replies = 3 plies total, keeping calculation snappy under ~40ms.
  const replyDepth = moves.length <= 15 ? 3 : 2;

  const rawScored: { move: Move; score: number }[] = [];

  for (const rawMove of moves) {
    const m = completeDuckMove(pos, rawMove);

    if (rules.duckChess && pos.board[m.to]?.kind === 'k') {
      rawScored.push({ move: m, score: 100000 });
      continue;
    }
    const nextPos = applyMove(pos, m, rules);
    if (rules.atomic && !nextPos.board.some(p => p?.color === opposite(pos.turn) && p.kind === 'k')) {
      rawScored.push({ move: m, score: 100000 });
      continue;
    }

    const end = outcome(nextPos, rules);
    if (end) {
      if (end.winner === pos.turn) rawScored.push({ move: m, score: 100000 });
      else if (end.winner === null) rawScored.push({ move: m, score: 0 });
      else rawScored.push({ move: m, score: -100000 });
      continue;
    }

    const score = -searchMinimax(nextPos, rules, replyDepth, -Infinity, Infinity, 1);
    rawScored.push({ move: m, score });
  }

  rawScored.sort((a, b) => b.score - a.score);
  const topScore = rawScored[0].score;

  return rawScored.map((item, idx) => {
    const rank = idx + 1;
    const diff = topScore - item.score;
    let quality: MoveQuality;
    if (diff === 0) quality = 'best';
    else if (diff <= 35) quality = 'excellent';
    else if (diff <= 90) quality = 'good';
    else if (diff <= 200) quality = 'inaccuracy';
    else if (diff <= 400) quality = 'mistake';
    else quality = 'blunder';

    let formattedScore: string;
    if (item.score >= 99000) formattedScore = '+M1';
    else if (item.score >= 90000) formattedScore = '+M2';
    else if (item.score <= -99000) formattedScore = '-M1';
    else if (item.score <= -90000) formattedScore = '-M2';
    else {
      const val = (item.score / 100).toFixed(1);
      formattedScore = item.score > 0 ? `+${val}` : val === '-0.0' ? '0.0' : val;
    }

    return {
      move: item.move,
      score: item.score,
      formattedScore,
      rank,
      isTopFive: rank <= 5,
      quality,
      label: notation(pos, item.move, rules),
    };
  });
}


