import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import './CanvasStyling.css';

interface Point {
  x: number;
  y: number;
}

interface Triangle {
  vertices: [Point, Point, Point];
  angles: [number, number, number];
}

interface DragState {
  isDragging: boolean;
  dragIndex: number | null;
  startPoint: Point | null;
  offset: Point;
}

interface AnimationState {
  isActive: boolean;
  progress: number; // 0 to 1
  hasStarted: boolean;
  hasCompleted: boolean;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const VERTEX_RADIUS = 12;
const ANGLE_ARC_RADIUS = 35;

// Color mapping based on angle ranges
const getAngleColor = (angle: number): { fill: string; stroke: string; pattern: string } => {
  const normalizedAngle = Math.round(angle);
  
  if (normalizedAngle <= 35) return { 
    fill: '#FEF3C7', 
    stroke: '#F59E0B', 
    pattern: 'dots' 
  }; // Yellow - acute
  if (normalizedAngle <= 65) return { 
    fill: '#FED7AA', 
    stroke: '#EA580C', 
    pattern: 'lines' 
  }; // Orange
  if (normalizedAngle <= 95) return { 
    fill: '#FECACA', 
    stroke: '#DC2626', 
    pattern: 'solid' 
  }; // Red - right angle
  if (normalizedAngle <= 125) return { 
    fill: '#DDD6FE', 
    stroke: '#7C3AED', 
    pattern: 'crosshatch' 
  }; // Purple
  if (normalizedAngle <= 155) return { 
    fill: '#BFDBFE', 
    stroke: '#2563EB', 
    pattern: 'waves' 
  }; // Blue
  return { 
    fill: '#BBF7D0', 
    stroke: '#059669', 
    pattern: 'grid' 
  }; // Green - obtuse
};

// Calculate angle between three points
const calculateAngle = (center: Point, point1: Point, point2: Point): number => {
  const angle1 = Math.atan2(point1.y - center.y, point1.x - center.x);
  const angle2 = Math.atan2(point2.y - center.y, point2.x - center.x);
  let angle = Math.abs(angle2 - angle1);
  if (angle > Math.PI) angle = 2 * Math.PI - angle;
  return (angle * 180) / Math.PI;
};

// Calculate all triangle angles
const calculateTriangleAngles = (vertices: [Point, Point, Point]): [number, number, number] => {
  const [A, B, C] = vertices;
  
  const angleA = calculateAngle(A, B, C);
  const angleB = calculateAngle(B, A, C);
  const angleC = calculateAngle(C, A, B);
  
  return [angleA, angleB, angleC];
};

// Constraint logic - adjust triangle to maintain valid shape
const constrainTriangle = (
  vertices: [Point, Point, Point], 
  dragIndex: number, 
  newPosition: Point
): [Point, Point, Point] => {
  const newVertices: [Point, Point, Point] = [...vertices];
  newVertices[dragIndex] = newPosition;
  
  // Keep triangle valid by ensuring no vertices are too close
  const minDistance = 40;
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 3; j++) {
      const dx = newVertices[i].x - newVertices[j].x;
      const dy = newVertices[i].y - newVertices[j].y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < minDistance) {
        // Push vertices apart
        const angle = Math.atan2(dy, dx);
        const pushDistance = (minDistance - distance) / 2;
        newVertices[i].x += Math.cos(angle) * pushDistance;
        newVertices[i].y += Math.sin(angle) * pushDistance;
        newVertices[j].x -= Math.cos(angle) * pushDistance;
        newVertices[j].y -= Math.sin(angle) * pushDistance;
      }
    }
  }
  
  return newVertices;
};

// Linear interpolation function
const lerp = (start: number, end: number, progress: number): number => {
  return start + (end - start) * progress;
};

// Interpolate between two points
const lerpPoint = (start: Point, end: Point, progress: number): Point => {
  return {
    x: lerp(start.x, end.x, progress),
    y: lerp(start.y, end.y, progress)
  };
};

