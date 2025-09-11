import React, { useState, useRef, useCallback, useEffect } from 'react';
import './LevelCreator.css';

interface Point { x: number; y: number; }
interface Shape {
  id: string;
  type: 'triangle' | 'square' | 'rectangle' | 'rhombus' | 'pentagon' | 'hexagon';
  position: Point;
  rotation: number;
  color: string;
  vertices: Point[];
  isFilled?: boolean; // Track if this shape is filled in play mode
}

interface DragState {
  isDragging: boolean;
  draggedShape: Shape | null;
  offset: Point;
  isFromPalette: boolean;
  isRotating: boolean;
}

interface SnapGuide {
  position: Point;
  type: 'horizontal' | 'vertical';
}

type Mode = 'creator' | 'play';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const SNAP_THRESHOLD = 15;

// Shape templates with relative vertices
const SHAPE_TEMPLATES = {
  triangle: [
    { x: 0, y: -30 },
    { x: -26, y: 15 },
    { x: 26, y: 15 }
  ],
  square: [
    { x: -25, y: -25 },
    { x: 25, y: -25 },
    { x: 25, y: 25 },
    { x: -25, y: 25 }
  ],
  rectangle: [
    { x: -35, y: -20 },
    { x: 35, y: -20 },
    { x: 35, y: 20 },
    { x: -35, y: 20 }
  ],
  rhombus: [
    { x: 0, y: -30 },
    { x: 20, y: 0 },
    { x: 0, y: 30 },
    { x: -20, y: 0 }
  ],
  pentagon: [
    { x: 0, y: -28 },
    { x: 27, y: -9 },
    { x: 17, y: 23 },
    { x: -17, y: 23 },
    { x: -27, y: -9 }
  ],
  hexagon: [
    { x: 0, y: -30 },
    { x: 26, y: -15 },
    { x: 26, y: 15 },
    { x: 0, y: 30 },
    { x: -26, y: 15 },
    { x: -26, y: -15 }
  ]
};

const PALETTE_SHAPES = [
  { type: 'triangle' as const, color: '#3B82F6', label: 'Triangle' },
  { type: 'square' as const, color: '#EF4444', label: 'Square' },
  { type: 'rectangle' as const, color: '#10B981', label: 'Rectangle' },
  { type: 'rhombus' as const, color: '#F59E0B', label: 'Rhombus' },
  { type: 'pentagon' as const, color: '#8B5CF6', label: 'Pentagon' },
  { type: 'hexagon' as const, color: '#EC4899', label: 'Hexagon' }
];

