export type Color = 'w' | 'b';
export type Kind = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type Piece = { color: Color; kind: Kind; promoted?: boolean };
export type RandomStart = 'off' | 'except-pawns' | 'all';
export type Rules = {
  goal: 'checkmate' | 'capture' | 'hill' | 'giveaway';
  randomStart: RandomStart;
  pieceDrops: boolean;
  markEligiblePieces: boolean;
  forcedCapture: boolean;
  castling: boolean;
  enPassant: boolean;
  doubleStep: boolean;
  backwardCapture: boolean;
  superKnights: boolean;
  promotion: 'choice' | 'q' | 'n';
};
export type PocketKind = Exclude<Kind, 'k'>;
export const POCKET_KINDS: PocketKind[] = ['p', 'n', 'b', 'r', 'q'];
export type Pockets = Record<Color, Record<PocketKind, number>>;
export const emptyPockets = (): Pockets => ({ w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } });
export type Move = { drop?: PocketKind; from: number; to: number; promotion?: Kind; ep?: number; rook?: [number, number] };
export type Position = { pockets?: Pockets; board: (Piece | null)[]; turn: Color; rights: string; ep: number | null; halfmove: number; ply: number };
export const CLASSIC: Rules = { goal: 'checkmate', randomStart: 'off', pieceDrops: false, markEligiblePieces: false, forcedCapture: false, castling: true, enPassant: true, doubleStep: true, backwardCapture: false, superKnights: false, promotion: 'choice' };
export const PRESETS: { id: string; name: string; description: string; icon: string; rules: Rules; details: { summary: string; rules: string[] } }[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'The original game',
    icon: '♔',
    rules: { ...CLASSIC },
    details: {
      summary: 'Standard chess with standard FIDE rules.',
      rules: [
        'Protect your king and checkmate the opponent.',
        'Castling, en passant, and two-square pawn openings are enabled.',
        'Draws by stalemate, threefold repetition, 50-move rule, or insufficient material.',
      ],
    },
  },
  {
    id: 'crazyhouse',
    name: 'Crazyhouse',
    description: 'Capture, pocket, drop',
    icon: '♜',
    rules: { ...CLASSIC, pieceDrops: true },
    details: {
      summary: 'Captures enter your reserve pocket to be dropped back onto the board.',
      rules: [
        'Captured enemy pieces join your pocket in your own color.',
        'Drop reserve pieces onto any empty square on your turn (pawns: ranks 2–7).',
        'Promoted pieces return to pockets as pawns (~ marks promoted pieces on board).',
        'Drops obey check rules and can block incoming attacks or deliver checkmate.',
      ],
    },
  },
  {
    id: 'hill',
    name: 'King of the Hill',
    description: 'Race to the center',
    icon: '⚑',
    rules: { ...CLASSIC, goal: 'hill' },
    details: {
      summary: 'Race your king to claim the high ground in the center of the board.',
      rules: [
        'First king to reach any of the 4 center squares (d4, e4, d5, e5) wins immediately.',
        'Checkmate also wins normally.',
        'Kings cannot move into or through check.',
      ],
    },
  },
  {
    id: 'giveaway',
    name: 'Giveaway',
    description: 'Lose pieces to win',
    icon: '♙',
    rules: { ...CLASSIC, goal: 'giveaway', markEligiblePieces: true, forcedCapture: true, castling: false },
    details: {
      summary: 'Antichess where sacrificing your entire army is the winning strategy.',
      rules: [
        'Captures are mandatory whenever a legal capture exists.',
        'Kings are ordinary pieces (no check, checkmate, or castling).',
        'Win by losing all your pieces or having no legal moves left on your turn.',
      ],
    },
  },
  {
    id: 'wild',
    name: 'Wild knights',
    description: 'Knights gain a step',
    icon: '♞',
    rules: { ...CLASSIC, superKnights: true, backwardCapture: true },
    details: {
      summary: 'Supercharged knights with extra mobility and backward pawn captures.',
      rules: [
        'Knights retain normal L-jumps and also step 1 square in any direction (like a king).',
        'Pawns can capture 1 square diagonally backward (backward non-capturing steps remain disallowed).',
        'Checkmate the opposing king to win.',
      ],
    },
  },
];
export const opposite = (c: Color): Color => c === 'w' ? 'b' : 'w';
export const squareName = (i: number) => 'abcdefgh'[i % 8] + (8 - Math.floor(i / 8));
export const squareIndex = (s: string) => /^[a-h][1-8]$/.test(s) ? (8 - Number(s[1])) * 8 + 'abcdefgh'.indexOf(s[0]) : -1;
export function initialPosition(rules: Rules = CLASSIC, random: () => number = Math.random): Position {
  const mode = rules.randomStart as (RandomStart | boolean);
  if (mode === 'all') {
    const army: Kind[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r', 'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'];
    let pos: Position;
    do {
      const shuffled = army.slice();
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const board: (Piece | null)[] = Array(64).fill(null);
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 8; c++) {
          const kind = shuffled[r * 8 + c];
          board[r * 8 + c] = { color: 'b', kind };
          board[(7 - r) * 8 + c] = { color: 'w', kind };
        }
      }
      pos = { pockets: rules.pieceDrops ? emptyPockets() : undefined, board, turn: 'w', rights: '', ep: null, halfmove: 0, ply: 0 };
    } while (royal(rules) && (inCheck(pos, 'w', rules) || inCheck(pos, 'b', rules)));
    return pos;
  }

  const order: Kind[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  if (mode === 'except-pawns' || mode === true) {
    // Keep pawns shielding both kings; mirror the same shuffled army for fairness.
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    // Never present the classic arrangement as a randomized opening.
    if (order.join('') === 'rnbqkbnr') [order[1], order[2]] = [order[2], order[1]];
  }
  const isRandom = mode === 'except-pawns' || mode === true;
  return { pockets: rules.pieceDrops ? emptyPockets() : undefined, board: Array.from({ length: 64 }, (_, i) => i < 8 ? { color: 'b', kind: order[i] } : i < 16 ? { color: 'b', kind: 'p' } : i < 48 ? null : i < 56 ? { color: 'w', kind: 'p' } : { color: 'w', kind: order[i - 56] }), turn: 'w', rights: isRandom ? '' : 'KQkq', ep: null, halfmove: 0, ply: 0 };
}
const diagonals = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const straight = [[0, 1], [0, -1], [1, 0], [-1, 0]];
const kingSteps = [...diagonals, ...straight];
const knightSteps = [[1, 2], [1, -2], [-1, 2], [-1, -2], [2, 1], [2, -1], [-2, 1], [-2, -1]];
const inside = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
export const royal = (rules: Rules) => rules.goal === 'checkmate' || rules.goal === 'hill';
export function attacked(pos: Position, target: number, by: Color, rules: Rules): boolean {
  const tr = Math.floor(target / 8), tc = target % 8;
  for (let from = 0; from < 64; from++) {
    const p = pos.board[from]; if (!p || p.color !== by) continue;
    const dr = tr - Math.floor(from / 8), dc = tc - from % 8;
    if (p.kind === 'p' && Math.abs(dc) === 1 && (dr === (by === 'w' ? -1 : 1) || rules.backwardCapture && Math.abs(dr) === 1)) return true;
    if (p.kind === 'n' && (Math.abs(dr) * Math.abs(dc) === 2 || rules.superKnights && Math.max(Math.abs(dr), Math.abs(dc)) === 1)) return true;
    if (p.kind === 'k' && Math.max(Math.abs(dr), Math.abs(dc)) === 1) return true;
    if (p.kind === 'q' || p.kind === 'r' || p.kind === 'b') {
      const line = (p.kind !== 'b' && (dr === 0 || dc === 0)) || (p.kind !== 'r' && Math.abs(dr) === Math.abs(dc));
      if (!line || (!dr && !dc)) continue;
      const sr = Math.sign(dr), sc = Math.sign(dc); let r = Math.floor(from / 8) + sr, c = from % 8 + sc;
      while (r !== tr || c !== tc) { if (pos.board[r * 8 + c]) break; r += sr; c += sc; }
      if (r === tr && c === tc) return true;
    }
  }
  return false;
}
export function inCheck(pos: Position, color: Color, rules: Rules): boolean {
  const king = pos.board.findIndex(p => p?.color === color && p.kind === 'k');
  return king < 0 || attacked(pos, king, opposite(color), rules);
}
export function applyMove(pos: Position, m: Move): Position {
  const board = pos.board.slice();
  const pockets = pos.pockets ? { w: { ...pos.pockets.w }, b: { ...pos.pockets.b } } : undefined;
  if (m.drop) {
    if (!pockets || pockets[pos.turn][m.drop] < 1 || m.to < 0 || m.to > 63 || board[m.to] || (m.drop === 'p' && (m.to < 8 || m.to >= 56))) throw new Error('Invalid drop');
    pockets[pos.turn][m.drop]--;
    board[m.to] = { color: pos.turn, kind: m.drop };
    return { ...pos, board, pockets, turn: opposite(pos.turn), ep: null, halfmove: 0, ply: pos.ply + 1 };
  }
  const p = board[m.from]!;
  const captured = board[m.to] || (m.ep !== undefined ? board[m.ep] : null);
  if (pockets && captured && captured.kind !== 'k') pockets[pos.turn][captured.promoted ? 'p' : captured.kind]++;
  board[m.from] = null; board[m.to] = m.promotion ? { color: p.color, kind: m.promotion, promoted: true } : p;
  if (m.ep !== undefined) board[m.ep] = null;
  if (m.rook) { board[m.rook[1]] = board[m.rook[0]]; board[m.rook[0]] = null; }
  let rights = pos.rights;
  if (p.kind === 'k') rights = rights.replace(p.color === 'w' ? /[KQ]/g : /[kq]/g, '');
  for (const [sq, right] of [[0, 'q'], [7, 'k'], [56, 'Q'], [63, 'K']] as const) if (m.from === sq || m.to === sq) rights = rights.replace(right, '');
  return { board, pockets, turn: opposite(pos.turn), rights, ep: p.kind === 'p' && Math.abs(m.to - m.from) === 16 ? (m.to + m.from) / 2 : null, halfmove: p.kind === 'p' || captured ? 0 : pos.halfmove + 1, ply: pos.ply + 1 };
}
function pseudoMoves(pos: Position, rules: Rules): Move[] {
  const moves: Move[] = [];
  function add(from: number, to: number, extra: Partial<Move> = {}) {
    const p = pos.board[from]!;
    if (p.kind === 'p' && (to < 8 || to >= 56)) {
      const choices: Kind[] = rules.promotion === 'choice' ? ['q', 'r', 'b', 'n'] : [rules.promotion];
      for (const promotion of choices) moves.push({ from, to, ...extra, promotion });
    } else moves.push({ from, to, ...extra });
  }
  for (let from = 0; from < 64; from++) {
    const p = pos.board[from]; if (!p || p.color !== pos.turn) continue;
    const r = Math.floor(from / 8), c = from % 8;
    if (p.kind === 'p') {
      const dir = p.color === 'w' ? -1 : 1, next = from + dir * 8;
      if (inside(r + dir, c) && !pos.board[next]) {
        add(from, next);
        if (rules.doubleStep && r === (p.color === 'w' ? 6 : 1) && !pos.board[from + dir * 16]) add(from, from + dir * 16);
      }
      for (const dr of rules.backwardCapture ? [dir, -dir] : [dir]) for (const dc of [-1, 1]) {
        if (!inside(r + dr, c + dc)) continue;
        const to = (r + dr) * 8 + c + dc, target = pos.board[to];
        if (target && target.color !== p.color && (!royal(rules) || target.kind !== 'k')) add(from, to);
        if (dr === dir && rules.enPassant && pos.ep === to && !target) {
          const ep = to - dir * 8, victim = pos.board[ep];
          if (victim?.kind === 'p' && victim.color !== p.color) add(from, to, { ep });
        }
      }
      continue;
    }
    const sliding = ['b', 'r', 'q'].includes(p.kind);
    const steps = p.kind === 'n' ? [...knightSteps, ...(rules.superKnights ? kingSteps : [])] : p.kind === 'b' ? diagonals : p.kind === 'r' ? straight : kingSteps;
    for (const [dr, dc] of steps) for (let n = 1; n <= (sliding ? 7 : 1); n++) {
      const nr = r + dr * n, nc = c + dc * n; if (!inside(nr, nc)) break;
      const to = nr * 8 + nc, target = pos.board[to];
      if (target?.color === p.color) break;
      if (!target || !royal(rules) || target.kind !== 'k') add(from, to);
      if (target) break;
    }
    if (p.kind === 'k' && rules.castling && rules.goal !== 'giveaway') {
      const home = p.color === 'w' ? 60 : 4;
      if (from !== home || royal(rules) && inCheck(pos, p.color, rules)) continue;
      for (const kingSide of [true, false]) {
        const right = p.color === 'w' ? (kingSide ? 'K' : 'Q') : (kingSide ? 'k' : 'q');
        const rookFrom = home + (kingSide ? 3 : -4), direction = kingSide ? 1 : -1;
        const rook = pos.board[rookFrom];
        if (!pos.rights.includes(right) || rook?.kind !== 'r' || rook.color !== p.color) continue;
        if (Array.from({ length: kingSide ? 2 : 3 }, (_, i) => home + (i + 1) * direction).some(s => pos.board[s])) continue;
        if (royal(rules) && inCheck(applyMove(pos, { from, to: home + direction }), p.color, rules)) continue;
        add(from, home + 2 * direction, { rook: [rookFrom, home + direction] });
      }
    }
  }
  if (rules.pieceDrops && pos.pockets) {
    for (const drop of POCKET_KINDS) {
      if (pos.pockets[pos.turn][drop] < 1) continue;
      for (let to = 0; to < 64; to++) if (!pos.board[to] && (drop !== 'p' || to >= 8 && to < 56)) moves.push({ from: -1, to, drop });
    }
  }
  return moves;
}
export function legalMoves(pos: Position, rules: Rules): Move[] {
  let moves = pseudoMoves(pos, rules);
  if (royal(rules)) moves = moves.filter(m => !inCheck(applyMove(pos, m), pos.turn, rules));
  if (rules.forcedCapture || rules.goal === 'giveaway') {
    const captures = moves.filter(m => pos.board[m.to] || m.ep !== undefined);
    if (captures.length) return captures;
  }
  return moves;
}
export type Outcome = { winner: Color | null; reason: string };
export function outcome(pos: Position, rules: Rules, moves?: Move[]): Outcome | null {
  if (rules.goal === 'capture') for (const color of ['w', 'b'] as Color[]) if (!pos.board.some(p => p?.color === color && p.kind === 'k')) return { winner: opposite(color), reason: 'King captured' };
  if (rules.goal === 'hill') for (const i of [27, 28, 35, 36]) if (pos.board[i]?.kind === 'k') return { winner: pos.board[i]!.color, reason: 'King reached the center' };
  if (rules.goal === 'giveaway' && !pos.board.some(p => p?.color === pos.turn) && !POCKET_KINDS.some(k => (pos.pockets?.[pos.turn][k] ?? 0) > 0)) return { winner: pos.turn, reason: 'All pieces given away' };
  const available = moves ?? legalMoves(pos, rules);
  if (!available.length) {
    if (rules.goal === 'giveaway') return { winner: pos.turn, reason: 'No legal moves — you win' };
    if (royal(rules) && inCheck(pos, pos.turn, rules)) return { winner: opposite(pos.turn), reason: 'Checkmate' };
    return { winner: null, reason: 'Stalemate' };
  }
  if (!rules.pieceDrops && pos.halfmove >= 100) return { winner: null, reason: '50-move draw' };
  if (rules.goal === 'checkmate' && !rules.superKnights && !rules.pieceDrops) {
    const nonKings = pos.board.flatMap((p, i) => p && p.kind !== 'k' ? [{ ...p, i }] : []);
    if (!nonKings.length || nonKings.length === 1 && ['b', 'n'].includes(nonKings[0].kind) || nonKings.length > 0 && nonKings.every(p => p.kind === 'b') && new Set(nonKings.map(p => (Math.floor(p.i / 8) + p.i % 8) % 2)).size === 1) return { winner: null, reason: 'Insufficient material' };
  }
  return null;
}
export function positionKey(pos: Position, rules: Rules): string {
  const effectiveEp = pos.ep !== null && legalMoves(pos, rules).some(m => m.ep !== undefined) ? pos.ep : '-';
  return pos.board.map(p => p ? (p.color === 'w' ? p.kind.toUpperCase() : p.kind) + (rules.pieceDrops && p.promoted ? '~' : '') : '.').join('') + pos.turn + (rules.castling ? pos.rights : '-') + effectiveEp + (rules.pieceDrops ? JSON.stringify(pos.pockets ?? emptyPockets()) : '');
}
export function notation(pos: Position, move: Move, rules: Rules): string {
  if (move.drop) {
    const next = applyMove(pos, move);
    const suffix = royal(rules) && inCheck(next, next.turn, rules) ? (outcome(next, rules)?.reason === 'Checkmate' ? '#' : '+') : '';
    return move.drop.toUpperCase() + '@' + squareName(move.to) + suffix;
  }
  if (move.rook) return move.to > move.from ? 'O-O' : 'O-O-O';
  const p = pos.board[move.from]!; const capture = !!pos.board[move.to] || move.ep !== undefined;
  let prefix = p.kind === 'p' ? (capture ? squareName(move.from)[0] : '') : p.kind.toUpperCase();
  if (p.kind !== 'p') {
    const same = legalMoves(pos, rules).filter(m => m.to === move.to && m.from !== move.from && pos.board[m.from]?.kind === p.kind);
    if (same.length) prefix += same.every(m => m.from % 8 !== move.from % 8) ? squareName(move.from)[0] : same.every(m => Math.floor(m.from / 8) !== Math.floor(move.from / 8)) ? squareName(move.from)[1] : squareName(move.from);
  }
  const next = applyMove(pos, move), end = outcome(next, rules);
  return prefix + (capture ? 'x' : '') + squareName(move.to) + (move.promotion ? '=' + move.promotion.toUpperCase() : '') + (royal(rules) && inCheck(next, next.turn, rules) ? end?.reason === 'Checkmate' ? '#' : '+' : '');
}
