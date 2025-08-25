import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { saveLevelProgress } from "../progress";

type Cell = `${number},${number}`;
type TriangleRotation = 0 | 90 | 180 | 270;

// Triangle shape definitions for each rotation (relative to center)
const TRIANGLE_SHAPES = {
  0: [
    [0, -1],     // Top point
    [-1, 0], [0, 0], [1, 0]  // Bottom row
  ],
  90: [
    [1, 0],      // Right point  
    [0, -1], [0, 0], [0, 1]  // Left column
  ],
  180: [
    [0, 1],      // Bottom point
    [-1, 0], [0, 0], [1, 0]  // Top row
  ],
  270: [
    [-1, 0],     // Left point
    [0, -1], [0, 0], [0, 1]  // Right column
  ]
} as const;

// Level 2 - Paint a star pattern starting from the center
const LEVEL_2 = {
  id: 2,
  name: "Paint the Star",
  grid: { cols: 15, rows: 13, cell: 28 },
  startPosition: { x: 7, y: 6 }, // Center of grid
  startRotation: 0 as TriangleRotation,
  // Star pattern - 5-pointed star
  targetPattern: [
    // Center
    [7, 6],
    // Top spike
    [7, 5], [7, 4], [7, 3], [7, 2],
    // Top-right spike
    [8, 5], [9, 4], [10, 3], [11, 2],
    // Bottom-right spike  
    [8, 7], [9, 8], [10, 9], [11, 10],
    // Bottom-left spike
    [6, 7], [5, 8], [4, 9], [3, 10],
    // Top-left spike
    [6, 5], [5, 4], [4, 3], [3, 2],
    // Inner star connections
    [8, 6], [6, 6], // Horizontal
    [7, 7], [7, 5], // Vertical (already included but for clarity)
    // Star body points
    [8, 4], [9, 5], [9, 7], [8, 8], [6, 8], [5, 7], [5, 5], [6, 4]
  ] as [number, number][],
  par: { moves: 18, timeSec: 45 }
};

