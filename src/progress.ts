type LevelProgress = {
  completed: boolean;
  bestMoves?: number;
  bestTime?: number;
  stars?: number;
};

type GameProgress = {
  [levelId: number]: LevelProgress;
};

const PROGRESS_KEY = 'geometry-puzzler-progress';

export function getProgress(): GameProgress {
  try {
    const stored = localStorage.getItem(PROGRESS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function saveLevelProgress(levelId: number, moves: number, time: number, stars: number) {
  const progress = getProgress();
  const current = progress[levelId];
  
  progress[levelId] = {
    completed: true,
    bestMoves: current?.bestMoves ? Math.min(current.bestMoves, moves) : moves,
    bestTime: current?.bestTime ? Math.min(current.bestTime, time) : time,
    stars: current?.stars ? Math.max(current.stars, stars) : stars,
  };
  
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

export function isLevelUnlocked(levelId: number): boolean {
  if (levelId === 1) return true; // Level 1 always unlocked
  
  const progress = getProgress();
  return progress[levelId - 1]?.completed || false; // Previous level must be completed
}