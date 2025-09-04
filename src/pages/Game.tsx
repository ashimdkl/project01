import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import './CanvasStyling.css';

interface Point { x: number; y: number; }
interface Triangle { vertices: [Point, Point, Point]; angles: [number, number, number]; }

interface DragState {
  isDragging: boolean;
  dragIndex: number | null;
  startPoint: Point | null;
  offset: Point;
}
interface PanState {
  isPanning: boolean;
  startPoint: Point | null;
  startVertices: [Point, Point, Point] | null;
}
interface AnimationState {
  isActive: boolean;
  progress: number;
  hasStarted: boolean;
  hasCompleted: boolean;
}
interface ReflectionState {
  isReflecting: boolean;
  activeEdge: number | null; // 0 = AB, 1 = BC, 2 = CA
  progress: number;
  fromVertices: [Point, Point, Point] | null;
  toVertices: [Point, Point, Point] | null;
}
type Tool = 'drag' | 'reflect' | 'pan';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const VERTEX_RADIUS = 12;
const ANGLE_ARC_RADIUS = 35;

/* -------- helpers (unchanged) -------- */
const getAngleColor = (angle: number): { fill: string; stroke: string; pattern: string } => {
  const a = Math.round(angle);
  if (a <= 35)  return { fill: '#FEF3C7', stroke: '#F59E0B', pattern: 'dots' };
  if (a <= 65)  return { fill: '#FED7AA', stroke: '#EA580C', pattern: 'lines' };
  if (a <= 95)  return { fill: '#FECACA', stroke: '#DC2626', pattern: 'solid' };
  if (a <= 125) return { fill: '#DDD6FE', stroke: '#7C3AED', pattern: 'crosshatch' };
  if (a <= 155) return { fill: '#BFDBFE', stroke: '#2563EB', pattern: 'waves' };
  return { fill: '#BBF7D0', stroke: '#059669', pattern: 'grid' };
};

const calculateAngle = (center: Point, p1: Point, p2: Point): number => {
  const a1 = Math.atan2(p1.y - center.y, p1.x - center.x);
  const a2 = Math.atan2(p2.y - center.y, p2.x - center.x);
  let ang = Math.abs(a2 - a1);
  if (ang > Math.PI) ang = 2 * Math.PI - ang;
  return (ang * 180) / Math.PI;
};

const calculateTriangleAngles = (v: [Point, Point, Point]): [number, number, number] => {
  const [A, B, C] = v;
  return [calculateAngle(A, B, C), calculateAngle(B, A, C), calculateAngle(C, A, B)];
};

const constrainTriangle = (vertices: [Point, Point, Point], dragIndex: number, newPos: Point): [Point, Point, Point] => {
  const nv: [Point, Point, Point] = [...vertices];
  nv[dragIndex] = newPos;
  const minD = 40;
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 3; j++) {
      const dx = nv[i].x - nv[j].x, dy = nv[i].y - nv[j].y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < minD) {
        const a = Math.atan2(dy, dx), push = (minD - d)/2;
        nv[i].x += Math.cos(a)*push; nv[i].y += Math.sin(a)*push;
        nv[j].x -= Math.cos(a)*push; nv[j].y -= Math.sin(a)*push;
      }
    }
  }
  return nv;
};

const constrainTriangleToCanvas = (vertices: [Point, Point, Point]): [Point, Point, Point] => {
  const nv: [Point, Point, Point] = vertices.map(v => ({
    x: Math.max(VERTEX_RADIUS, Math.min(CANVAS_WIDTH - VERTEX_RADIUS, v.x)),
    y: Math.max(VERTEX_RADIUS, Math.min(CANVAS_HEIGHT - VERTEX_RADIUS, v.y))
  })) as [Point, Point, Point];
  return nv;
};

const lerp = (s: number, e: number, t: number) => s + (e - s) * t;
const lerpPoint = (s: Point, e: Point, t: number): Point => ({ x: lerp(s.x, e.x, t), y: lerp(s.y, e.y, t) });

/* reflection */
const reflectPointAcrossLine = (p: Point, a: Point, b: Point): Point => {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx*dx + dy*dy) || 1;
  const A = -dy/len, B = dx/len, C = (dy*a.x - dx*a.y)/len;
  const dist = A*p.x + B*p.y + C;
  return { x: p.x - 2*A*dist, y: p.y - 2*B*dist };
};
const getEdgeReflection = (v: [Point, Point, Point], edgeIndex: number): [Point, Point, Point] => {
  const p0 = v[edgeIndex], p1 = v[(edgeIndex+1)%3], opposite = (edgeIndex+2)%3;
  const out: [Point, Point, Point] = [...v];
  out[opposite] = reflectPointAcrossLine(v[opposite], p0, p1);
  return out;
};