export default function Game2() {
  const { cols, rows, cell } = LEVEL_2.grid;
  const W = cols * cell;
  const H = rows * cell;

  // Game state
  const [trianglePos, setTrianglePos] = useState<[number, number]>(() => [
    LEVEL_2.startPosition.x,
    LEVEL_2.startPosition.y
  ]);
  const [triangleRotation, setTriangleRotation] = useState<TriangleRotation>(LEVEL_2.startRotation);
  const [painted, setPainted] = useState<Set<Cell>>(() => {
    // Start with center painted
    const startCell: Cell = `${LEVEL_2.startPosition.x},${LEVEL_2.startPosition.y}`;
    return new Set([startCell]);
  });
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Visual effects
  const [trail, setTrail] = useState<Map<Cell, number>>(new Map());
  const [lastAction, setLastAction] = useState<{ type: 'move' | 'rotate' } | null>(null);
  const [actionGlow, setActionGlow] = useState(false);

  // Calculate current triangle cells
  const currentTriangleCells = useMemo(() => {
    const [px, py] = trianglePos;
    const shape = TRIANGLE_SHAPES[triangleRotation];
    return shape.map(([dx, dy]) => `${px + dx},${py + dy}` as Cell);
  }, [trianglePos, triangleRotation]);

  // Target cells
  const targetSet = useMemo(() => {
    const s = new Set<Cell>();
    LEVEL_2.targetPattern.forEach(([x, y]) => s.add(`${x},${y}`));
    return s;
  }, []);

  // Check win condition
  const win = useMemo(() => {
    if (painted.size !== targetSet.size) return false;
    return [...painted].every(cell => targetSet.has(cell));
  }, [painted, targetSet]);

  // Timer
  useEffect(() => {
    if (paused || win) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [paused, win]);

  // Handle win detection and save progress
  useEffect(() => {
    if (win) {
      setPaused(true);
      let stars = 1;
      if (moves <= LEVEL_2.par.moves) stars = 2;
      if (moves <= LEVEL_2.par.moves && seconds <= LEVEL_2.par.timeSec) stars = 3;
      saveLevelProgress(2, moves, seconds, stars);
    }
  }, [win, moves, seconds]);

  // Check if triangle position is valid (within bounds)
  function isValidPosition(x: number, y: number, rotation: TriangleRotation) {
    const shape = TRIANGLE_SHAPES[rotation];
    return shape.every(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      return nx >= 0 && nx < cols && ny >= 0 && ny < rows;
    });
  }

  // Paint cells at current triangle position
  function paintCurrentPosition() {
    setPainted(prev => {
      const newPainted = new Set(prev);
      let newCellsPainted = 0;
      
      currentTriangleCells.forEach(cell => {
        if (!newPainted.has(cell)) {
          newPainted.add(cell);
          newCellsPainted++;
        }
      });
      
      // Only count as a move if new cells were painted
      if (newCellsPainted > 0) {
        setMoves(m => m + 1);
        setLastAction({ type: 'move' });
        setTimeout(() => setLastAction(null), 300);
      }
      
      return newPainted;
    });
  }

  // Move triangle and auto-paint
  function moveTriangle(dx: number, dy: number) {
    const [x, y] = trianglePos;
    const nx = x + dx;
    const ny = y + dy;
    
    if (isValidPosition(nx, ny, triangleRotation)) {
      setTrianglePos([nx, ny]);
      
      // Add to trail for visual effect
      setTrail(m => {
        const newTrail = new Map(m);
        currentTriangleCells.forEach(cell => {
          newTrail.set(cell, Date.now());
        });
        
        // Clean old trail
        const cutoff = Date.now() - 1500;
        for (const [key, timestamp] of newTrail.entries()) {
          if (timestamp < cutoff) {
            newTrail.delete(key);
          }
        }
        return newTrail;
      });
      
      // Auto-paint at new position after state update
      setTimeout(() => paintCurrentPosition(), 0);
    } else {
      // Invalid move - visual feedback
      setActionGlow(true);
      setTimeout(() => setActionGlow(false), 200);
    }
  }

  // Rotate triangle
  function rotateTriangle() {
    const newRotation = ((triangleRotation + 90) % 360) as TriangleRotation;
    const [x, y] = trianglePos;
    
    if (isValidPosition(x, y, newRotation)) {
      setTriangleRotation(newRotation);
      setMoves(m => m + 1);
      setLastAction({ type: 'rotate' });
      setTimeout(() => setLastAction(null), 300);
    } else {
      // Invalid rotation - visual feedback
      setActionGlow(true);
      setTimeout(() => setActionGlow(false), 200);
    }
  }



  // Keyboard controls
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (paused && !showHelp) return;
      
      const k = e.key.toLowerCase();
      if (
        ["w", "a", "s", "d", "arrowup", "arrowleft", "arrowdown", "arrowright", " ", "r"].includes(k)
      ) {
        e.preventDefault();
      }
      
      if (k === "w" || k === "arrowup") moveTriangle(0, -1);
      else if (k === "s" || k === "arrowdown") moveTriangle(0, 1);
      else if (k === "a" || k === "arrowleft") moveTriangle(-1, 0);
      else if (k === "d" || k === "arrowright") moveTriangle(1, 0);
      else if (k === " ") rotateTriangle();
      else if (k === "r") reset();
      else if (k === "escape") setShowHelp(false);
    }
    
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [trianglePos, triangleRotation, paused, showHelp, currentTriangleCells]);

  function reset() {
    setTrianglePos([LEVEL_2.startPosition.x, LEVEL_2.startPosition.y]);
    setTriangleRotation(LEVEL_2.startRotation);
    const startCell: Cell = `${LEVEL_2.startPosition.x},${LEVEL_2.startPosition.y}`;
    setPainted(new Set([startCell]));
    setMoves(0);
    setSeconds(0);
    setPaused(false);
    setTrail(new Map());
    setLastAction(null);
  }

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  };

  // Performance indicators
  const movePerformance = moves <= LEVEL_2.par.moves ? 'excellent' : moves <= LEVEL_2.par.moves * 1.5 ? 'good' : 'needs-work';
  const timePerformance = seconds <= LEVEL_2.par.timeSec ? 'excellent' : seconds <= LEVEL_2.par.timeSec * 1.5 ? 'good' : 'needs-work';

  // Calculate progress percentage
  const paintedInTarget = [...painted].filter(cell => targetSet.has(cell)).length;
  const pct = Math.round((paintedInTarget / targetSet.size) * 100);

  // SVG elements
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
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={0.5}
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
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={0.5}
        />
      );
    }
    return lines;
  }, [cols, rows, cell, W, H]);

  // Target pattern rendering
  const targetRects = LEVEL_2.targetPattern.map(([x, y], i) => (
    <rect
      key={`target-${i}`}
      x={x * cell}
      y={y * cell}
      width={cell}
      height={cell}
      fill="url(#targetGradient)"
      opacity={0.6}
      rx={2}
      className="target-area"
    />
  ));

  // Trail rendering
  const trailRects = [...trail.entries()]
    .filter(([k]) => !currentTriangleCells.includes(k))
    .map(([k, timestamp]) => {
      const [ix, iy] = k.split(",").map(Number);
      const age = Date.now() - timestamp;
      const maxAge = 1500;
      const opacity = Math.max(0, (maxAge - age) / maxAge) * 0.2;
      
      return (
        <rect
          key={`t-${k}`}
          x={ix * cell + 2}
          y={iy * cell + 2}
          width={cell - 4}
          height={cell - 4}
          fill="url(#trailGradient)"
          opacity={opacity}
          rx={2}
          pointerEvents="none"
          className="trail-tile"
        />
      );
    });

  // Painted cells rendering
  const paintedRects = [...painted].map((k) => {
    const [ix, iy] = k.split(",").map(Number);
    const isInTarget = targetSet.has(k);
    
    return (
      <rect
        key={`painted-${k}`}
        x={ix * cell + 1}
        y={iy * cell + 1}
        width={cell - 2}
        height={cell - 2}
        fill={isInTarget ? "url(#paintGradient)" : "url(#invalidPaintGradient)"}
        rx={2}
        className="painted-tile"
      />
    );
  });

  // Current triangle rendering
  const triangleRects = currentTriangleCells.map((k, i) => {
    const [ix, iy] = k.split(",").map(Number);
    
    return (
      <rect
        key={`triangle-${i}`}
        x={ix * cell + 1}
        y={iy * cell + 1}
        width={cell - 2}
        height={cell - 2}
        fill="url(#triangleGradient)"
        stroke="url(#triangleBorderGradient)"
        strokeWidth={2}
        rx={2}
        className={`triangle-tile ${lastAction ? 'triangle-animate' : ''} ${actionGlow ? 'triangle-error' : ''}`}
      />
    );
  });

  return (
    <div className="game-container">
      <div className="game-header">
        <div className="level-info">
          <h1 className="level-title">{LEVEL_2.name}</h1>
          <div className="level-subtitle">Move and rotate to paint the entire star pattern</div>
        </div>
        <div className="progress-display">
          <div className="progress-ring">
            <svg width="80" height="80" className="progress-svg">
              <circle
                cx="40"
                cy="40"
                r="36"
                fill="none"
                stroke="rgba(59, 130, 246, 0.1)"
                strokeWidth="3"
              />
              <circle
                cx="40"
                cy="40"
                r="36"
                fill="none"
                stroke="url(#progressGradient)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 36}`}
                strokeDashoffset={`${2 * Math.PI * 36 * (1 - pct / 100)}`}
                transform="rotate(-90 40 40)"
                className="progress-circle"
              />
            </svg>
            <div className="progress-text">
              <span className="progress-number">{pct}</span>
              <span className="progress-percent">%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="game-layout">
        <div className="game-board">
          <div className="board-actions">
            <button 
              className="help-btn"
              onClick={() => setShowHelp(!showHelp)}
              title="Keyboard shortcuts"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
              </svg>
              Help
            </button>
          </div>
          
          <div className="board-container">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="game-svg"
              aria-label="game-board"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <linearGradient id="targetGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fef3c7" />
                  <stop offset="100%" stopColor="#fcd34d" />
                </linearGradient>
                <linearGradient id="paintGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="50%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#1d4ed8" />
                </linearGradient>
                <linearGradient id="invalidPaintGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="50%" stopColor="#dc2626" />
                  <stop offset="100%" stopColor="#b91c1c" />
                </linearGradient>
                <linearGradient id="triangleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="50%" stopColor="#d97706" />
                  <stop offset="100%" stopColor="#b45309" />
                </linearGradient>
                <linearGradient id="triangleBorderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
                <linearGradient id="trailGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
              </defs>
              {gridLines}
              {targetRects}
              {trailRects}
              {paintedRects}
              {triangleRects}
            </svg>
          </div>
        </div>

        <div className="control-panel">
          {/* Stats */}
          <div className="stats-section">
            <div className="stat-card">
              <div className="stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              <div className="stat-content">
                <div className="stat-label">Moves</div>
                <div className={`stat-value ${movePerformance}`}>
                  <span className="stat-number">{moves}</span>
                  <span className="stat-par">/{LEVEL_2.par.moves}</span>
                </div>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z"/>
                </svg>
              </div>
              <div className="stat-content">
                <div className="stat-label">Time</div>
                <div className={`stat-value ${timePerformance}`}>
                  <span className="stat-number">{formatTime(seconds)}</span>
                  <span className="stat-par">/{formatTime(LEVEL_2.par.timeSec)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="controls-section">
            <div className="controls-header">
              <h3>Controls</h3>
              <div className="controls-hint">Move to paint, space to rotate</div>
            </div>
            
            <div className="movement-controls">
              <div className="direction-grid">
                <button 
                  className="direction-btn direction-up" 
                  onClick={() => moveTriangle(0, -1)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
                  </svg>
                </button>
                <button 
                  className="direction-btn direction-left" 
                  onClick={() => moveTriangle(-1, 0)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z"/>
                  </svg>
                </button>
                <button 
                  className="direction-btn direction-center triangle-rotate-btn" 
                  onClick={rotateTriangle}
                  title="Rotate triangle"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8c-.45-.83-.7-1.79-.7-2.8 0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z"/>
                  </svg>
                </button>
                <button 
                  className="direction-btn direction-right" 
                  onClick={() => moveTriangle(1, 0)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
                  </svg>
                </button>
                <button 
                  className="direction-btn direction-down" 
                  onClick={() => moveTriangle(0, 1)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="action-section">
            <button 
              className="action-btn secondary" 
              onClick={() => setPaused((p) => !p)}
              disabled={win}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                {paused ? (
                  <path d="M8 5v14l11-7z"/>
                ) : (
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                )}
              </svg>
              {paused ? "Resume" : "Pause"}
            </button>
            
            <button className="action-btn secondary" onClick={reset}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8c-.45-.83-.7-1.79-.7-2.8 0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z"/>
              </svg>
              Restart
            </button>
            
            <Link to="/geometry/levels" className="action-btn primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
              </svg>
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
                <div className="help-keys">
                  <kbd>WASD</kbd> or <kbd>Arrow Keys</kbd>
                </div>
                <span className="help-desc">Move triangle and paint automatically</span>
              </div>
              <div className="help-item">
                <div className="help-keys">
                  <kbd>Space</kbd>
                </div>
                <span className="help-desc">Rotate triangle</span>
              </div>
              <div className="help-item">
                <div className="help-keys">
                  <kbd>R</kbd>
                </div>
                <span className="help-desc">Restart level</span>
              </div>
              <div className="help-item">
                <div className="help-keys">
                  <kbd>Esc</kbd>
                </div>
                <span className="help-desc">Close this help</span>
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
            <Stars moves={moves} time={seconds} par={LEVEL_2.par} />
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
            style={{ animationDelay: `${i * 150}ms` }}
          >
            {i < stars ? "★" : "☆"}
          </span>
        ))}
      </div>
      <div className="stars-description">
        {stars === 3 && "Perfect! Amazing work!"}
        {stars === 2 && "Well done! Good job!"}
        {stars === 1 && "Level complete! Try for a better score!"}
      </div>
    </div>
  );
}