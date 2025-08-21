import { Link } from "react-router-dom";
import { getProgress, isLevelUnlocked } from "../progress";

export default function LevelSelect() {
  const progress = getProgress();
  
  const levels = Array.from({ length: 12 }, (_, i) => i + 1);
  
  // Calculate overall progress
  const completedLevels = levels.filter(level => progress[level]?.completed).length;
  const totalStars = levels.reduce((sum, level) => sum + (progress[level]?.stars || 0), 0);
  const maxStars = levels.length * 3;

  return (
    <div className="level-select-container">
      <div className="level-select-header">
        <div className="breadcrumb">
          <Link to="/categories">Categories</Link>
          <span className="breadcrumb-separator">•</span>
          <Link to="/geometry">Geometry</Link>
          <span className="breadcrumb-separator">•</span>
          <span>Levels</span>
        </div>
        
        <h1>Select Level</h1>
        <p className="level-select-subtitle">
          Choose your challenge and start solving
        </p>
      </div>
      
      <div className="progress-overview">
        <div className="progress-stat">
          <div className="progress-number">{completedLevels}</div>
          <div className="progress-label">Levels Completed</div>
        </div>
        <div className="progress-divider"></div>
        <div className="progress-stat">
          <div className="progress-number">{totalStars}/{maxStars}</div>
          <div className="progress-label">Stars Earned</div>
        </div>
        <div className="progress-divider"></div>
        <div className="progress-stat">
          <div className="progress-number">{Math.round((completedLevels / levels.length) * 100)}%</div>
          <div className="progress-label">Progress</div>
        </div>
      </div>
      
      <div className="levels-grid">
        {levels.map(levelNum => {
          const unlocked = isLevelUnlocked(levelNum);
          const levelProgress = progress[levelNum];
          const isCompleted = levelProgress?.completed || false;
          
          if (unlocked) {
            return (
              <Link 
                key={levelNum}
                to={`/geometry/level/${levelNum}`} 
                className={`level-card ${isCompleted ? 'completed' : 'available'}`}
              >
                <div className="level-number">{levelNum}</div>
                {isCompleted && (
                  <div className="level-stars">
                    {Array.from({ length: 3 }, (_, i) => (
                      <span 
                        key={i} 
                        className={`star ${i < (levelProgress?.stars || 0) ? 'filled' : 'empty'}`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                )}
                {isCompleted && (
                  <div className="level-best">
                    <div className="best-stat">
                      <span className="best-label">Best</span>
                      <span className="best-value">{levelProgress?.bestMoves}m</span>
                    </div>
                  </div>
                )}
                <div className="level-status">
                  {isCompleted ? 'Completed' : 'Available'}
                </div>
              </Link>
            );
          } else {
            return (
              <div 
                key={levelNum}
                className="level-card locked"
              >
                <div className="level-number">{levelNum}</div>
                <div className="lock-icon">🔒</div>
                <div className="level-status">Locked</div>
              </div>
            );
          }
        })}
      </div>
      
      <div className="level-select-footer">
        <Link to="/geometry" className="btn-secondary">
          ← Back to Geometry
        </Link>
        <div className="next-level-hint">
          {completedLevels < levels.length && (
            <p>Complete Level {completedLevels + 1} to unlock the next challenge</p>
          )}
        </div>
      </div>
    </div>
  );
}