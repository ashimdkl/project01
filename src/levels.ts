export type Level = {
  id: number;
  name: string;
  grid: { cols: number; rows: number; cell: number };
  target: { x: number; y: number; w: number; h: number }; // in cells
  par: { moves: number; timeSec: number };
};

export const LEVELS: Level[] = [
  {
    id: 1,
    name: "Paint the Box",
    // fewer cells, bigger pixels for a chunky Game Boy feel
    grid: { cols: 16, rows: 16, cell: 28 },
    target: { x: 5, y: 5, w: 6, h: 6 }, // 6x6 = 36 tiles
    par: { moves: 36, timeSec: 30 }
  }
];

export function getLevel(id: number) {
  return LEVELS.find(l => l.id === id);
}
