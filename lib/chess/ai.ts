import { applyMove, legalMoves, outcome, POCKET_KINDS, attacked, opposite, candidateDuckSquares, legalDuckSquares, notation } from './engine.ts';
import type { Position, Rules, Move } from './engine.ts';
export type Difficulty = 'easy' | 'medium' | 'hard';
const values = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 20000 };
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
  let moveScores: { move: Move; score: number }[] = moves.map(m => ({ move: m, score: 0 }));
  for (let depth = 1; depth <= maxDepth; depth++) {
    let iterationBest = best, score = -Infinity;
    const depthScores: { move: Move; score: number }[] = [];
    try {
      const sorted = ordered(pos, moves); sorted.sort((a, b) => Number(b === best) - Number(a === best));
      for (const m of sorted) {
        const value = -search(applyMove(pos, m, rules), depth - 1, -Infinity, -score, 1);
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

    const oppRawMoves = legalMoves(nextPos, rules);
    const end = outcome(nextPos, rules, oppRawMoves);
    if (end) {
      if (end.winner === pos.turn) rawScored.push({ move: m, score: 100000 });
      else if (end.winner === null) rawScored.push({ move: m, score: 0 });
      else rawScored.push({ move: m, score: -100000 });
      continue;
    }

    let worstCaseForUs = Infinity;
    for (const omRaw of oppRawMoves) {
      const om = completeDuckMove(nextPos, omRaw);
      if (rules.duckChess && nextPos.board[om.to]?.kind === 'k') {
        worstCaseForUs = -100000;
        break;
      }
      const oppAfter = applyMove(nextPos, om, rules);
      if (rules.atomic && !oppAfter.board.some(p => p?.color === pos.turn && p.kind === 'k')) {
        worstCaseForUs = -100000;
        break;
      }
      const oppEnd = outcome(oppAfter, rules);
      let replyScore: number;
      if (oppEnd) {
        if (oppEnd.winner === opposite(pos.turn)) replyScore = -100000;
        else if (oppEnd.winner === null) replyScore = 0;
        else replyScore = 100000;
      } else {
        replyScore = evaluate(oppAfter, rules);
      }
      if (replyScore < worstCaseForUs) {
        worstCaseForUs = replyScore;
      }
    }

    rawScored.push({
      move: m,
      score: worstCaseForUs === Infinity ? evaluate(nextPos, rules) : worstCaseForUs,
    });
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
    if (item.score >= 90000) formattedScore = '+M1';
    else if (item.score <= -90000) formattedScore = '-M1';
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

