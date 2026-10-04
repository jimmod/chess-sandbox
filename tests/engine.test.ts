import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialPosition, legalMoves, applyMove, CLASSIC, outcome, inCheck, squareIndex, PRESETS } from '../lib/chess/engine.ts';
import type { Position, Rules } from '../lib/chess/engine.ts';
function play(p: Position, from: string, to: string, r: Rules = CLASSIC) { const m = legalMoves(p, r).find(m => m.from === squareIndex(from) && m.to === squareIndex(to)); assert.ok(m, `${from}-${to}`); return applyMove(p, m); }
function perft(p: Position, depth: number): number { if (!depth) return 1; return legalMoves(p, CLASSIC).reduce((n, m) => n + perft(applyMove(p, m), depth - 1), 0); }
const bare = (): Position => ({ board: Array(64).fill(null), turn: 'w', rights: '', ep: null, halfmove: 0, ply: 0 });
test('standard move tree agrees with known perft counts through depth three', () => { assert.equal(perft(initialPosition(), 1), 20); assert.equal(perft(initialPosition(), 2), 400); assert.equal(perft(initialPosition(), 3), 8902); });
test('Fools mate ends the game', () => { let p = initialPosition(); for (const [a, b] of [['f2','f3'],['e7','e5'],['g2','g4'],['d8','h4']]) p = play(p,a,b); assert.deepEqual(outcome(p, CLASSIC), { winner: 'b', reason: 'Checkmate' }); });
test('en passant capture removes the passed pawn and expires', () => { let p = initialPosition(); for (const [a,b] of [['e2','e4'],['a7','a6'],['e4','e5'],['d7','d5']]) p=play(p,a,b); assert.ok(legalMoves(p,CLASSIC).some(m=>m.ep!==undefined)); const captured=play(p,'e5','d6'); assert.equal(captured.board[squareIndex('d5')], null); assert.equal(legalMoves(p,{...CLASSIC,enPassant:false}).some(m=>m.ep!==undefined), false); });
test('castling moves both pieces and cannot cross attack', () => { const p = bare(); p.rights='K'; p.board[60]={color:'w',kind:'k'}; p.board[63]={color:'w',kind:'r'}; p.board[4]={color:'b',kind:'k'}; const n=play(p,'e1','g1'); assert.equal(n.board[61]?.kind,'r'); p.board[5]={color:'b',kind:'r'}; assert.equal(legalMoves(p,CLASSIC).some(m=>m.rook),false); });
test('promotion offers four choices or the custom forced piece', () => { const p=bare(); p.board[60]={color:'w',kind:'k'};p.board[4]={color:'b',kind:'k'};p.board[8]={color:'w',kind:'p'}; assert.equal(legalMoves(p,CLASSIC).filter(m=>m.from===8).length,4); assert.equal(legalMoves(p,{...CLASSIC,promotion:'n'}).find(m=>m.from===8)?.promotion,'n'); });
test('giveaway requires captures and treats the king as an ordinary piece', () => {const p=bare();p.board[60]={color:'w',kind:'k'};p.board[52]={color:'b',kind:'r'};const r=PRESETS[2].rules; assert.equal(legalMoves(p,r).length,1);assert.equal(legalMoves(p,r)[0].to,52);const next=applyMove(p,legalMoves(p,r)[0]);assert.equal(outcome(next,r)?.winner,'b');});
test('hill, capture, pawn and knight variants change the actual rules',()=>{const p=bare();p.board[35]={color:'w',kind:'k'};p.board[4]={color:'b',kind:'k'};assert.equal(outcome(p,{...CLASSIC,goal:'hill'})?.winner,'w');p.board[4]=null;assert.equal(outcome(p,{...CLASSIC,goal:'capture'})?.winner,'w');assert.equal(legalMoves(initialPosition(),{...CLASSIC,doubleStep:false}).length,12);const n=bare();n.board[27]={color:'w',kind:'n'};assert.equal(legalMoves(n,{...CLASSIC,goal:'capture',superKnights:true}).length,16);n.board[27]={color:'w',kind:'p'};n.board[36]={color:'b',kind:'r'};assert.ok(legalMoves(n,{...CLASSIC,goal:'capture',backwardCapture:true}).some(m=>m.to===36));});
test('a pinned piece cannot expose its king',()=>{const p=bare();p.board[60]={color:'w',kind:'k'};p.board[52]={color:'w',kind:'r'};p.board[4]={color:'b',kind:'r'};p.board[0]={color:'b',kind:'k'};assert.ok(!inCheck(p,'w',CLASSIC));assert.ok(legalMoves(p,CLASSIC).filter(m=>m.from===52).every(m=>m.to%8===4));});
test('random starts preserve armies, mirror sides, shield kings, and disable castling', () => {
  let seed = 42;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const seen = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const rules = { ...CLASSIC, randomStart: true };
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