/* point in triangle check */
const pointInTriangle = (p: Point, v0: Point, v1: Point, v2: Point): boolean => {
  const area = 0.5 * (-v1.y * v2.x + v0.y * (-v1.x + v2.x) + v0.x * (v1.y - v2.y) + v1.x * v2.y);
  const s = (v0.y * v2.x - v0.x * v2.y + (v2.y - v0.y) * p.x + (v0.x - v2.x) * p.y) / (2 * area);
  const t = (v0.x * v1.y - v0.y * v1.x + (v0.y - v1.y) * p.x + (v1.x - v0.x) * p.y) / (2 * area);
  return s > 0 && t > 0 && 1 - s - t > 0;
};

/* -------- component -------- */
export default function Game() {
  const svgRef = useRef<SVGSVGElement>(null);

  const startTriangle: [Point, Point, Point] = [{ x: 400, y: 200 }, { x: 300, y: 400 }, { x: 500, y: 400 }];
  const endTriangle:   [Point, Point, Point] = [{ x: 400, y: 300 }, { x: 200, y: 300 }, { x: 600, y: 300 }];

  const [triangle, setTriangle] = useState<Triangle>({ vertices: startTriangle, angles: [60, 60, 60] });
  const [dragState, setDragState] = useState<DragState>({ isDragging: false, dragIndex: null, startPoint: null, offset: { x: 0, y: 0 } });
  const [panState, setPanState] = useState<PanState>({ isPanning: false, startPoint: null, startVertices: null });
  const [hoveredVertex, setHoveredVertex] = useState<number | null>(null);
  const [hoveredEdge, setHoveredEdge]     = useState<number | null>(null);
  const [activeTool, setActiveTool]       = useState<Tool>('drag');

  const [reflectionState, setReflectionState] = useState<ReflectionState>({
    isReflecting: false, activeEdge: null, progress: 0, fromVertices: null, toVertices: null
  });

  const [animationState, setAnimationState] = useState<AnimationState>({
    isActive: false, progress: 0, hasStarted: false, hasCompleted: false
  });

  const currentAngles = useMemo(() => calculateTriangleAngles(triangle.vertices), [triangle.vertices]);

  /* intro animation */
  useEffect(() => {
    const t = setTimeout(() => setAnimationState(p => ({ ...p, isActive: true, hasStarted: true })), 1000);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!animationState.isActive) return;
    const id = setInterval(() => {
      setAnimationState(prev => {
        const prog = prev.progress + 0.005;
        if (prog >= 1) {
          setTimeout(() => setAnimationState(c => ({ ...c, isActive: false, hasCompleted: true })), 2000);
          return { ...prev, progress: 1 };
        }
        return { ...prev, progress: prog };
      });
    }, 16);
    return () => clearInterval(id);
  }, [animationState.isActive]);
  useEffect(() => {
    if (animationState.hasStarted && animationState.isActive && !dragState.isDragging && !panState.isPanning) {
      const p = animationState.progress;
      const v: [Point, Point, Point] = [
        lerpPoint(startTriangle[0], endTriangle[0], p),
        lerpPoint(startTriangle[1], endTriangle[1], p),
        lerpPoint(startTriangle[2], endTriangle[2], p),
      ];
      setTriangle({ vertices: v, angles: calculateTriangleAngles(v) });
    }
  }, [animationState.progress, animationState.hasStarted, animationState.isActive, dragState.isDragging, panState.isPanning]);

  /* reflection animation */
  useEffect(() => {
    if (!reflectionState.isReflecting) return;
    const id = setInterval(() => {
      setReflectionState(prev => {
        const np = prev.progress + 0.08;
        if (np >= 1) {
          if (prev.toVertices) setTriangle({ vertices: prev.toVertices, angles: calculateTriangleAngles(prev.toVertices) });
          return { isReflecting: false, activeEdge: null, progress: 0, fromVertices: null, toVertices: null };
        }
        return { ...prev, progress: np };
      });
    }, 16);
    return () => clearInterval(id);
  }, [reflectionState.isReflecting]);

  useEffect(() => {
    if (
      reflectionState.isReflecting &&
      reflectionState.fromVertices && reflectionState.toVertices &&
      reflectionState.activeEdge !== null
    ) {
      const p = reflectionState.progress;
      const flipIndex = (reflectionState.activeEdge + 2) % 3;
      const scaleX = Math.cos(p * Math.PI);
      const v: [Point, Point, Point] = reflectionState.fromVertices.map((fv, idx) => {
        if (idx === flipIndex) {
          const tv = reflectionState.toVertices![idx];
          return lerpPoint(fv, tv, Math.abs(scaleX));
        }
        return fv;
      }) as [Point, Point, Point];
      setTriangle({ vertices: v, angles: calculateTriangleAngles(v) });
    }
  }, [reflectionState.progress, reflectionState.fromVertices, reflectionState.toVertices, reflectionState.activeEdge, reflectionState.isReflecting]);

  const handleEdgeClick = useCallback((edgeIndex: number) => {
    if (activeTool !== 'reflect' || reflectionState.isReflecting) return;
    if (!animationState.hasCompleted) return;
    const current = triangle.vertices;
    const reflected = getEdgeReflection(current, edgeIndex);
    setReflectionState({ isReflecting: true, activeEdge: edgeIndex, progress: 0, fromVertices: current, toVertices: reflected });
  }, [activeTool, reflectionState.isReflecting, triangle.vertices, animationState.hasCompleted]);

  /* drag events */
  const handlePointerDown = useCallback((e: React.PointerEvent, index?: number) => {
    if (animationState.isActive || !animationState.hasCompleted || reflectionState.isReflecting) return;
    e.preventDefault();
    const svg = svgRef.current; if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    if (activeTool === 'drag' && index !== undefined) {
      const vtx = triangle.vertices[index];
      setDragState({ isDragging: true, dragIndex: index, startPoint: pt, offset: { x: pt.x - vtx.x, y: pt.y - vtx.y } });
      svg.setPointerCapture(e.pointerId);
    } else if (activeTool === 'pan') {
      // Check if click is on triangle (vertex, edge, or inside)
      const isOnVertex = triangle.vertices.some(v => {
        const dx = pt.x - v.x, dy = pt.y - v.y;
        return Math.sqrt(dx*dx + dy*dy) <= VERTEX_RADIUS + 10;
      });
      
      const isInsideTriangle = pointInTriangle(pt, triangle.vertices[0], triangle.vertices[1], triangle.vertices[2]);
      
      if (isOnVertex || isInsideTriangle) {
        setPanState({ isPanning: true, startPoint: pt, startVertices: [...triangle.vertices] as [Point, Point, Point] });
        svg.setPointerCapture(e.pointerId);
      }
    }
  }, [triangle.vertices, animationState.isActive, animationState.hasCompleted, reflectionState.isReflecting, activeTool]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (animationState.isActive || reflectionState.isReflecting) return;
    const svg = svgRef.current; if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    if (activeTool === 'drag' && dragState.isDragging && dragState.dragIndex !== null) {
      const p = { x: pt.x - dragState.offset.x, y: pt.y - dragState.offset.y };
      const bounded = { x: Math.max(VERTEX_RADIUS, Math.min(CANVAS_WIDTH - VERTEX_RADIUS, p.x)), y: Math.max(VERTEX_RADIUS, Math.min(CANVAS_HEIGHT - VERTEX_RADIUS, p.y)) };
      const v = constrainTriangle(triangle.vertices, dragState.dragIndex, bounded);
      setTriangle({ vertices: v, angles: calculateTriangleAngles(v) });
    } else if (activeTool === 'pan' && panState.isPanning && panState.startPoint && panState.startVertices) {
      const dx = pt.x - panState.startPoint.x;
      const dy = pt.y - panState.startPoint.y;
      const newVertices: [Point, Point, Point] = panState.startVertices.map(v => ({
        x: v.x + dx,
        y: v.y + dy
      })) as [Point, Point, Point];
      const constrainedVertices = constrainTriangleToCanvas(newVertices);
      setTriangle({ vertices: constrainedVertices, angles: calculateTriangleAngles(constrainedVertices) });
    }
  }, [dragState, panState, triangle.vertices, animationState.isActive, reflectionState.isReflecting, activeTool]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const svg = svgRef.current; 
    if (svg) svg.releasePointerCapture(e.pointerId);
    
    if (dragState.isDragging) {
      setDragState({ isDragging: false, dragIndex: null, startPoint: null, offset: { x: 0, y: 0 } });
    }
    if (panState.isPanning) {
      setPanState({ isPanning: false, startPoint: null, startVertices: null });
    }
  }, [dragState.isDragging, panState.isPanning]);

  const trianglePath = `M ${triangle.vertices[0].x},${triangle.vertices[0].y} L ${triangle.vertices[1].x},${triangle.vertices[1].y} L ${triangle.vertices[2].x},${triangle.vertices[2].y} Z`;

  /* patterns/filters */
  const renderPatterns = () => (
    <defs>
      <pattern id="dots" patternUnits="userSpaceOnUse" width="8" height="8"><circle cx="4" cy="4" r="1" fill="#F59E0B" opacity="0.3"/></pattern>
      <pattern id="lines" patternUnits="userSpaceOnUse" width="6" height="6"><path d="M0,3 L6,3" stroke="#EA580C" strokeWidth="1" opacity="0.3"/></pattern>
      <pattern id="solid" patternUnits="userSpaceOnUse" width="4" height="4"><rect width="4" height="4" fill="#DC2626" opacity="0.3"/></pattern>
      <pattern id="crosshatch" patternUnits="userSpaceOnUse" width="8" height="8"><path d="M0,0 L8,8 M0,8 L8,0" stroke="#7C3AED" strokeWidth="0.5" opacity="0.3"/></pattern>
      <pattern id="waves" patternUnits="userSpaceOnUse" width="12" height="6"><path d="M0,3 Q3,0 6,3 T12,3" fill="none" stroke="#2563EB" strokeWidth="1" opacity="0.3"/></pattern>
      <pattern id="grid" patternUnits="userSpaceOnUse" width="10" height="10"><path d="M0,0 L10,0 M0,0 L0,10" stroke="#059669" strokeWidth="0.5" opacity="0.3"/></pattern>
      <filter id="glow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="shadow"><feDropShadow dx="1" dy="1" stdDeviation="2" floodOpacity="0.2"/></filter>
    </defs>
  );

  const renderAngleArcs = () => triangle.vertices.map((v, i) => {
    const angle = currentAngles[i];
    if (angle < 2) return null;
    const color = getAngleColor(angle);
    const ni = (i + 1) % 3, pi = (i + 2) % 3;
    const toN = { x: triangle.vertices[ni].x - v.x, y: triangle.vertices[ni].y - v.y };
    const toP = { x: triangle.vertices[pi].x - v.x, y: triangle.vertices[pi].y - v.y };
    const aN = Math.atan2(toN.y, toN.x), aP = Math.atan2(toP.y, toP.x);
    const r = Math.min(ANGLE_ARC_RADIUS,
      Math.min(Math.sqrt(toN.x**2 + toN.y**2) * 0.35, Math.sqrt(toP.x**2 + toP.y**2) * 0.35)
    );
    let start = aP, end = aN;
    while (end - start > Math.PI) start += 2*Math.PI;
    while (start - end > Math.PI) end += 2*Math.PI;
    const sweep = Math.abs(end - start);
    const large = sweep > Math.PI ? 1 : 0;
    const sweepFlag = end > start ? 1 : 0;
    const sx = v.x + Math.cos(start) * r, sy = v.y + Math.sin(start) * r;
    const ex = v.x + Math.cos(end) * r,   ey = v.y + Math.sin(end) * r;
    const d = `M ${v.x},${v.y} L ${sx},${sy} A ${r},${r} 0 ${large},${sweepFlag} ${ex},${ey} Z`;

    const cx = (triangle.vertices[0].x + triangle.vertices[1].x + triangle.vertices[2].x) / 3;
    const cy = (triangle.vertices[0].y + triangle.vertices[1].y + triangle.vertices[2].y) / 3;
    const labAng = Math.atan2(cy - v.y, cx - v.x);
    const lr = r * 0.7, lx = v.x + Math.cos(labAng)*lr, ly = v.y + Math.sin(labAng)*lr;

    return (
      <g key={`arc-${i}`}>
        <path d={d} fill={color.fill} stroke={color.stroke} strokeWidth="1.5" opacity="0.7" />
        <path d={d} fill={`url(#${color.pattern})`} opacity="0.4" />
        <text x={lx} y={ly} fontSize="12" fontWeight="600" fill={color.stroke}>{Math.round(angle)}°</text>
      </g>
    );
  });

  const renderTriangleEdges = () => triangle.vertices.map((v, i) => {
    const j = (i + 1) % 3, v2 = triangle.vertices[j];
    const isReflection = reflectionState.isReflecting && reflectionState.activeEdge === i;
    const isHover = activeTool === 'reflect' && hoveredEdge === i && !reflectionState.isReflecting;
    return (
      <line
        key={`edge-${i}`}
        x1={v.x} y1={v.y} x2={v2.x} y2={v2.y}
        stroke={isReflection ? '#EF4444' : isHover ? '#3B82F6' : '#334155'}
        strokeWidth={isReflection ? 4 : isHover ? 4 : 2.5}
        strokeDasharray={isReflection ? '8,4' : 'none'}
        opacity={isReflection ? 0.85 : 1}
        filter="url(#shadow)"
        style={{ cursor: activeTool === 'reflect' ? 'pointer' : activeTool === 'pan' ? 'grab' : 'default', transition: 'all 0.15s ease' }}
        onClick={() => handleEdgeClick(i)}
        onPointerEnter={() => activeTool === 'reflect' && setHoveredEdge(i)}
        onPointerLeave={() => setHoveredEdge(null)}
      />
    );
  });

  const renderVertices = () => triangle.vertices.map((v, i) => {
    const isHovered = hoveredVertex === i && animationState.hasCompleted && (activeTool === 'drag' || activeTool === 'pan');
    const isDragging = dragState.isDragging && dragState.dragIndex === i;
    const isPanning = panState.isPanning;
    const scale = isDragging ? 1.3 : isPanning ? 1.1 : isHovered ? 1.1 : 1;
    
    const canInteract = animationState.hasCompleted && !animationState.isActive && !reflectionState.isReflecting;
    const canDrag = canInteract && activeTool === 'drag';
    const canPan = canInteract && activeTool === 'pan';
    
    let cursor = 'default';
    if (canDrag) cursor = dragState.isDragging ? 'grabbing' : 'grab';
    else if (canPan) cursor = panState.isPanning ? 'grabbing' : 'grab';

    return (
      <g key={`v-${i}`}>
        <circle
          cx={v.x} cy={v.y} r={VERTEX_RADIUS} fill="white" stroke="#3B82F6" strokeWidth="2.5" filter="url(#shadow)"
          style={{ 
            cursor, 
            transform: `scale(${scale})`, 
            transformOrigin: `${v.x}px ${v.y}px`, 
            transition: (dragState.isDragging || panState.isPanning) ? 'none' : 'transform 0.1s ease', 
            opacity: canInteract ? 1 : 0.8 
          }}
          onPointerDown={canDrag ? (e) => handlePointerDown(e, i) : canPan ? (e) => handlePointerDown(e) : undefined}
          onPointerEnter={canInteract ? () => setHoveredVertex(i) : undefined}
          onPointerLeave={canInteract ? () => setHoveredVertex(null) : undefined}
        />
        <text x={v.x} y={v.y} fontSize="9" fontWeight="700" fill="#3B82F6" pointerEvents="none">{String.fromCharCode(65 + i)}</text>
      </g>
    );
  });

  const getDescriptiveText = () => {
    if (!animationState.hasStarted) {
      return 'Triangle angles always add to 180°. Watch this demonstration...';
    } else if (animationState.isActive) {
      return `Morphing triangle... ${Math.round(animationState.progress * 100)}% to straight line`;
    } else if (activeTool === 'reflect') {
      return 'Reflect mode: click an edge (AB, BC, or CA) to flip.';
    } else if (activeTool === 'pan') {
      return 'Pan mode: click and drag triangle to move it around.';
    } else {
      return 'Now drag any vertex to explore different triangles!';
    }
  };

  return (
    <div className="game-container">
      {/* ---------- HEADER (now includes tools) ---------- */}
      <div className="game-header">
        {/* left: title */}
        <div className="tool-info">
          <div className="tool-icon">△</div>
          <div>
            <h1>Triangle Angle Explorer</h1>
            <p>{getDescriptiveText()}</p>
          </div>
        </div>

        {/* right: tools + edge chips + totals */}
        <div className="header-right">
          <div className="toolbar">
            <button
              className={`tool-btn ${activeTool === 'drag' ? 'tool-btn--active' : ''}`}
              onClick={() => setActiveTool('drag')}
              title="Vertex Drag: Drag triangle vertices"
            >⚬</button>

            <button
              className={`tool-btn ${activeTool === 'reflect' ? 'tool-btn--active' : ''}`}
              onClick={() => setActiveTool('reflect')}
              title="Edge Reflect: Click triangle edges to reflect"
            >⟲</button>

            <button
              className={`tool-btn ${activeTool === 'pan' ? 'tool-btn--active' : ''}`}
              onClick={() => setActiveTool('pan')}
              title="Pan: Move entire triangle around"
            >✋</button>

            {activeTool === 'reflect' && (
              <div className="edge-chips">
                <div className="edge-chip angle-value"><span className="angle-label" style={{margin:0}}>Edge AB</span><div className="chip-bar" style={{background:'#60a5fa'}}/></div>
                <div className="edge-chip angle-value" style={{background:'#FFF7ED',borderColor:'#FED7AA'}}><span className="angle-label" style={{margin:0}}>Edge BC</span><div className="chip-bar" style={{background:'#fb923c'}}/></div>
                <div className="edge-chip angle-value" style={{background:'#ECFDF5',borderColor:'#BBF7D0'}}><span className="angle-label" style={{margin:0}}>Edge CA</span><div className="chip-bar" style={{background:'#34d399'}}/></div>
              </div>
            )}
          </div>

          <div className="angle-summary">
            <div className="angle-total">
              Total: {Math.round(currentAngles.reduce((s, a) => s + a, 0))}°
            </div>
            <div className="angle-values">
              {currentAngles.map((a, i) => (
                <div key={i} className="angle-value">
                  <span className="angle-label">{String.fromCharCode(65 + i)}:</span>
                  <span className="angle-number">{Math.round(a)}°</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ---------- CANVAS ---------- */}
      <div className="canvas-container">
        <svg
          ref={svgRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
          className="geometry-canvas"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerDown={activeTool === 'pan' ? handlePointerDown : undefined}
          style={{ 
            touchAction: 'none',
            cursor: activeTool === 'pan' && !panState.isPanning ? 'grab' : activeTool === 'pan' && panState.isPanning ? 'grabbing' : 'default'
          }}
        >
          {renderPatterns()}
          <defs>
            <pattern id="grid-bg" width="20" height="20" patternUnits="userSpaceOnUse">
              <rect width="20" height="20" fill="#ffffff"/>
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f1f5f9" strokeWidth="0.5" opacity="0.8"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="#ffffff"/>
          <rect width="100%" height="100%" fill="url(#grid-bg)"/>

          <path d={trianglePath} fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3,3" opacity="0.4" />
          {renderAngleArcs()}
          {renderTriangleEdges()}
          {renderVertices()}

          {reflectionState.isReflecting && reflectionState.activeEdge !== null && (
            <text
              x={(triangle.vertices[reflectionState.activeEdge].x + triangle.vertices[(reflectionState.activeEdge + 1) % 3].x) / 2}
              y={(triangle.vertices[reflectionState.activeEdge].y + triangle.vertices[(reflectionState.activeEdge + 1) % 3].y) / 2 - 15}
              textAnchor="middle" fontSize="11" fontWeight="600" fill="#EF4444"
            >
              Reflection Line
            </text>
          )}

          {dragState.isDragging && animationState.hasCompleted && activeTool === 'drag' && (
            <circle
              cx={triangle.vertices[dragState.dragIndex!].x}
              cy={triangle.vertices[dragState.dragIndex!].y}
              r={VERTEX_RADIUS * 1.8}
              fill="none" stroke="#3B82F6" strokeWidth="1" opacity="0.3" className="drag-indicator"
            />
          )}

          {panState.isPanning && activeTool === 'pan' && (
            <g>
              <path d={trianglePath} fill="none" stroke="#10B981" strokeWidth="3" strokeDasharray="6,3" opacity="0.6" className="drag-indicator" />
              <text
                x={(triangle.vertices[0].x + triangle.vertices[1].x + triangle.vertices[2].x) / 3}
                y={(triangle.vertices[0].y + triangle.vertices[1].y + triangle.vertices[2].y) / 3 - 20}
                textAnchor="middle" fontSize="11" fontWeight="600" fill="#10B981"
              >
                Moving Triangle
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}