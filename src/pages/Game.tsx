import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getLevel } from "../levels";
import { saveLevelProgress } from "../progress";

type Cell = `${number},${number}`;

export default function Game() {
  const { id } = useParams();
  const maybeLevel = getLevel(Number(id));
  if (!maybeLevel) return <div className="center"><p>Level not found.</p></div>;
  const level = maybeLevel;

  const { cols, rows, cell } = level.grid;
  const W = cols * cell;
  const H = rows * cell;

  // game state
  const [placed, setPlaced] = useState<Set<Cell>>(() => new Set());
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // visuals & animations
  const [trail, setTrail] = useState<Map<Cell, number>>(new Map());
  const [cursor, setCursor] = useState<[number, number]>(() => [
    level.target.x,
    level.target.y,
  ]);
  const [lastAction, setLastAction] = useState<{ cell: Cell } | null>(null);

  // timer
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [paused]);

  // target cells
  const targetSet = useMemo(() => {
    const s = new Set<Cell>();
    const { x, y, w, h } = level.target;
    for (let iy = y; iy < y + h; iy++) {
      for (let ix = x; ix < x + w; ix++) s.add(`${ix},${iy}`);
    }
    return s;
  }, [level]);

  const targetArea = targetSet.size;
  const covered = useMemo(() => {
    let c = 0;
    for (const key of placed) if (targetSet.has(key)) c++;
    return c;
  }, [placed, targetSet]);

  const win = covered === targetArea;

  // Handle win detection and save progress
  useEffect(() => {
    if (win) {
      setPaused(true);
      
      // Calculate stars
      let stars = 1;
      if (moves <= level.par.moves) stars = 2;
      if (moves <= level.par.moves && seconds <= level.par.timeSec) stars = 3;
      
      // Save progress
      saveLevelProgress(Number(id), moves, seconds, stars);
    }
  }, [win, moves, seconds, level.par, id]);

  function withinTarget(ix: number, iy: number) {
    const { x, y, w, h } = level.target;
    return ix >= x && ix < x + w && iy >= y && iy < y + h;
  }

  // paint at current position; count a move ONLY if tile is new
  function paintAt(ix: number, iy: number) {
    const key: Cell = `${ix},${iy}`;

    // Update trail for visual effect (fade-out path)
    setTrail((m) => {
      const n = new Map(m);
      // Add current position to trail
      n.set(key, Date.now());
      
      // Clean up old trail entries (older than 3 seconds)
      const cutoff = Date.now() - 3000;
      for (const [trailKey, timestamp] of n.entries()) {
        if (timestamp < cutoff) {
          n.delete(trailKey);
        }
      }
      
      return n;
    });

    if (!withinTarget(ix, iy)) return;

    setPlaced((prev) => {
      const next = new Set(prev);
      const had = next.has(key);

      if (!had) {
        next.add(key);
        setMoves((m) => m + 1);
        setLastAction({ cell: key });
        
        // Clear action animation after a brief moment
        setTimeout(() => setLastAction(null), 200);
      }

      return next;
    });
  }

  // move cursor (keyboard or D-pad). Auto-paint at new position.
  function move(dx: number, dy: number) {
    setCursor(([x, y]) => {
      const nx = Math.max(0, Math.min(cols - 1, x + dx));
      const ny = Math.max(0, Math.min(rows - 1, y + dy));
      paintAt(nx, ny);
      return [nx, ny];
    });
  }

  // Manual paint at current cursor position (spacebar)
  function paintAtCursor() {
    const [ix, iy] = cursor;
    paintAt(ix, iy);
  }

  // Keyboard controls – attach once
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      if (
        ["w", "a", "s", "d", "arrowup", "arrowleft", "arrowdown", "arrowright", " "].includes(k)
      ) {
        e.preventDefault();
      }
      if (k === "w" || k === "arrowup") move(0, -1);
      else if (k === "s" || k === "arrowdown") move(0, 1);
      else if (k === "a" || k === "arrowleft") move(-1, 0);
      else if (k === "d" || k === "arrowright") move(1, 0);
      else if (k === "r") reset();
      else if (k === " ") paintAtCursor();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentional: attach once

  function reset() {
    setPlaced(new Set());
    setMoves(0);
    setSeconds(0);
    setPaused(false);
    setTrail(new Map());
    setCursor([level.target.x, level.target.y]);
    setLastAction(null);
  }

  // Format time nicely
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  };

  // Calculate performance indicators
  const movePerformance = moves <= level.par.moves ? 'excellent' : moves <= level.par.moves * 1.5 ? 'good' : 'needs-work';
  const timePerformance = seconds <= level.par.timeSec ? 'excellent' : seconds <= level.par.timeSec * 1.5 ? 'good' : 'needs-work';

  // ----- SVG primitives -----
  const gridLines = useMemo(() => {
    const lines: React.ReactNode[] = [];
    for (let x = 0; x <= cols; x++) {
      lines.push(
        <line
          key={`vx${x}`}
          x1={x * cell}
          y1={0}
          x2={x * cell}
          y2={H}
          stroke="#ffffff08"
          strokeWidth={1}
        />
      );
    }
    for (let y = 0; y <= rows; y++) {
      lines.push(
        <line
          key={`hz${y}`}
          x1={0}
          y1={y * cell}
          x2={W}
          y2={y * cell}
          stroke="#ffffff08"
          strokeWidth={1}
        />
      );
    }
    return lines;
  }, [cols, rows, cell, W, H]);

  const targetRect = (
    <rect
      x={level.target.x * cell}
      y={level.target.y * cell}
      width={level.target.w * cell}
      height={level.target.h * cell}
      fill="url(#targetGradient)"
      opacity={0.9}
      rx={2}
    />
  );

  const placedRects = [...placed].map((k) => {
    const [ix, iy] = k.split(",").map(Number);
    const isNewAction = lastAction?.cell === k;
    return (
      <rect
        key={`p-${k}`}
        x={ix * cell}
        y={iy * cell}
        width={cell}
        height={cell}
        fill="url(#paintGradient)"
        rx={1}
        className={isNewAction ? 'tile-animate' : ''}
      />
    );
  });

  // Trail shows fade-out path of where user has been
  const trailRects = [...trail.entries()]
    .filter(([k]) => !placed.has(k)) // Don't show trail on painted tiles
    .map(([k, timestamp]) => {
      const [ix, iy] = k.split(",").map(Number);
      const age = Date.now() - timestamp;
      const maxAge = 3000; // 3 seconds
      const opacity = Math.max(0, (maxAge - age) / maxAge) * 0.2; // Fade from 0.2 to 0
      
      return (
        <rect
          key={`t-${k}`}
          x={ix * cell + 1}
          y={iy * cell + 1}
          width={cell - 2}
          height={cell - 2}
          fill="#667eea"
          opacity={opacity}
          rx={1}
          pointerEvents="none"
          className="trail-fade"
        />
      );
    });

  const [cx, cy] = cursor;
  const cursorRect = (
    <g>
      <rect
        x={cx * cell}
        y={cy * cell}
        width={cell}
        height={cell}
        fill="none"
        stroke="url(#cursorGradient)"
        strokeWidth={3}
        rx={2}
        pointerEvents="none"
        className="cursor-pulse"
      />
      <rect
        x={cx * cell + 2}
        y={cy * cell + 2}
        width={cell - 4}
        height={cell - 4}
        fill="rgba(255, 235, 59, 0.15)"
        rx={1}
        pointerEvents="none"
        className="cursor-glow"
      />
    </g>
  );

  const pct = Math.round((covered / targetArea) * 100);

  return (
    <div className="game-container">
      <div className="game-header">
        <h2 className="level-title">{level.name}</h2>
        <div className="progress-ring">
          <div className="ring-background"></div>
          <div className="ring-progress" style={{ '--progress': pct } as React.CSSProperties}></div>
          <span className="progress-text">{pct}%</span>
        </div>
      </div>

      <div className="game-layout">
        {/* Game Board */}
        <div className="game-board">
          <div className="board-header">
            <button 
              className="help-toggle"
              onClick={() => setShowHelp(!showHelp)}
              title="Keyboard shortcuts"
            >
              ?
            </button>
          </div>
          <div className="svg-container">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="game-svg"
              aria-label="game-board"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <linearGradient id="targetGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#e8eaf6" />
                  <stop offset="100%" stopColor="#c5cae9" />
                </linearGradient>
                <linearGradient id="paintGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#667eea" />
                  <stop offset="100%" stopColor="#764ba2" />
                </linearGradient>
                <linearGradient id="cursorGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffeb3b" />
                  <stop offset="100%" stopColor="#ffc107" />
                </linearGradient>
              </defs>
              {targetRect}
              {trailRects}
              {placedRects}
              {cursorRect}
              {gridLines}
            </svg>
          </div>
        </div>

        {/* Control Panel */}
        <div className="control-panel">
          {/* Stats Card */}
          <div className="stats-card">
            <div className="stat-group">
              <div className="stat-item">
                <span className="stat-label">Moves</span>
                <span className={`stat-value ${movePerformance}`}>
                  {moves} <span className="stat-par">/ {level.par.moves}</span>
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Time</span>
                <span className={`stat-value ${timePerformance}`}>
                  {formatTime(seconds)} <span className="stat-par">/ {formatTime(level.par.timeSec)}</span>
                </span>
              </div>
            </div>
          </div>

          {/* D-Pad Controls */}
          <div className="controls-section">
            <div className="controls-header">Movement</div>
            <div className="dpad">
              <button 
                className="dpad-btn dpad-up" 
                onClick={() => move(0, -1)}
                onMouseDown={(e) => e.currentTarget.classList.add('pressed')}
                onMouseUp={(e) => e.currentTarget.classList.remove('pressed')}
                onMouseLeave={(e) => e.currentTarget.classList.remove('pressed')}
              >
                ▲
              </button>
              <button 
                className="dpad-btn dpad-left" 
                onClick={() => move(-1, 0)}
                onMouseDown={(e) => e.currentTarget.classList.add('pressed')}
                onMouseUp={(e) => e.currentTarget.classList.remove('pressed')}
                onMouseLeave={(e) => e.currentTarget.classList.remove('pressed')}
              >
                ◀
              </button>
              <button 
                className="dpad-btn dpad-right" 
                onClick={() => move(1, 0)}
                onMouseDown={(e) => e.currentTarget.classList.add('pressed')}
                onMouseUp={(e) => e.currentTarget.classList.remove('pressed')}
                onMouseLeave={(e) => e.currentTarget.classList.remove('pressed')}
              >
                ▶
              </button>
              <button 
                className="dpad-btn dpad-down" 
                onClick={() => move(0, 1)}
                onMouseDown={(e) => e.currentTarget.classList.add('pressed')}
                onMouseUp={(e) => e.currentTarget.classList.remove('pressed')}
                onMouseLeave={(e) => e.currentTarget.classList.remove('pressed')}
              >
                ▼
              </button>
              <div className="dpad-center"></div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="action-buttons">
            <button className="action-btn secondary" onClick={() => setPaused((p) => !p)}>
              {paused ? "Resume" : "Pause"}
            </button>
            <button className="action-btn secondary" onClick={reset}>
              Restart
            </button>
            <Link to="/geometry/levels" className="action-btn primary">
              Back to Levels
            </Link>
          </div>
        </div>
      </div>

      {/* Help Modal */}
      {showHelp && (
        <div className="help-overlay" onClick={() => setShowHelp(false)}>
          <div className="help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="help-header">
              <h3>Keyboard Shortcuts</h3>
              <button className="help-close" onClick={() => setShowHelp(false)}>×</button>
            </div>
            <div className="help-content">
              <div className="help-item">
                <span className="help-key">WASD / Arrow Keys</span>
                <span className="help-desc">Move and paint</span>
              </div>
              <div className="help-item">
                <span className="help-key">Space</span>
                <span className="help-desc">Paint current cell</span>
              </div>
              <div className="help-item">
                <span className="help-key">R</span>
                <span className="help-desc">Restart level</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Win Modal */}
      {win && (
        <div className="victory-overlay">
          <div className="victory-modal">
            <div className="victory-header">
              <h3>Level Complete!</h3>
            </div>
            <div className="victory-stats">
              <div className="victory-stat">
                <span className="victory-label">Final Time</span>
                <span className="victory-value">{formatTime(seconds)}</span>
              </div>
              <div className="victory-stat">
                <span className="victory-label">Total Moves</span>
                <span className="victory-value">{moves}</span>
              </div>
            </div>
            <Stars moves={moves} time={seconds} par={level.par} />
            <div className="victory-actions">
              <button className="victory-btn secondary" onClick={reset}>
                Play Again
              </button>
              <Link to="/geometry/levels" className="victory-btn primary">
                Level Select
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stars({
  moves,
  time,
  par,
}: {
  moves: number;
  time: number;
  par: { moves: number; timeSec: number };
}) {
  let stars = 1;
  if (moves <= par.moves) stars = 2;
  if (moves <= par.moves && time <= par.timeSec) stars = 3;
  
  return (
    <div className="stars-container">
      <div className="stars-display">
        {[0, 1, 2].map((i) => (
          <span 
            key={i} 
            className={`star ${i < stars ? 'filled' : 'empty'}`}
            style={{ animationDelay: `${i * 100}ms` }}
          >
            {i < stars ? "★" : "☆"}
          </span>
        ))}
      </div>
      <div className="stars-description">
        {stars === 3 && "Perfect! Amazing work!"}
        {stars === 2 && "Great job! Well done!"}
        {stars === 1 && "Good effort! Try for a better score!"}
      </div>
    </div>
  );
}