export default function LevelCreator() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [mode, setMode] = useState<Mode>('creator');
  const [placedShapes, setPlacedShapes] = useState<Shape[]>([]);
  const [selectedShape, setSelectedShape] = useState<Shape | null>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedShape: null,
    offset: { x: 0, y: 0 },
    isFromPalette: false,
    isRotating: false
  });
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);
  const [targetPattern, setTargetPattern] = useState<Shape[]>([]);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [filledShapes, setFilledShapes] = useState<Set<string>>(new Set());

  // Generate shape vertices based on position and rotation
  const generateShapeVertices = useCallback((shape: Shape): Point[] => {
    const template = SHAPE_TEMPLATES[shape.type];
    const radians = (shape.rotation * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    
    return template.map(vertex => {
      const rotatedX = vertex.x * cos - vertex.y * sin;
      const rotatedY = vertex.x * sin + vertex.y * cos;
      
      return {
        x: shape.position.x + rotatedX,
        y: shape.position.y + rotatedY
      };
    });
  }, []);

  // Get bounding box of a shape
  const getShapeBounds = useCallback((vertices: Point[]) => {
    if (vertices.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    
    const xs = vertices.map(v => v.x);
    const ys = vertices.map(v => v.y);
    
    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys)
    };
  }, []);

  // Find snap position for shape against other shapes
  const findSnapPosition = useCallback((draggedShape: Shape, otherShapes: Shape[]): { position: Point; guides: SnapGuide[] } => {
    const draggedBounds = getShapeBounds(draggedShape.vertices);
    const guides: SnapGuide[] = [];
    let snapPosition = draggedShape.position;
    let minSnapDistance = SNAP_THRESHOLD;

    for (const otherShape of otherShapes) {
      if (otherShape.id === draggedShape.id) continue;
      
      const otherBounds = getShapeBounds(otherShape.vertices);
      
      const horizontalSnaps = [
        { snapX: otherBounds.minX - (draggedBounds.maxX - draggedShape.position.x), edge: 'left-to-right' },
        { snapX: otherBounds.maxX - (draggedBounds.minX - draggedShape.position.x), edge: 'right-to-left' },
        { snapX: otherBounds.minX - (draggedBounds.minX - draggedShape.position.x), edge: 'left-to-left' },
        { snapX: otherBounds.maxX - (draggedBounds.maxX - draggedShape.position.x), edge: 'right-to-right' }
      ];

      const verticalSnaps = [
        { snapY: otherBounds.minY - (draggedBounds.maxY - draggedShape.position.y), edge: 'top-to-bottom' },
        { snapY: otherBounds.maxY - (draggedBounds.minY - draggedShape.position.y), edge: 'bottom-to-top' },
        { snapY: otherBounds.minY - (draggedBounds.minY - draggedShape.position.y), edge: 'top-to-top' },
        { snapY: otherBounds.maxY - (draggedBounds.maxY - draggedShape.position.y), edge: 'bottom-to-bottom' }
      ];

      for (const snap of horizontalSnaps) {
        const distance = Math.abs(snap.snapX - draggedShape.position.x);
        if (distance < minSnapDistance) {
          minSnapDistance = distance;
          snapPosition = { ...snapPosition, x: snap.snapX };
          guides.push({
            position: { x: snap.snapX, y: Math.min(draggedBounds.minY, otherBounds.minY) },
            type: 'vertical'
          });
        }
      }

      for (const snap of verticalSnaps) {
        const distance = Math.abs(snap.snapY - draggedShape.position.y);
        if (distance < minSnapDistance) {
          minSnapDistance = distance;
          snapPosition = { ...snapPosition, y: snap.snapY };
          guides.push({
            position: { x: Math.min(draggedBounds.minX, otherBounds.minX), y: snap.snapY },
            type: 'horizontal'
          });
        }
      }
    }

    return { position: snapPosition, guides };
  }, [getShapeBounds]);

  // Find target shape in a specific direction from current shape
  const findTargetInDirection = useCallback((currentShape: Shape, direction: 'left' | 'right' | 'up' | 'down'): Shape | null => {
    const currentBounds = getShapeBounds(currentShape.vertices);
    const tolerance = 50; // Increased tolerance for better adjacency detection
    
    let bestTarget: Shape | null = null;
    let bestDistance = Infinity;

    for (const target of targetPattern) {
      if (target.type !== currentShape.type) continue;
      if (filledShapes.has(target.id)) continue; // Skip already filled targets
      
      const targetBounds = getShapeBounds(target.vertices);
      let isInDirection = false;
      let distance = 0;

      switch (direction) {
        case 'right':
          // Target is to the right and roughly at same Y level
          isInDirection = targetBounds.minX >= currentBounds.maxX - tolerance && 
                         Math.abs(targetBounds.minY - currentBounds.minY) <= tolerance;
          distance = Math.abs(targetBounds.minX - currentBounds.maxX) + Math.abs(targetBounds.minY - currentBounds.minY);
          break;
        case 'left':
          // Target is to the left and roughly at same Y level  
          isInDirection = targetBounds.maxX <= currentBounds.minX + tolerance && 
                         Math.abs(targetBounds.minY - currentBounds.minY) <= tolerance;
          distance = Math.abs(currentBounds.minX - targetBounds.maxX) + Math.abs(targetBounds.minY - currentBounds.minY);
          break;
        case 'down':
          // Target is below and roughly at same X level
          isInDirection = targetBounds.minY >= currentBounds.maxY - tolerance && 
                         Math.abs(targetBounds.minX - currentBounds.minX) <= tolerance;
          distance = Math.abs(targetBounds.minY - currentBounds.maxY) + Math.abs(targetBounds.minX - currentBounds.minX);
          break;
        case 'up':
          // Target is above and roughly at same X level
          isInDirection = targetBounds.maxY <= currentBounds.minY + tolerance && 
                         Math.abs(targetBounds.minX - currentBounds.minX) <= tolerance;
          distance = Math.abs(currentBounds.minY - targetBounds.maxY) + Math.abs(targetBounds.minX - currentBounds.minX);
          break;
      }

      if (isInDirection && distance < bestDistance) {
        bestDistance = distance;
        bestTarget = target;
      }
    }

    return bestTarget;
  }, [targetPattern, filledShapes, getShapeBounds]);

  // Check if shape can move in a direction
  const canShapeMove = useCallback((shape: Shape, direction: 'left' | 'right' | 'up' | 'down'): boolean => {
    return findTargetInDirection(shape, direction) !== null;
  }, [findTargetInDirection]);

  // Handle keyboard events for shape movement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode !== 'play' || !selectedShape) return;
      
      let direction: 'left' | 'right' | 'up' | 'down' | null = null;
      
      switch (e.key) {
        case 'ArrowLeft':
          direction = 'left';
          break;
        case 'ArrowRight':
          direction = 'right';
          break;
        case 'ArrowUp':
          direction = 'up';
          break;
        case 'ArrowDown':
          direction = 'down';
          break;
        default:
          return;
      }
      
      e.preventDefault();
      
      if (direction) {
        const targetShape = findTargetInDirection(selectedShape, direction);
        if (targetShape) {
          // Move the current shape to the target position
          const updatedShape = {
            ...selectedShape,
            position: targetShape.position,
            vertices: generateShapeVertices({
              ...selectedShape,
              position: targetShape.position
            })
          };
          
          // Update the placed shapes
          setPlacedShapes(prev => 
            prev.map(s => s.id === selectedShape.id ? updatedShape : s)
          );
          
          // Mark the target as filled and update selection
          setFilledShapes(prev => new Set([...prev, targetShape.id]));
          setSelectedShape(updatedShape);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, selectedShape, findTargetInDirection, generateShapeVertices]);

  // Get rotation handle position
  const getRotationHandle = useCallback((shape: Shape): Point => {
    const bounds = getShapeBounds(shape.vertices);
    return {
      x: bounds.maxX + 20,
      y: bounds.minY - 10
    };
  }, [getShapeBounds]);

  // Calculate angle between two points
  const getAngleBetweenPoints = useCallback((center: Point, point: Point): number => {
    return Math.atan2(point.y - center.y, point.x - center.x) * (180 / Math.PI);
  }, []);

  // Create shape path string for SVG
  const getShapePath = useCallback((vertices: Point[]): string => {
    if (vertices.length === 0) return '';
    const start = vertices[0];
    const rest = vertices.slice(1);
    return `M ${start.x},${start.y} ${rest.map(v => `L ${v.x},${v.y}`).join(' ')} Z`;
  }, []);

  // Clear all placed shapes
  const handleClearPalette = useCallback(() => {
    if (window.confirm('Are you sure you want to clear all shapes?')) {
      setPlacedShapes([]);
      setSelectedShape(null);
    }
  }, []);

  // Handle rotation handle drag start
  const handleRotationStart = useCallback((e: React.PointerEvent, shape: Shape) => {
    e.preventDefault();
    e.stopPropagation();

    const svg = svgRef.current;
    if (!svg) return;

    setDragState({
      isDragging: true,
      draggedShape: shape,
      offset: { x: 0, y: 0 },
      isFromPalette: false,
      isRotating: true
    });

    svg.setPointerCapture(e.pointerId);
  }, []);

  // Handle palette shape drag start
  const handlePaletteShapeStart = useCallback((e: React.PointerEvent, shapeType: typeof PALETTE_SHAPES[0]['type'], color: string) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    const newShape: Shape = {
      id: `shape-${Date.now()}-${Math.random()}`,
      type: shapeType,
      position: point,
      rotation: 0,
      color: color,
      vertices: []
    };

    newShape.vertices = generateShapeVertices(newShape);

    setDragState({
      isDragging: true,
      draggedShape: newShape,
      offset: { x: 0, y: 0 },
      isFromPalette: true,
      isRotating: false
    });

    svg.setPointerCapture(e.pointerId);
  }, [generateShapeVertices]);

  // Handle canvas shape drag start
  const handleCanvasShapeStart = useCallback((e: React.PointerEvent, shape: Shape) => {
    if (mode !== 'creator') return;
    e.preventDefault();
    e.stopPropagation();

    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    setDragState({
      isDragging: true,
      draggedShape: shape,
      offset: { x: point.x - shape.position.x, y: point.y - shape.position.y },
      isFromPalette: false,
      isRotating: false
    });

    setSelectedShape(shape);
    svg.setPointerCapture(e.pointerId);
  }, [mode]);

  // Handle pointer move
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.isDragging || !dragState.draggedShape) return;

    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    if (dragState.isRotating) {
      const shape = dragState.draggedShape;
      const angle = getAngleBetweenPoints(shape.position, point);
      const newRotation = Math.round(angle / 15) * 15;
      
      const updatedShape = {
        ...shape,
        rotation: newRotation,
        vertices: generateShapeVertices({
          ...shape,
          rotation: newRotation
        })
      };
      
      setDragState(prev => ({ ...prev, draggedShape: updatedShape }));
      setSnapGuides([]);
    } else {
      const newPosition = {
        x: point.x - dragState.offset.x,
        y: point.y - dragState.offset.y
      };

      const constrainedPosition = {
        x: Math.max(50, Math.min(CANVAS_WIDTH - 50, newPosition.x)),
        y: Math.max(50, Math.min(CANVAS_HEIGHT - 50, newPosition.y))
      };

      const tempShape = {
        ...dragState.draggedShape,
        position: constrainedPosition,
        vertices: generateShapeVertices({
          ...dragState.draggedShape,
          position: constrainedPosition
        })
      };

      const otherShapes = dragState.isFromPalette ? placedShapes : placedShapes.filter(s => s.id !== dragState.draggedShape!.id);
      const { position: snapPosition, guides } = findSnapPosition(tempShape, otherShapes);

      const updatedShape = {
        ...dragState.draggedShape,
        position: snapPosition,
        vertices: generateShapeVertices({
          ...dragState.draggedShape,
          position: snapPosition
        })
      };

      setDragState(prev => ({ ...prev, draggedShape: updatedShape }));
      setSnapGuides(guides);
    }
  }, [dragState, generateShapeVertices, getAngleBetweenPoints, findSnapPosition, placedShapes]);

  // Handle pointer up
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (svg) svg.releasePointerCapture(e.pointerId);

    if (dragState.isDragging && dragState.draggedShape) {
      const shape = dragState.draggedShape;
      
      if (dragState.isFromPalette) {
        setPlacedShapes(prev => [...prev, shape]);
      } else {
        setPlacedShapes(prev => 
          prev.map(s => s.id === shape.id ? shape : s)
        );
        
        if (dragState.isRotating) {
          setSelectedShape(shape);
        }
      }
    }

    setDragState({
      isDragging: false,
      draggedShape: null,
      offset: { x: 0, y: 0 },
      isFromPalette: false,
      isRotating: false
    });
    setSnapGuides([]);
  }, [dragState]);

  // Handle shape selection in play mode
  const handleShapeSelect = useCallback((shape: Shape) => {
    if (mode !== 'play') return;
    setSelectedShape(selectedShape?.id === shape.id ? null : shape);
  }, [mode, selectedShape]);

  // Handle level completion
  const handleLevelFinished = useCallback(() => {
    if (placedShapes.length === 0) return;
    
    const mergedPattern = placedShapes.map(shape => ({
      ...shape,
      color: '#FFFFFF'
    }));
    
    setTargetPattern(mergedPattern);
    setFilledShapes(new Set()); // Reset filled shapes
    setMode('play');
    setSelectedShape(null);
  }, [placedShapes]);

  // Handle mode switch
  const handleModeSwitch = useCallback(() => {
    if (mode === 'creator') {
      handleLevelFinished();
    } else {
      setMode('creator');
      setSelectedShape(null);
      setTargetPattern([]);
      setFilledShapes(new Set());
    }
  }, [mode, handleLevelFinished]);

  return (
    <div className="level-creator">
      {/* Header */}
      <div className="level-creator__header">
        <div className="level-creator__title">
          <div>
            <h1>lvl creator tool</h1>
            <p>{mode === 'creator' ? 'design your puzzle here' : 'test puzzle'}</p>
          </div>
        </div>

        <div className="level-creator__controls">
          <button
            className="level-creator__btn level-creator__btn--secondary"
            onClick={() => setIsPaletteOpen(!isPaletteOpen)}
          >
            {isPaletteOpen ? 'hide' : 'show'} plate
          </button>

          {mode === 'creator' && placedShapes.length > 0 && (
            <>
              <button
                className="level-creator__btn level-creator__btn--danger"
                onClick={handleClearPalette}
              >
                clear palette
              </button>
              <button
                className="level-creator__btn level-creator__btn--primary"
                onClick={handleLevelFinished}
              >
                lvl finished
              </button>
            </>
          )}
          
          <button
            className="level-creator__btn level-creator__btn--accent"
            onClick={handleModeSwitch}
          >
            {mode === 'creator' ? 'test level' : 'back to creator'}
          </button>
        </div>
      </div>

      <div className="level-creator__workspace">
        {/* Main Canvas */}
        <div className="level-creator__canvas-container">
          <svg
            ref={svgRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
            className="level-creator__canvas"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{ touchAction: 'none' }}
          >
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <rect width="20" height="20" fill="white"/>
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f1f5f9" strokeWidth="1"/>
              </pattern>
            </defs>

            {/* Background */}
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Snap guides */}
            {snapGuides.map((guide, index) => (
              <line
                key={`guide-${index}`}
                x1={guide.type === 'vertical' ? guide.position.x : 0}
                y1={guide.type === 'vertical' ? guide.position.y : guide.position.y}
                x2={guide.type === 'vertical' ? guide.position.x : CANVAS_WIDTH}
                y2={guide.type === 'vertical' ? CANVAS_HEIGHT : guide.position.y}
                stroke="#10b981"
                strokeWidth="2"
                strokeDasharray="5,5"
                opacity="0.7"
                style={{ pointerEvents: 'none' }}
              />
            ))}

            {/* Target pattern (play mode) */}
            {mode === 'play' && targetPattern.map(shape => {
              const isFilled = filledShapes.has(shape.id);
              return (
                <path
                  key={`target-${shape.id}`}
                  d={getShapePath(shape.vertices)}
                  fill={isFilled ? shape.color : '#f8fafc'}
                  stroke="#e2e8f0"
                  strokeWidth="2"
                  opacity={isFilled ? 0.8 : 0.3}
                />
              );
            })}

            {/* Placed shapes */}
            {placedShapes.map(shape => (
              <path
                key={shape.id}
                d={getShapePath(shape.vertices)}
                fill={mode === 'creator' ? shape.color : shape.color}
                stroke={selectedShape?.id === shape.id ? '#3B82F6' : '#94a3b8'}
                strokeWidth={selectedShape?.id === shape.id ? 3 : 2}
                style={{ 
                  cursor: mode === 'creator' ? 'grab' : mode === 'play' ? 'pointer' : 'default',
                  opacity: mode === 'creator' ? 1 : 0.9
                }}
                onPointerDown={mode === 'creator' ? (e) => handleCanvasShapeStart(e, shape) : undefined}
                onClick={mode === 'play' ? () => handleShapeSelect(shape) : undefined}
              />
            ))}

            {/* Rotation handles for selected shape in creator mode */}
            {mode === 'creator' && selectedShape && selectedShape.vertices.length > 0 && !dragState.isDragging && (
              <g>
                {(() => {
                  const handle = getRotationHandle(selectedShape);
                  return (
                    <g>
                      <line
                        x1={selectedShape.position.x}
                        y1={selectedShape.position.y}
                        x2={handle.x}
                        y2={handle.y}
                        stroke="#3B82F6"
                        strokeWidth="1"
                        strokeDasharray="3,3"
                        opacity="0.5"
                        style={{ pointerEvents: 'none' }}
                      />
                      
                      <circle
                        cx={handle.x}
                        cy={handle.y}
                        r="8"
                        fill="#3B82F6"
                        stroke="white"
                        strokeWidth="2"
                        style={{ cursor: 'grab' }}
                        onPointerDown={(e) => handleRotationStart(e, selectedShape)}
                      />
                      
                      <text
                        x={handle.x}
                        y={handle.y + 1}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="white"
                        fontSize="10"
                        fontWeight="bold"
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        ↻
                      </text>
                    </g>
                  );
                })()}
              </g>
            )}

            {/* Dragging shape preview */}
            {dragState.isDragging && dragState.draggedShape && (
              <path
                d={getShapePath(dragState.draggedShape.vertices)}
                fill={dragState.draggedShape.color}
                stroke="#3B82F6"
                strokeWidth="2"
                opacity="0.7"
                style={{ pointerEvents: 'none' }}
              />
            )}
          </svg>
        </div>

        {/* Shape Palette */}
        {isPaletteOpen && mode === 'creator' && (
          <div className="level-creator__palette">
            <div className="level-creator__palette-header">
              <h3>shape palette</h3>
              <button
                className="level-creator__palette-close"
                onClick={() => setIsPaletteOpen(false)}
              >
                ×
              </button>
            </div>
            
            <div className="level-creator__palette-shapes">
              {PALETTE_SHAPES.map(({ type, color, label }) => (
                <div
                  key={type}
                  className="level-creator__palette-shape"
                  onPointerDown={(e) => handlePaletteShapeStart(e, type, color)}
                  style={{ touchAction: 'none' }}
                >
                  <svg width="60" height="60" viewBox="0 0 60 60">
                    <path
                      d={getShapePath(SHAPE_TEMPLATES[type].map(v => ({ 
                        x: v.x + 30, 
                        y: v.y + 30 
                      })))}
                      fill={color}
                      stroke="#64748b"
                      strokeWidth="1"
                    />
                  </svg>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="level-creator__status">
        <div className="level-creator__status-info">
          Mode: <strong>{mode === 'creator' ? 'Creator' : 'Play'}</strong>
          {mode === 'creator' && (
            <>
              {' | '}Shapes: <strong>{placedShapes.length}</strong>
            </>
          )}
          {mode === 'play' && selectedShape && (
            <>
              {' | '}Selected: <strong>{selectedShape.type}</strong>
              {' | '}Filled: <strong>{filledShapes.size}/{targetPattern.length}</strong>
            </>
          )}
        </div>
        
        {mode === 'play' && selectedShape && (
          <div className="level-creator__play-instructions">
            {canShapeMove(selectedShape, 'left') || canShapeMove(selectedShape, 'right') || canShapeMove(selectedShape, 'up') || canShapeMove(selectedShape, 'down') 
              ? 'Use arrow keys to fill target shapes' 
              : 'No target shapes available in any direction'}
          </div>
        )}
        
        {mode === 'play' && !selectedShape && (
          <div className="level-creator__play-instructions">
            Select a shape to start filling the pattern
          </div>
        )}
        
        {mode === 'creator' && selectedShape && (
          <div className="level-creator__creator-instructions">
            Drag the blue circle to rotate • Shapes snap to edges when close
          </div>
        )}
        
        {mode === 'creator' && !selectedShape && (
          <div className="level-creator__creator-instructions">
            Drag shapes from palette • Shapes will snap together like LEGO blocks
          </div>
        )}
      </div>
    </div>
  );
}