export default function Game() {
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Starting equilateral triangle
  const startTriangle: [Point, Point, Point] = [
    { x: 400, y: 200 }, // Top vertex (A)
    { x: 300, y: 400 }, // Bottom left (B)
    { x: 500, y: 400 }, // Bottom right (C)
  ];
  
  // Ending flat triangle (straight line)
  const endTriangle: [Point, Point, Point] = [
    { x: 400, y: 300 }, // A - middle of line
    { x: 200, y: 300 }, // B - left end of line  
    { x: 600, y: 300 }, // C - right end of line
  ];
  
  const [triangle, setTriangle] = useState<Triangle>({
    vertices: startTriangle,
    angles: [60, 60, 60]
  });
  
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    dragIndex: null,
    startPoint: null,
    offset: { x: 0, y: 0 }
  });

  const [hoveredVertex, setHoveredVertex] = useState<number | null>(null);
  
  // Animation state
  const [animationState, setAnimationState] = useState<AnimationState>({
    isActive: false,
    progress: 0,
    hasStarted: false,
    hasCompleted: false
  });

  // Calculate angles in real-time
  const currentAngles = useMemo(() => {
    return calculateTriangleAngles(triangle.vertices);
  }, [triangle.vertices]);

  // Start animation after initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimationState(prev => ({ 
        ...prev, 
        isActive: true, 
        hasStarted: true 
      }));
    }, 1000); // Start after 1 second

    return () => clearTimeout(timer);
  }, []);

  // Animation loop
  useEffect(() => {
    if (!animationState.isActive) return;

    const animationTimer = setInterval(() => {
      setAnimationState(prev => {
        const newProgress = prev.progress + 0.005; // Slow animation - 20 seconds total
        
        if (newProgress >= 1) {
          // Animation complete
          setTimeout(() => {
            setAnimationState(current => ({ 
              ...current, 
              isActive: false, 
              hasCompleted: true 
            }));
          }, 2000); // Hold at flat triangle for 2 seconds
          
          return {
            ...prev,
            progress: 1
          };
        }
        
        return {
          ...prev,
          progress: newProgress
        };
      });
    }, 16); // ~60fps

    return () => clearInterval(animationTimer);
  }, [animationState.isActive]);

  // Update triangle based on animation progress - ONLY during active animation
  useEffect(() => {
    if (animationState.hasStarted && animationState.isActive && !dragState.isDragging) {
      const progress = animationState.progress;
      
      // Interpolate vertices
      const interpolatedVertices: [Point, Point, Point] = [
        lerpPoint(startTriangle[0], endTriangle[0], progress),
        lerpPoint(startTriangle[1], endTriangle[1], progress),
        lerpPoint(startTriangle[2], endTriangle[2], progress)
      ];
      
      setTriangle({
        vertices: interpolatedVertices,
        angles: calculateTriangleAngles(interpolatedVertices)
      });
    }
  }, [animationState.progress, animationState.hasStarted, animationState.isActive, dragState.isDragging]);

  // Mouse/touch event handlers - disabled during animation
  const handlePointerDown = useCallback((e: React.PointerEvent, vertexIndex: number) => {
    if (animationState.isActive || !animationState.hasCompleted) return;
    
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const point = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    
    const vertex = triangle.vertices[vertexIndex];
    const offset = {
      x: point.x - vertex.x,
      y: point.y - vertex.y
    };

    setDragState({
      isDragging: true,
      dragIndex: vertexIndex,
      startPoint: point,
      offset
    });

    svg.setPointerCapture(e.pointerId);
  }, [triangle.vertices, animationState.isActive, animationState.hasCompleted]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.isDragging || dragState.dragIndex === null || animationState.isActive) return;
    
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const point = {
      x: e.clientX - rect.left - dragState.offset.x,
      y: e.clientY - rect.top - dragState.offset.y
    };

    // Keep within bounds
    const boundedPoint = {
      x: Math.max(VERTEX_RADIUS, Math.min(CANVAS_WIDTH - VERTEX_RADIUS, point.x)),
      y: Math.max(VERTEX_RADIUS, Math.min(CANVAS_HEIGHT - VERTEX_RADIUS, point.y))
    };

    const constrainedVertices = constrainTriangle(triangle.vertices, dragState.dragIndex, boundedPoint);
    
    setTriangle({
      vertices: constrainedVertices,
      angles: calculateTriangleAngles(constrainedVertices)
    });
  }, [dragState, triangle.vertices, animationState.isActive]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (dragState.isDragging) {
      const svg = svgRef.current;
      if (svg) svg.releasePointerCapture(e.pointerId);
      
      setDragState({
        isDragging: false,
        dragIndex: null,
        startPoint: null,
        offset: { x: 0, y: 0 }
      });
    }
  }, [dragState.isDragging]);

  // Reset animation function
  const resetAnimation = () => {
    setAnimationState({
      isActive: true,
      progress: 0,
      hasStarted: true,
      hasCompleted: false
    });
  };

  // Create SVG path for triangle
  const trianglePath = `M ${triangle.vertices[0].x},${triangle.vertices[0].y} L ${triangle.vertices[1].x},${triangle.vertices[1].y} L ${triangle.vertices[2].x},${triangle.vertices[2].y} Z`;

  // Generate patterns for accessibility
  const renderPatterns = () => (
    <defs>
      <pattern id="dots" patternUnits="userSpaceOnUse" width="8" height="8">
        <circle cx="4" cy="4" r="1" fill="#F59E0B" opacity="0.3"/>
      </pattern>
      <pattern id="lines" patternUnits="userSpaceOnUse" width="6" height="6">
        <path d="M0,3 L6,3" stroke="#EA580C" strokeWidth="1" opacity="0.3"/>
      </pattern>
      <pattern id="solid" patternUnits="userSpaceOnUse" width="4" height="4">
        <rect width="4" height="4" fill="#DC2626" opacity="0.3"/>
      </pattern>
      <pattern id="crosshatch" patternUnits="userSpaceOnUse" width="8" height="8">
        <path d="M0,0 L8,8 M0,8 L8,0" stroke="#7C3AED" strokeWidth="0.5" opacity="0.3"/>
      </pattern>
      <pattern id="waves" patternUnits="userSpaceOnUse" width="12" height="6">
        <path d="M0,3 Q3,0 6,3 T12,3" fill="none" stroke="#2563EB" strokeWidth="1" opacity="0.3"/>
      </pattern>
      <pattern id="grid" patternUnits="userSpaceOnUse" width="10" height="10">
        <path d="M0,0 L10,0 M0,0 L0,10" stroke="#059669" strokeWidth="0.5" opacity="0.3"/>
      </pattern>
      <filter id="glow">
        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <filter id="shadow">
        <feDropShadow dx="1" dy="1" stdDeviation="2" floodOpacity="0.2"/>
      </filter>
    </defs>
  );

  // Render angle arcs with labels
  const renderAngleArcs = () => {
    return triangle.vertices.map((vertex, index) => {
      const angle = currentAngles[index];
      
      // Don't render very small angles (< 2°) to avoid visual clutter
      if (angle < 2) return null;
      
      const colorData = getAngleColor(angle);
      const nextIndex = (index + 1) % 3;
      const prevIndex = (index + 2) % 3;
      
      const toNext = {
        x: triangle.vertices[nextIndex].x - vertex.x,
        y: triangle.vertices[nextIndex].y - vertex.y
      };
      const toPrev = {
        x: triangle.vertices[prevIndex].x - vertex.x,
        y: triangle.vertices[prevIndex].y - vertex.y
      };
      
      const angleToNext = Math.atan2(toNext.y, toNext.x);
      const angleToPrev = Math.atan2(toPrev.y, toPrev.x);
      
      const arcRadius = Math.min(ANGLE_ARC_RADIUS, 
        Math.min(
          Math.sqrt(toNext.x * toNext.x + toNext.y * toNext.y) * 0.35,
          Math.sqrt(toPrev.x * toPrev.x + toPrev.y * toPrev.y) * 0.35
        )
      );
      
      let startAngle = angleToPrev;
      let endAngle = angleToNext;
      
      // Normalize angles
      while (endAngle - startAngle > Math.PI) startAngle += 2 * Math.PI;
      while (startAngle - endAngle > Math.PI) endAngle += 2 * Math.PI;
      
      const sweep = Math.abs(endAngle - startAngle);
      const largeArcFlag = sweep > Math.PI ? 1 : 0;
      const sweepFlag = endAngle > startAngle ? 1 : 0;
      
      const startX = vertex.x + Math.cos(startAngle) * arcRadius;
      const startY = vertex.y + Math.sin(startAngle) * arcRadius;
      const endX = vertex.x + Math.cos(endAngle) * arcRadius;
      const endY = vertex.y + Math.sin(endAngle) * arcRadius;
      
      const pathData = `M ${vertex.x},${vertex.y} L ${startX},${startY} A ${arcRadius},${arcRadius} 0 ${largeArcFlag},${sweepFlag} ${endX},${endY} Z`;
      
      // Position label towards the center of the triangle
      const centerX = (triangle.vertices[0].x + triangle.vertices[1].x + triangle.vertices[2].x) / 3;
      const centerY = (triangle.vertices[0].y + triangle.vertices[1].y + triangle.vertices[2].y) / 3;
      
      const toCenterAngle = Math.atan2(centerY - vertex.y, centerX - vertex.x);
      const labelRadius = arcRadius * 0.7;
      const labelX = vertex.x + Math.cos(toCenterAngle) * labelRadius;
      const labelY = vertex.y + Math.sin(toCenterAngle) * labelRadius;
      
      return (
        <g key={`angle-${index}`}>
          <path
            d={pathData}
            fill={colorData.fill}
            stroke={colorData.stroke}
            strokeWidth="1.5"
            opacity="0.7"
          />
          <path
            d={pathData}
            fill={`url(#${colorData.pattern})`}
            opacity="0.4"
          />
          <text
            x={labelX}
            y={labelY}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="12"
            fontWeight="600"
            fill={colorData.stroke}
          >
            {Math.round(angle)}°
          </text>
        </g>
      );
    });
  };

  // Render vertices with interaction
  const renderVertices = () => {
    return triangle.vertices.map((vertex, index) => {
      const isHovered = hoveredVertex === index && animationState.hasCompleted;
      const isDragging = dragState.isDragging && dragState.dragIndex === index;
      const scale = isDragging ? 1.3 : isHovered ? 1.1 : 1;
      const isInteractive = animationState.hasCompleted && !animationState.isActive;
      
      return (
        <g key={`vertex-${index}`}>
          <circle
            cx={vertex.x}
            cy={vertex.y}
            r={VERTEX_RADIUS}
            fill="white"
            stroke="#3B82F6"
            strokeWidth="2.5"
            filter="url(#shadow)"
            style={{
              cursor: isInteractive ? (dragState.isDragging ? 'grabbing' : 'grab') : 'default',
              transform: `scale(${scale})`,
              transformOrigin: `${vertex.x}px ${vertex.y}px`,
              transition: dragState.isDragging ? 'none' : 'transform 0.1s ease',
              opacity: isInteractive ? 1 : 0.8
            }}
            onPointerDown={isInteractive ? (e) => handlePointerDown(e, index) : undefined}
            onPointerEnter={isInteractive ? () => setHoveredVertex(index) : undefined}
            onPointerLeave={isInteractive ? () => setHoveredVertex(null) : undefined}
          />
          <text
            x={vertex.x}
            y={vertex.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="9"
            fontWeight="700"
            fill="#3B82F6"
            pointerEvents="none"
          >
            {String.fromCharCode(65 + index)}
          </text>
        </g>
      );
    });
  };

  // Get descriptive text based on animation state
  const getDescriptiveText = () => {
    if (!animationState.hasStarted) {
      return "Triangle angles always add to 180°. Watch this demonstration...";
    } else if (animationState.isActive) {
      const progress = Math.round(animationState.progress * 100);
      return `Morphing triangle... ${progress}% to straight line`;
    } else if (animationState.hasCompleted) {
      return "Now drag any vertex to explore different triangles!";
    }
    return "";
  };

  return (
    <div className="game-container">
      <div className="game-header">
        <div className="tool-info">
          <div className="tool-icon">△</div>
          <div>
            <h1>Triangle Angle Explorer</h1>
            <p>{getDescriptiveText()}</p>
          </div>
        </div>
        <div className="angle-summary">
          <div className="angle-total">
            Total: {Math.round(currentAngles.reduce((sum, angle) => sum + angle, 0))}°
          </div>
          <div className="angle-values">
            {currentAngles.map((angle, index) => (
              <div key={index} className="angle-value">
                <span className="angle-label">{String.fromCharCode(65 + index)}:</span>
                <span className="angle-number">{Math.round(angle)}°</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="canvas-container">
        <svg
          ref={svgRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
          className="geometry-canvas"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ touchAction: 'none' }}
        >
          {renderPatterns()}
          
          {/* Background grid */}
          <defs>
            <pattern id="grid-bg" width="20" height="20" patternUnits="userSpaceOnUse">
              <rect width="20" height="20" fill="#ffffff"/>
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f1f5f9" strokeWidth="0.5" opacity="0.8"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="#ffffff"/>
          <rect width="100%" height="100%" fill="url(#grid-bg)"/>
          
          {/* Triangle fill */}
          <path
            d={trianglePath}
            fill="#f8fafc"
            stroke="#cbd5e1"
            strokeWidth="1"
            strokeDasharray="3,3"
            opacity="0.4"
          />
          
          {/* Angle arcs */}
          {renderAngleArcs()}
          
          {/* Triangle edges */}
          <path
            d={trianglePath}
            fill="none"
            stroke="#334155"
            strokeWidth="2.5"
            filter="url(#shadow)"
          />
          
          {/* Vertices */}
          {renderVertices()}
          
          {/* Interactive feedback */}
          {dragState.isDragging && animationState.hasCompleted && (
            <circle
              cx={triangle.vertices[dragState.dragIndex!].x}
              cy={triangle.vertices[dragState.dragIndex!].y}
              r={VERTEX_RADIUS * 1.8}
              fill="none"
              stroke="#3B82F6"
              strokeWidth="1"
              opacity="0.3"
              className="drag-indicator"
            />
          )}
        </svg>
      </div>

      <div className="instructions">
        <div className="status-left">
          <div className="quick-help">
            {animationState.hasCompleted ? (
              <div className="help-item">
                <span className="help-key">Drag</span>
                <span>vertices to reshape</span>
              </div>
            ) : (
              <div className="help-item">
                <span>Demonstrating: Triangle angles = 180°</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="status-right">
          {animationState.hasCompleted && (
            <button 
              className="replay-btn"
              onClick={resetAnimation}
              title="Replay demonstration"
            >
              ↻ Replay Demo
            </button>
          )}
          
          <div className="mini-legend">
            <div className="legend-dot" style={{ backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }}></div>
            <span className="legend-text">Acute</span>
            
            <div className="legend-dot" style={{ backgroundColor: '#FECACA', borderColor: '#DC2626' }}></div>
            <span className="legend-text">Right</span>
            
            <div className="legend-dot" style={{ backgroundColor: '#BBF7D0', borderColor: '#059669' }}></div>
            <span className="legend-text">Obtuse</span>
          </div>
        </div>
      </div>
    </div>
  );
}