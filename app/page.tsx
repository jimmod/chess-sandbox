"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { RotateCcw, RefreshCw, SlidersHorizontal, ChevronDown, ChevronUp, FlaskConical, Cpu, Flag, Smile, Zap, Flame, Trophy, AlertTriangle, LoaderCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CLASSIC, PRESETS, initialPosition, legalMoves, applyMove, outcome, inCheck, royal, notation, positionKey, squareName, opposite } from '@/lib/chess/engine';
import type { Position, Rules, Move, Color, Piece } from '@/lib/chess/engine';
import type { Difficulty } from '@/lib/chess/ai';
import ChessWorker from '@/lib/chess/ai.worker?worker';

const glyphs = { w: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }, b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' } };
const names = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
const levelCopy = { easy: 'A relaxed opponent. Room to experiment.', medium: 'Looks ahead. Keeps you on your toes.', hard: 'Deeper search. A sharper challenge.' };
const goals = { checkmate: 'Checkmate the king', capture: 'Capture the king', hill: 'King to the center', giveaway: 'Give away all pieces' };
type SideChoice = Color | 'random';
type Snapshot = { position: Position; move?: Move; label?: string };
function PieceGlyph({ piece }: { piece: Piece }) { return <span aria-hidden="true" className={piece.color === 'w' ? 'white-piece' : 'black-piece'}>{glyphs[piece.color][piece.kind]}</span>; }
function Choice({ value, onChange, options, label }: { value: string; onChange: (s: string) => void; options: [string, string][]; label: string }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger className="choice-select" aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{options.map(([v, title]) => <SelectItem value={v} key={v}>{title}</SelectItem>)}</SelectContent></Select>;
}
export default function Home() {
  const [history, setHistory] = useState<Snapshot[]>([{ position: initialPosition() }]);
  const [rules, setRules] = useState<Rules>({ ...CLASSIC });
  const [draft, setDraft] = useState<Rules>({ ...CLASSIC });
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [human, setHuman] = useState<Color>('w');
  const [draftHuman, setDraftHuman] = useState<SideChoice>('w');
  const [activeSideChoice, setActiveSideChoice] = useState<SideChoice>('w');
  const [flipped, setFlipped] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [promotion, setPromotion] = useState<Move[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [aiError, setAiError] = useState('');
  const [retry, setRetry] = useState(0);
  const [confirmNew, setConfirmNew] = useState(false);
  const [resigned, setResigned] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const pos = history[history.length - 1].position;
  const moves = useMemo(() => legalMoves(pos, rules), [pos, rules]);
  const end = useMemo(() => {
    if (resigned) return { winner: opposite(human), reason: 'Resignation' };
    const result = outcome(pos, rules, moves); if (result) return result;
    const key = positionKey(pos, rules);
    if (history.filter(h => positionKey(h.position, rules) === key).length >= 3) return { winner: null, reason: 'Threefold repetition' };
    return null;
  }, [pos, rules, moves, history, resigned, human]);
  const eligiblePieces = useMemo(() => new Set(moves.map(m => m.from)), [moves]);
  const showEligiblePieces = rules.markEligiblePieces && !end && pos.turn === human;
  const check = royal(rules) && inCheck(pos, pos.turn, rules);
  const draftPreset = PRESETS.find(p => JSON.stringify(p.rules) === JSON.stringify(draft));
  const changed = JSON.stringify(draft) !== JSON.stringify(rules) || draftHuman !== activeSideChoice;
  const lastMove = history[history.length - 1].move;
  const moveList = history.slice(1);
  const thinking = !end && pos.turn !== human && !aiError;
  const status = end ? (end.winner === null ? 'Game drawn' : end.winner === human ? 'You win!' : 'Sandbox AI wins') : pos.turn !== human ? (aiError ? 'AI paused' : 'Sandbox AI is thinking…') : check ? 'You’re in check' : 'Your turn';

  function commitMove(m: Move) {
    const next = applyMove(pos, m);
    setHistory(h => [...h, { position: next, move: m, label: notation(pos, m, rules) }]);
    setSelected(null); setPromotion([]); setAiError('');
  }
  const commitRef = useRef(commitMove);
  useEffect(() => { commitRef.current = commitMove; });
  useEffect(() => {
    if (end || pos.turn === human) return;
    let worker: Worker;
    try {
      worker = new ChessWorker();
      workerRef.current = worker;
      worker.onmessage = ({ data }) => {
        if (data.error) setAiError(data.error);
        else if (data.move) commitRef.current(data.move);
        else setAiError('No AI move returned. Try again.');
      };
      worker.onerror = () => { setAiError('AI could not start. Please retry.'); };
      const timer = setTimeout(() => worker.postMessage({ position: pos, rules, difficulty }), 300);
      return () => { clearTimeout(timer); worker.terminate(); workerRef.current = null; };
    } catch { queueMicrotask(() => setAiError('This browser could not start the AI. Please try another browser.')); }
  }, [pos, rules, difficulty, human, end, retry]);
  function startGame() {
    const side: Color = draftHuman === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : draftHuman;
    workerRef.current?.terminate(); setRules({ ...draft }); setActiveSideChoice(draftHuman); setHuman(side); setFlipped(side === 'b');
    setHistory([{ position: initialPosition(draft) }]); setSelected(null); setPromotion([]); setResigned(false); setAiError(''); setConfirmNew(false);
  }
  function requestNew() { if (history.length > 1 && !end) setConfirmNew(true); else startGame(); }
  function clickSquare(i: number) {
    if (end || pos.turn !== human || thinking) return;
    const candidates = moves.filter(m => m.from === selected && m.to === i);
    if (candidates.length > 1) { setPromotion(candidates); return; }
    if (candidates.length === 1) { commitMove(candidates[0]); return; }
    setSelected(selected === i ? null : pos.board[i]?.color === human ? i : null);
  }
  function undo() {
    workerRef.current?.terminate();
    const remove = pos.turn === human && history.length > 2 ? 2 : 1;
    setHistory(h => h.slice(0, Math.max(1, h.length - remove))); setResigned(false); setSelected(null); setPromotion([]); setAiError('');
  }
  const liveRef = useRef({ pos, rules, moves, status });
  useEffect(() => { liveRef.current = { pos, rules, moves, status }; });
  useEffect(() => {
    type ToolContext = { registerTool: (tool: object, options: { signal: AbortSignal }) => void | Promise<void> };
    const context = (document as Document & { modelContext?: ToolContext }).modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    try { Promise.resolve(context.registerTool({ name: 'read_chess_game', description: 'Read the current chess board, active rules, game status, and legal moves.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: (input: unknown) => {
      if (input === null || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new Error('Expected an empty object.');
      const g = liveRef.current;
      return { status: g.status, turn: g.pos.turn, rules: g.rules, pieces: g.pos.board.flatMap((p, i) => p ? [{ square: squareName(i), ...p }] : []), legalMoves: g.moves.map(m => squareName(m.from) + squareName(m.to) + (m.promotion ?? '')) };
    } }, { signal: lifecycle.signal })).catch(() => {}); } catch { /* Optional browser capability. */ }
    return () => lifecycle.abort();
  }, []);

  const toggles: [keyof Rules, string, string][] = [
    ['markEligiblePieces', 'Mark eligible pieces', 'Mark your pieces that have a legal move.'],
    ['forcedCapture', 'Forced captures', 'If a capture is available, take it.'],
    ['castling', 'Castling', 'Let king and rook move together.'],
    ['enPassant', 'En passant', 'Capture a pawn as it passes.'],
    ['doubleStep', 'Pawn double step', 'Pawns may open with two squares.'],
    ['backwardCapture', 'Backward pawn captures', 'Pawns can capture behind them.'],
    ['superKnights', 'Super knights', 'Knights also move one square any way.'],
  ];
  return <main>
    <header><Link className="brand" href="/" aria-label="Chess Sandbox home"><img className="brand-icon" src="/chess-sandbox-icon.png" alt="" width={44} height={44} /><span className="brand-name">Chess <span className="brand-light">Sandbox</span></span><sup>BETA</sup></Link><span className="header-note">A familiar game. Your rules.</span><span className="local-badge"><Cpu size={14} /> PLAY VS AI</span></header>
    <div className="workspace">
      <section className="play-area" aria-label="Chess game">
        <div className={`game-status ${end ? 'finished' : check && pos.turn === human ? 'warning' : thinking ? 'waiting' : 'ready'}`}>
          <div className="status-emblem" aria-hidden="true">{end ? <Trophy /> : thinking ? <LoaderCircle className="thinking-icon" /> : check && pos.turn === human ? <AlertTriangle /> : <span>{human === 'w' ? '♙' : '♟'}</span>}</div>
          <div className="status-copy" role="status" aria-live="polite" aria-atomic="true">
            <h1>{status}</h1>
            <p>You · {human === 'w' ? 'White' : 'Black'} · {end ? end.reason : `Move ${Math.floor(pos.ply / 2) + 1}`}</p>
          </div>
          <div className={`opponent-badge ${difficulty}`} title={`Sandbox AI · ${difficulty} · ${human === 'w' ? 'Black' : 'White'}`} aria-label={`Sandbox AI difficulty: ${difficulty}`}>
            {difficulty === 'easy' ? <Smile aria-hidden="true" /> : difficulty === 'medium' ? <Zap aria-hidden="true" /> : <Flame aria-hidden="true" />}
            <span>{difficulty}</span>
          </div>
        </div>
        <div className="board" role="group" aria-label="Chessboard. Select a piece then a highlighted square. Arrow keys navigate squares.">
          {Array.from({ length: 64 }, (_, display) => {
            const i = flipped ? 63 - display : display, piece = pos.board[i];
            const eligible = showEligiblePieces && eligiblePieces.has(i);
            const possible = moves.some(m => m.from === selected && m.to === i);
            const isCheck = check && piece?.kind === 'k' && piece.color === pos.turn;
            return <button key={i} id={`sq-${i}`} aria-label={`${squareName(i)}${piece ? ` ${piece.color === 'w' ? 'White' : 'Black'} ${names[piece.kind]}` : ' empty'}${eligible ? ', can move' : ''}${possible ? ', legal move' : ''}`} aria-pressed={selected === i} onClick={() => clickSquare(i)} onKeyDown={e => {
              const offsets: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowUp: -8, ArrowDown: 8 };
              if (e.key === 'Escape') setSelected(null);
              if (e.key in offsets) { e.preventDefault(); const target = display + offsets[e.key]; if (target >= 0 && target < 64) document.getElementById(`sq-${flipped ? 63 - target : target}`)?.focus(); }
            }} className={`square ${(Math.floor(i / 8) + i % 8) % 2 ? 'dark-square' : 'light-square'} ${selected === i ? 'selected' : ''} ${eligible ? 'eligible-piece' : ''} ${lastMove && (lastMove.from === i || lastMove.to === i) ? 'last-move' : ''} ${isCheck ? 'in-check' : ''} ${rules.goal === 'hill' && [27, 28, 35, 36].includes(i) ? 'hill-square' : ''}`}>
              {piece && <PieceGlyph piece={piece} />}{eligible && <span className="eligible-marker" aria-hidden="true" />}{possible && <span className={piece ? 'capture-target' : 'move-target'} />}
              {display % 8 === 0 && <small className="rank">{8 - Math.floor(i / 8)}</small>}{display >= 56 && <small className="file">{'abcdefgh'[i % 8]}</small>}
            </button>;
          })}
        </div>
        {showEligiblePieces && <p className="eligible-legend"><span aria-hidden="true" /> Marked pieces can move{moves.some(m => pos.board[m.to] || m.ep !== undefined) && (rules.forcedCapture || rules.goal === 'giveaway') ? ' · A capture is required' : ''}</p>}
        {aiError && <div className="error-message" role="alert">{aiError}<button onClick={() => { setAiError(''); setRetry(n => n + 1); }}>Retry AI</button></div>}
        <div className="board-toolbar"><div><button onClick={undo} disabled={history.length <= (human === 'b' ? 2 : 1)}><RotateCcw size={15} /> Undo turn</button><button onClick={() => setFlipped(f => !f)}><RefreshCw size={15} /> Flip board</button></div><button onClick={() => setConfirmResign(true)} disabled={!!end || history.length === 1} aria-label="Resign game"><Flag size={15} /></button></div>
        <div className="move-log"><div className="move-log-title"><h3>Move history</h3><span>{moveList.length} plies</span></div>{!moveList.length ? <p className="empty-history">Every experiment starts with a move.</p> : <div className="move-rows">{Array.from({ length: Math.ceil(moveList.length / 2) }, (_, i) => <div className="move-row" key={i}><span>{i + 1}.</span><b>{moveList[i * 2]?.label}</b><b>{moveList[i * 2 + 1]?.label ?? '…'}</b></div>)}</div>}</div>
      </section>
      <aside className="control-panel" aria-label="Game setup">
        <div className="sandbox-heading"><FlaskConical size={17} /><p className="eyebrow">YOUR GAME, REIMAGINED</p></div><h2>The rulebook is yours.</h2><p className="muted">Start with a classic. Then change the possibilities.</p>
        <div className="preset-grid">{PRESETS.map(p => <button key={p.id} className={`preset ${draftPreset?.id === p.id ? 'active' : ''}`} aria-pressed={draftPreset?.id === p.id} onClick={() => setDraft({ ...p.rules })}><b>{p.icon}</b>{p.name}<small>{p.description}</small>{draftPreset?.id === p.id && <span className="preset-check">✓</span>}</button>)}</div>
        <div className="custom-heading"><button className="custom-toggle" onClick={() => setExpanded(x => !x)} aria-expanded={expanded}><SlidersHorizontal size={16} /><span>Customize rules</span><span className="rule-count">{Object.keys(CLASSIC).filter(k => draft[k as keyof Rules] !== CLASSIC[k as keyof Rules]).length || Object.keys(CLASSIC).length} {JSON.stringify(draft) === JSON.stringify(CLASSIC) ? 'options' : 'changed'}</span>{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button></div>
        {expanded && <div className="rules-editor"><label className="field-label">Win condition</label><Choice label="Win condition" value={draft.goal} onChange={v => setDraft(d => ({ ...d, goal: v as Rules['goal'], ...(v === 'giveaway' ? { forcedCapture: true, castling: false, markEligiblePieces: true } : {}) }))} options={Object.entries(goals)} /><p className="rule-hint">{draft.goal === 'hill' ? 'Reach d4, e4, d5, or e5 with your king, or checkmate.' : draft.goal === 'giveaway' ? 'Captures are mandatory. Lose all your pieces or have no legal move to win. No check or castling.' : draft.goal === 'capture' ? 'Check is ignored. Capture the opposing king to win.' : 'Protect your king. Deliver checkmate to win.'}</p>
          <label className="field-label">Random starting position</label><Choice label="Random starting position" value={draft.randomStart} onChange={v => setDraft(d => ({ ...d, randomStart: v as Rules['randomStart'], ...(v !== 'off' ? { castling: false } : {}) }))} options={[['off', 'Off'], ['except-pawns', 'Except the pawns'], ['all', 'All']]} /><p className="rule-hint">{draft.randomStart === 'all' ? 'All 16 pieces and pawns are shuffled across both starting ranks. No castling.' : draft.randomStart === 'except-pawns' ? 'Shuffle both back ranks equally. Pawns stay on their usual ranks; no castling.' : 'Standard opening arrangement for both sides.'}</p>
          {toggles.map(([key, title, hint]) => <div className="rule-row" key={key}><label htmlFor={`rule-${key}`}><strong>{title}</strong><small>{hint}</small></label><Switch id={`rule-${key}`} checked={key === 'castling' && draft.randomStart !== 'off' ? false : Boolean(draft[key])} disabled={(draft.goal === 'giveaway' && (key === 'forcedCapture' || key === 'castling')) || (draft.randomStart !== 'off' && key === 'castling')} onCheckedChange={v => setDraft(d => ({ ...d, [key]: v }))} /></div>)}
          <label className="field-label">Pawn promotion</label><Choice label="Pawn promotion" value={draft.promotion} onChange={v => setDraft(d => ({ ...d, promotion: v as Rules['promotion'] }))} options={ [['choice', 'Choose any piece'], ['q', 'Always queen'], ['n', 'Always knight']] } />
        </div>}
        <h3>Meet your opponent</h3><RadioGroup aria-label="AI difficulty" className="difficulty-group" value={difficulty} onValueChange={v => setDifficulty(v as Difficulty)}>{(['easy', 'medium', 'hard'] as const).map((v, i) => <label key={v} className={`difficulty-choice ${difficulty === v ? 'active' : ''}`}><RadioGroupItem className="sr-only" value={v} /><span className="level-bars" aria-hidden="true">{[0,1,2].map(n => <i key={n} className={n <= i ? 'lit' : ''} />)}</span>{v[0].toUpperCase() + v.slice(1)}</label>)}</RadioGroup><p className="level-description">{levelCopy[difficulty]}</p>
        <div className="side-choice"><label className="field-label">Play as</label><Choice label="Play as" value={draftHuman} onChange={v => setDraftHuman(v as SideChoice)} options={ [['w', 'White'], ['b', 'Black'], ['random', 'Random']] } /></div>
        <button className="primary" onClick={requestNew}><span>♟</span>{changed ? 'Apply rules & start game' : 'New game'}</button><p className="setup-note">{changed ? 'Your changes take effect in a new game.' : 'New board. Fresh possibilities.'}</p>
        <div className="active-rules"><span>ON THIS BOARD</span><p>{goals[rules.goal]}{rules.randomStart !== 'off' ? ` · Random start (${rules.randomStart === 'all' ? 'all pieces' : 'except pawns'}) · No castling` : ''}{rules.forcedCapture && rules.goal !== 'giveaway' ? ' · Forced captures' : ''}{rules.superKnights ? ' · Super knights' : ''}{rules.backwardCapture ? ' · Backward captures' : ''}</p></div>
      </aside>
    </div>
    <footer><span>CHESS SANDBOX / EXPERIMENT. PLAY. REPEAT.</span><span>Your rules. Same rules for the AI.</span></footer>
    <Dialog open={promotion.length > 0} onOpenChange={open => { if (!open) setPromotion([]); }}><DialogContent className="chess-dialog"><DialogHeader><DialogTitle>Choose your promotion</DialogTitle><DialogDescription>Your pawn has reached the last rank.</DialogDescription></DialogHeader><div className="promotion-choices">{promotion.map(m => <button key={m.promotion} onClick={() => commitMove(m)} aria-label={`Promote to ${names[m.promotion!]}`}><PieceGlyph piece={{ color: human, kind: m.promotion! }} /><small>{names[m.promotion!]}</small></button>)}</div></DialogContent></Dialog>
    <Dialog open={confirmNew} onOpenChange={setConfirmNew}><DialogContent className="chess-dialog"><DialogHeader><DialogTitle>Start a fresh experiment?</DialogTitle><DialogDescription>This ends the current game and starts a new board with your selected rules.</DialogDescription></DialogHeader><button className="primary" onClick={startGame}>Start new game</button><button className="quiet-button" onClick={() => setConfirmNew(false)}>Keep playing</button></DialogContent></Dialog>
    <Dialog open={confirmResign} onOpenChange={setConfirmResign}><DialogContent className="chess-dialog"><DialogHeader><DialogTitle>Resign this game?</DialogTitle><DialogDescription>Sandbox AI will win this game. You can start a new one whenever you like.</DialogDescription></DialogHeader><button className="primary" onClick={() => { workerRef.current?.terminate(); setResigned(true); setConfirmResign(false); }}>Resign game</button><button className="quiet-button" onClick={() => setConfirmResign(false)}>Keep playing</button></DialogContent></Dialog>
  </main>;
}
