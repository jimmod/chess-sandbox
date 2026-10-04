import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialPosition, legalMoves, applyMove, CLASSIC, outcome, inCheck, squareIndex, PRESETS, emptyPockets, notation, legalDuckSquares } from '../lib/chess/engine.ts';
import type { Position, Rules } from '../lib/chess/engine.ts';
import { chooseMove } from '../lib/chess/ai.ts';
function play(p: Position, from: string, to: string, r: Rules = CLASSIC) { const m = legalMoves(p, r).find(m => m.from === squareIndex(from) && m.to === squareIndex(to)); assert.ok(m, `${from}-${to}`); return applyMove(p, m); }
function perft(p: Position, depth: number): number { if (!depth) return 1; return legalMoves(p, CLASSIC).reduce((n, m) => n + perft(applyMove(p, m), depth - 1), 0); }
const bare = (): Position => ({ board: Array(64).fill(null), turn: 'w', rights: '', ep: null, halfmove: 0, ply: 0 });
test('standard move tree agrees with known perft counts through depth three', () => { assert.equal(perft(initialPosition(), 1), 20); assert.equal(perft(initialPosition(), 2), 400); assert.equal(perft(initialPosition(), 3), 8902); });
test('Fools mate ends the game', () => { let p = initialPosition(); for (const [a, b] of [['f2','f3'],['e7','e5'],['g2','g4'],['d8','h4']]) p = play(p,a,b); assert.deepEqual(outcome(p, CLASSIC), { winner: 'b', reason: 'Checkmate' }); });
test('en passant capture removes the passed pawn and expires', () => { let p = initialPosition(); for (const [a,b] of [['e2','e4'],['a7','a6'],['e4','e5'],['d7','d5']]) p=play(p,a,b); assert.ok(legalMoves(p,CLASSIC).some(m=>m.ep!==undefined)); const captured=play(p,'e5','d6'); assert.equal(captured.board[squareIndex('d5')], null); assert.equal(legalMoves(p,{...CLASSIC,enPassant:false}).some(m=>m.ep!==undefined), false); });
test('castling moves both pieces and cannot cross attack', () => { const p = bare(); p.rights='K'; p.board[60]={color:'w',kind:'k'}; p.board[63]={color:'w',kind:'r'}; p.board[4]={color:'b',kind:'k'}; const n=play(p,'e1','g1'); assert.equal(n.board[61]?.kind,'r'); p.board[5]={color:'b',kind:'r'}; assert.equal(legalMoves(p,CLASSIC).some(m=>m.rook),false); });
test('promotion offers four choices or the custom forced piece', () => { const p=bare(); p.board[60]={color:'w',kind:'k'};p.board[4]={color:'b',kind:'k'};p.board[8]={color:'w',kind:'p'}; assert.equal(legalMoves(p,CLASSIC).filter(m=>m.from===8).length,4); assert.equal(legalMoves(p,{...CLASSIC,promotion:'n'}).find(m=>m.from===8)?.promotion,'n'); });
test('giveaway requires captures and treats the king as an ordinary piece', () => {const p=bare();p.board[60]={color:'w',kind:'k'};p.board[52]={color:'b',kind:'r'};const r=PRESETS.find(p => p.id === 'giveaway')!.rules; assert.equal(legalMoves(p,r).length,1);assert.equal(legalMoves(p,r)[0].to,52);const next=applyMove(p,legalMoves(p,r)[0]);assert.equal(outcome(next,r)?.winner,'b');});
test('hill, capture, pawn and knight variants change the actual rules',()=>{const p=bare();p.board[35]={color:'w',kind:'k'};p.board[4]={color:'b',kind:'k'};assert.equal(outcome(p,{...CLASSIC,goal:'hill'})?.winner,'w');p.board[4]=null;assert.equal(outcome(p,{...CLASSIC,goal:'capture'})?.winner,'w');assert.equal(legalMoves(initialPosition(),{...CLASSIC,doubleStep:false}).length,12);const n=bare();n.board[27]={color:'w',kind:'n'};assert.equal(legalMoves(n,{...CLASSIC,goal:'capture',superKnights:true}).length,16);n.board[27]={color:'w',kind:'p'};n.board[36]={color:'b',kind:'r'};assert.ok(legalMoves(n,{...CLASSIC,goal:'capture',backwardCapture:true}).some(m=>m.to===36));});
test('a pinned piece cannot expose its king',()=>{const p=bare();p.board[60]={color:'w',kind:'k'};p.board[52]={color:'w',kind:'r'};p.board[4]={color:'b',kind:'r'};p.board[0]={color:'b',kind:'k'};assert.ok(!inCheck(p,'w',CLASSIC));assert.ok(legalMoves(p,CLASSIC).filter(m=>m.from===52).every(m=>m.to%8===4));});
test('random starts with except-pawns preserves pawns, shuffles back ranks, and mirrors sides', () => {
  let seed = 42;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const seen = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const rules = { ...CLASSIC, randomStart: 'except-pawns' as const };
    const p = initialPosition(rules, random);
    const top = p.board.slice(0,8).map(p => p!.kind);
    seen.add(top.join(''));
    assert.deepEqual(top.slice().sort(), ['r','n','b','q','k','b','n','r'].sort());
    assert.deepEqual(p.board.slice(56).map(p => p!.kind), top);
    assert.notEqual(top.join(''), 'rnbqkbnr');
    assert.ok(p.board.slice(8,16).every(p => p?.kind === 'p' && p.color === 'b'));
    assert.ok(p.board.slice(48,56).every(p => p?.kind === 'p' && p.color === 'w'));
    assert.equal(p.rights, '');
    assert.equal(inCheck(p, 'w', rules), false);
    assert.equal(inCheck(p, 'b', rules), false);
    assert.ok(legalMoves(p,rules).length > 0);
    assert.equal(outcome(p,rules), null);
  }
  assert.ok(seen.size > 50);
  assert.equal(initialPosition(CLASSIC).rights, 'KQkq');
});
test('random starts with all randomizes all 16 pieces, mirrors ranks, and prevents check', () => {
  let seed = 12345;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const expectedArmy = ['r','r','n','n','b','b','q','k','p','p','p','p','p','p','p','p'].sort();
  for (let i = 0; i < 100; i++) {
    const rules = { ...CLASSIC, randomStart: 'all' as const };
    const p = initialPosition(rules, random);
    const black16 = p.board.slice(0, 16).map(sq => sq!.kind).sort();
    const white16 = p.board.slice(48, 64).map(sq => sq!.kind).sort();
    assert.deepEqual(black16, expectedArmy);
    assert.deepEqual(white16, expectedArmy);
    // Verify rank-reflected symmetry
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 8; c++) {
        assert.equal(p.board[r * 8 + c]?.kind, p.board[(7 - r) * 8 + c]?.kind);
      }
    }
    assert.equal(p.rights, '');
    assert.equal(inCheck(p, 'w', rules), false);
    assert.equal(inCheck(p, 'b', rules), false);
    assert.ok(legalMoves(p, rules).length > 0);
    assert.equal(outcome(p, rules), null);
  }
});
test('AI calculates legal moves from randomized starting positions (except-pawns and all)', () => {
  for (const mode of ['except-pawns', 'all'] as const) {
    const rules = { ...CLASSIC, randomStart: mode };
    const p = initialPosition(rules, () => 0.42);
    const move = chooseMove(p, rules, 'easy');
    assert.ok(move !== null);
    const legal = legalMoves(p, rules);
    assert.ok(legal.some(m => m.from === move.from && m.to === move.to));
  }
});
test('crazyhouse captures enter pockets and promoted pieces return as pawns', () => {
  const rules = { ...CLASSIC, pieceDrops: true };
  const p = bare();
  p.pockets = emptyPockets();
  p.board[60] = { color: 'w', kind: 'k' };
  p.board[4] = { color: 'b', kind: 'k' };
  p.board[52] = { color: 'w', kind: 'r' };
  p.board[12] = { color: 'b', kind: 'q' };
  const afterCapture = applyMove(p, { from: 52, to: 12 });
  assert.equal(afterCapture.pockets?.w.q, 1);
  assert.equal(afterCapture.pockets?.b.q, 0);
  // White will be able to legally drop this queen on its next turn
  assert.ok(legalMoves(applyMove(afterCapture, { from: 4, to: 3 }), rules).some(m => m.drop === 'q'));

  const p2 = bare();
  p2.pockets = emptyPockets();
  p2.board[60] = { color: 'w', kind: 'k' };
  p2.board[4] = { color: 'b', kind: 'k' };
  p2.board[52] = { color: 'w', kind: 'r' };
  p2.board[12] = { color: 'b', kind: 'q', promoted: true };
  const afterPromotedCapture = applyMove(p2, { from: 52, to: 12 });
  assert.equal(afterPromotedCapture.pockets?.w.q, 0);
  assert.equal(afterPromotedCapture.pockets?.w.p, 1);
});
test('crazyhouse drops obey rank restrictions, king safety, and notation', () => {
  const rules = { ...CLASSIC, pieceDrops: true };
  const p = bare();
  p.pockets = emptyPockets();
  p.pockets.w.p = 1;
  p.pockets.w.n = 1;
  p.board[60] = { color: 'w', kind: 'k' };
  p.board[4] = { color: 'b', kind: 'k' };
  const moves = legalMoves(p, rules);

  const pawnDrops = moves.filter(m => m.drop === 'p');
  assert.ok(pawnDrops.every(m => m.to >= 8 && m.to < 56));
  assert.ok(pawnDrops.some(m => m.to === 28));

  const knightDrops = moves.filter(m => m.drop === 'n');
  assert.ok(knightDrops.some(m => m.to === 0));
  assert.ok(knightDrops.some(m => m.to === 63));

  const inCheckPos = bare();
  inCheckPos.pockets = emptyPockets();
  inCheckPos.pockets.w.n = 1;
  inCheckPos.pockets.w.p = 1;
  inCheckPos.board[60] = { color: 'w', kind: 'k' };
  inCheckPos.board[4] = { color: 'b', kind: 'k' };
  inCheckPos.board[20] = { color: 'b', kind: 'r' };
  assert.ok(inCheck(inCheckPos, 'w', rules));
  const checkResolvingMoves = legalMoves(inCheckPos, rules);
  const blockingDrops = checkResolvingMoves.filter(m => m.drop !== undefined);
  assert.ok(blockingDrops.length > 0);
  assert.ok(blockingDrops.every(m => [52, 44, 36, 28].includes(m.to)));

  const matePos = bare();
  matePos.pockets = emptyPockets();
  matePos.pockets.w.q = 1;
  matePos.board[60] = { color: 'w', kind: 'k' };
  matePos.board[7] = { color: 'b', kind: 'k' };  // h8
  matePos.board[6] = { color: 'b', kind: 'p' };  // g8
  matePos.board[15] = { color: 'b', kind: 'p' }; // h7
  matePos.board[20] = { color: 'w', kind: 'n' }; // e6 knight defending g7
  assert.equal(inCheck(matePos, 'b', rules), false);
  const dropQ = { from: -1, to: 14, drop: 'q' as const };
  assert.equal(notation(matePos, dropQ, rules), 'Q@g7#');
  const mated = applyMove(matePos, dropQ);
  assert.deepEqual(outcome(mated, rules), { winner: 'w', reason: 'Checkmate' });
});
test('AI evaluates and selects crazyhouse drop moves', () => {
  const rules = { ...CLASSIC, pieceDrops: true };
  const p = bare();
  p.pockets = emptyPockets();
  p.pockets.w.q = 1;
  p.board[60] = { color: 'w', kind: 'k' };
  p.board[7] = { color: 'b', kind: 'k' };  // h8
  p.board[6] = { color: 'b', kind: 'p' };  // g8
  p.board[15] = { color: 'b', kind: 'p' }; // h7
  p.board[20] = { color: 'w', kind: 'n' }; // e6 knight defending g7
  const bestMove = chooseMove(p, rules, 'medium');
  assert.ok(bestMove !== null);
  assert.equal(bestMove.drop, 'q');
  assert.equal(bestMove.to, 14);
});
test('duck blocks sliding rays, pawn steps, and castling paths', () => {
  const duckRules = PRESETS.find(p => p.id === 'duck')!.rules;
  const p = bare();
  p.board[56] = { color: 'w', kind: 'r' }; // a1
  p.board[32] = { color: 'b', kind: 'p' }; // a4
  p.board[40] = null; // a3
  p.board[48] = null; // a2
  p.duck = 40; // duck on a3

  // Rook cannot move onto or through duck on a3
  const rookMoves = legalMoves(p, duckRules).filter(m => m.from === 56);
  assert.ok(rookMoves.some(m => m.to === 48)); // a2 is reachable
  assert.ok(!rookMoves.some(m => m.to === 40)); // a3 (duck) is blocked
  assert.ok(!rookMoves.some(m => m.to === 32)); // a4 is blocked by duck

  // Pawn blocked by duck
  const pPawn = bare();
  pPawn.board[52] = { color: 'w', kind: 'p' }; // e2
  pPawn.duck = 44; // duck on e3
  const pawnMoves1 = legalMoves(pPawn, duckRules).filter(m => m.from === 52);
  assert.equal(pawnMoves1.length, 0); // cannot step to e3 or double-step to e4

  pPawn.duck = 36; // duck on e4
  const pawnMoves2 = legalMoves(pPawn, duckRules).filter(m => m.from === 52);
  assert.equal(pawnMoves2.length, 1);
  assert.equal(pawnMoves2[0].to, 44); // can single step to e3, but not e4

  // Knight can jump over duck, but cannot land on it
  const pKnight = bare();
  pKnight.board[57] = { color: 'w', kind: 'n' }; // b1
  pKnight.duck = 42; // c3
  const knightMoves = legalMoves(pKnight, duckRules).filter(m => m.from === 57);
  assert.ok(!knightMoves.some(m => m.to === 42)); // cannot land on c3
  assert.ok(knightMoves.some(m => m.to === 40)); // can land on a3

  // Duck prevents castling through or into its square
  const pCastle = bare();
  pCastle.rights = 'K';
  pCastle.board[60] = { color: 'w', kind: 'k' };
  pCastle.board[63] = { color: 'w', kind: 'r' };
  pCastle.duck = 61; // f1
  assert.equal(legalMoves(pCastle, duckRules).some(m => m.rook !== undefined), false);
});
test('duck must be moved to an empty square and cannot stay on the same square', () => {
  const duckRules = PRESETS.find(p => p.id === 'duck')!.rules;
  const p = bare();
  p.board[0] = { color: 'b', kind: 'k' };
  p.board[60] = { color: 'w', kind: 'k' };
  p.duck = 36; // duck currently on e4

  const validSqs = legalDuckSquares(p);
  assert.ok(!validSqs.includes(36)); // cannot remain on e4
  assert.ok(!validSqs.includes(0));  // cannot be on occupied square a8
  assert.ok(!validSqs.includes(60)); // cannot be on occupied square e1
  assert.equal(validSqs.length, 61); // 64 - 2 pieces - 1 current duck

  // First move when duck is null: duck can be placed on any empty square
  const pInit = initialPosition(duckRules);
  const initDuckSqs = legalDuckSquares(pInit);
  assert.equal(initDuckSqs.length, 32); // 32 empty squares on standard board
});
test('duck chess win condition is direct king capture and notation records duck placement', () => {
  const duckRules = PRESETS.find(p => p.id === 'duck')!.rules;
  const p = bare();
  p.board[59] = { color: 'w', kind: 'k' }; // d1 king
  p.board[60] = { color: 'w', kind: 'q' }; // e1 queen
  p.board[4] = { color: 'b', kind: 'k' };  // e8 king
  p.duck = 20; // e6

  // Queen cannot reach king because duck blocks e6
  const blockedMoves = legalMoves(p, duckRules);
  assert.ok(!blockedMoves.some(m => m.to === 4));

  // Move duck away to a5 (24)
  p.duck = 24;
  const freeMoves = legalMoves(p, duckRules);
  const captureKing = freeMoves.find(m => m.to === 4);
  assert.ok(captureKing !== null);

  // Directly capturing the king wins
  const winningMove = { ...captureKing! };
  assert.equal(notation(p, winningMove, duckRules), 'Qxe8');
  const won = applyMove(p, winningMove);
  assert.deepEqual(outcome(won, duckRules), { winner: 'w', reason: 'King captured' });

  // Normal piece move with duck records @square
  const normalMove = { from: 60, to: 52, duck: 36 };
  assert.equal(notation(p, normalMove, duckRules), 'Qe2@e4');
});
test('AI selects winning king captures and duck placements in Duck Chess', () => {
  const duckRules = PRESETS.find(p => p.id === 'duck')!.rules;
  const p = bare();
  p.board[59] = { color: 'w', kind: 'k' }; // d1 king
  p.board[60] = { color: 'w', kind: 'q' };
  p.board[4] = { color: 'b', kind: 'k' };
  p.duck = 16; // a6 (duck not blocking e-file)

  const move = chooseMove(p, duckRules, 'medium');
  assert.ok(move !== null);
  assert.equal(move.to, 4); // AI captures the king immediately to win!

  // In non-immediate win, AI produces a move with a valid duck square
  const start = initialPosition(duckRules);
  const startMove = chooseMove(start, duckRules, 'easy');
  assert.ok(startMove !== null);
  assert.ok(startMove.duck !== undefined);
  assert.ok(startMove.duck >= 0 && startMove.duck < 64);
  assert.ok(start.board[startMove.duck] === null || startMove.duck === startMove.from);
});
test('total annihilation rules: king can be captured without ending game, only total wipeout wins', () => {
  const annRules = PRESETS.find(p => p.id === 'annihilation')!.rules;
  assert.equal(annRules.goal, 'annihilation');

  const p = bare();
  p.turn = 'w';
  p.board[60] = { color: 'w', kind: 'q' }; // e1 queen
  p.board[56] = { color: 'w', kind: 'r' }; // a1 rook
  p.board[4] = { color: 'b', kind: 'k' };  // e8 king
  p.board[0] = { color: 'b', kind: 'r' };  // a8 rook

  // White can capture black's king
  const captureKingMove = legalMoves(p, annRules).find(m => m.from === 60 && m.to === 4);
  assert.ok(captureKingMove);

  // Capturing king does NOT end game because black still has a rook
  const afterKingCaptured = applyMove(p, captureKingMove);
  assert.equal(afterKingCaptured.board[4]?.color, 'w');
  assert.equal(afterKingCaptured.board[0]?.color, 'b');
  assert.equal(outcome(afterKingCaptured, annRules), null);

  // Black moves the rook from a8 (0) to a7 (8)
  const blackMove = legalMoves(afterKingCaptured, annRules).find(m => m.from === 0 && m.to === 8);
  assert.ok(blackMove);
  const afterRookMove = applyMove(afterKingCaptured, blackMove);

  // White rook at a1 (56) captures the last black piece (rook at a7, 8)
  const captureRookMove = legalMoves(afterRookMove, annRules).find(m => m.from === 56 && m.to === 8);
  assert.ok(captureRookMove);
  const afterFinalCapture = applyMove(afterRookMove, captureRookMove);

  // All black pieces are eliminated -> White wins
  assert.deepEqual(outcome(afterFinalCapture, annRules), { winner: 'w', reason: 'All enemy pieces eliminated' });
});
test('total annihilation rules: having pieces but no legal moves causes defeat', () => {
  const annRules = PRESETS.find(p => p.id === 'annihilation')!.rules;
  const p = bare();
  p.turn = 'w';
  // White has a trapped pawn that cannot move
  p.board[48] = { color: 'w', kind: 'p' }; // a2 pawn
  p.board[40] = { color: 'b', kind: 'p' }; // a3 pawn blocking it
  // Black has another piece somewhere
  p.board[0] = { color: 'b', kind: 'r' };

  assert.equal(legalMoves(p, annRules).length, 0);
  assert.deepEqual(outcome(p, annRules), { winner: 'b', reason: 'No legal moves left' });
});
test('AI can search and select moves in Total Annihilation', () => {
  const annRules = PRESETS.find(p => p.id === 'annihilation')!.rules;
  const p = bare();
  p.turn = 'w';
  p.board[60] = { color: 'w', kind: 'k' };
  p.board[52] = { color: 'w', kind: 'r' };
  p.board[4] = { color: 'b', kind: 'k' };
  p.board[12] = { color: 'b', kind: 'p' };

  const move = chooseMove(p, annRules, 'medium');
  assert.ok(move !== null);
  // White rook at 52 can capture pawn at 12
  assert.ok(legalMoves(p, annRules).some(m => m.from === move.from && m.to === move.to));
});
test('total annihilation rules: king can move into kill zones (attacked squares) and adjacent to enemy king', () => {
  const annRules = PRESETS.find(p => p.id === 'annihilation')!.rules;
  const p = bare();
  p.turn = 'w';
  p.board[60] = { color: 'w', kind: 'k' }; // e1 king
  p.board[36] = { color: 'b', kind: 'r' }; // e4 rook attacking e3 and e2
  p.board[53] = { color: 'b', kind: 'k' }; // f2 king adjacent to e1 and e2

  const moves = legalMoves(p, annRules).filter(m => m.from === 60);
  // In classic chess, e1 king cannot move to e2 (attacked by rook and king) or capture f2.
  // In total annihilation, e2 (kill zone) and f2 (capturing enemy king) are both fully legal.
  assert.ok(moves.some(m => m.to === 52)); // e2 (in the kill zone)
  assert.ok(moves.some(m => m.to === 53)); // capturing enemy king directly
});
test('atomic chess: captures detonate explosions destroying capturer, victim, and adjacent non-pawns while pawns survive', () => {
  const atomicRules = PRESETS.find(p => p.id === 'atomic')!.rules;
  assert.equal(atomicRules.atomic, true);

  const p = bare();
  p.turn = 'w';
  p.board[60] = { color: 'w', kind: 'k' }; // e1 king (safe far away)
  p.board[0] = { color: 'b', kind: 'k' };  // a8 king (safe far away)
  p.board[36] = { color: 'w', kind: 'r' }; // e4 rook
  p.board[28] = { color: 'b', kind: 'q' }; // e5 queen
  // Surrounding squares around e5 (28):
  p.board[27] = { color: 'b', kind: 'b' }; // d5 bishop (adjacent non-pawn -> should explode)
  p.board[29] = { color: 'w', kind: 'n' }; // f5 knight (adjacent friendly non-pawn -> should explode)
  p.board[20] = { color: 'b', kind: 'p' }; // e6 pawn (adjacent pawn -> should SURVIVE)

  // White rook captures black queen on 28
  const captureMove = legalMoves(p, atomicRules).find(m => m.from === 36 && m.to === 28);
  assert.ok(captureMove);

  const afterExplosion = applyMove(p, captureMove, atomicRules);
  assert.equal(afterExplosion.board[36], null); // Capturing rook destroyed
  assert.equal(afterExplosion.board[28], null); // Captured queen destroyed
  assert.equal(afterExplosion.board[27], null); // Adjacent black bishop destroyed
  assert.equal(afterExplosion.board[29], null); // Adjacent white knight destroyed
  assert.equal(afterExplosion.board[20]?.kind, 'p'); // Adjacent pawn SURVIVED
  assert.ok(afterExplosion.lastExplosion?.includes(28));
  assert.ok(afterExplosion.lastExplosion?.includes(27));
  assert.ok(afterExplosion.lastExplosion?.includes(29));
});
test('atomic chess: king cannot capture pieces and cannot make moves that blow up own king', () => {
  const atomicRules = PRESETS.find(p => p.id === 'atomic')!.rules;
  const p = bare();
  p.turn = 'w';
  p.board[60] = { color: 'w', kind: 'k' }; // e1 king
  p.board[0] = { color: 'b', kind: 'k' };  // a8 king
  p.board[52] = { color: 'b', kind: 'p' }; // e2 pawn right next to white king

  const kingMoves = legalMoves(p, atomicRules).filter(m => m.from === 60);
  // King cannot capture e2 pawn because captures destroy the capturer!
  assert.ok(!kingMoves.some(m => m.to === 52));

  // If a white piece captures something that would blow up white's own king, it is illegal
  p.board[61] = { color: 'w', kind: 'r' }; // f1 rook
  p.board[53] = { color: 'b', kind: 'n' }; // f2 knight (adjacent to e1 king!)
  // If f1 rook captures f2 knight, explosion at f2 would destroy e1 king!
  const rookCapture = legalMoves(p, atomicRules).find(m => m.from === 61 && m.to === 53);
  assert.equal(rookCapture, undefined); // Illegal because own king would blow up!
});
test('atomic chess: connected kings are immune to check', () => {
  const atomicRules = PRESETS.find(p => p.id === 'atomic')!.rules;
  const p = bare();
  p.turn = 'w';
  p.board[36] = { color: 'w', kind: 'k' }; // e4 king
  p.board[37] = { color: 'b', kind: 'k' }; // f4 king (adjacent / touching!)
  p.board[32] = { color: 'b', kind: 'r' }; // a4 rook targeting e4 king along rank 4

  // Because the kings are touching, neither king can be in check!
  assert.equal(inCheck(p, 'w', atomicRules), false);
  assert.equal(inCheck(p, 'b', atomicRules), false);
});
test('atomic chess: detonating enemy king wins immediately and AI executes it', () => {
  const atomicRules = PRESETS.find(p => p.id === 'atomic')!.rules;
  const p = bare();
  p.turn = 'w';
  p.board[60] = { color: 'w', kind: 'k' }; // e1 king
  p.board[52] = { color: 'w', kind: 'q' }; // e2 queen
  p.board[4] = { color: 'b', kind: 'k' };  // e8 king
  p.board[12] = { color: 'b', kind: 'n' }; // e7 knight (adjacent to e8 king!)

  // White queen captures e7 knight -> explosion at e7 destroys e8 king!
  const aiMove = chooseMove(p, atomicRules, 'medium');
  assert.ok(aiMove);
  assert.equal(aiMove.from, 52);
  assert.equal(aiMove.to, 12);

  const afterMove = applyMove(p, aiMove, atomicRules);
  assert.deepEqual(outcome(afterMove, atomicRules), { winner: 'w', reason: 'King exploded' });
});



