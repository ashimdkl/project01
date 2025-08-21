import { Link } from "react-router-dom";

export default function Geometry() {
  const stats = {
    totalLevels: 12,
    completedLevels: 0, // This would come from progress system
    averageStars: 0
  };

  const skills = [
    "space 1",
    "space 2", 
    "shape 3",
    "shape 4"
  ];

  return (
    <div className="geometry-container">
      <div className="geometry-header">
        <div className="breadcrumb">
          <Link to="/categories">Categories</Link>
          <span className="breadcrumb-separator">•</span>
          <span>Geometry</span>
        </div>
        
        <div className="geometry-hero">
          <div className="geometry-content">
            <h1>Geogami</h1>
            <p className="geometry-description">
              a little description on what the geometry puzzles are all about
            </p>
            
            <div className="skills-section">
              <h3>Skills You'll Develop</h3>
              <div className="skills-grid">
                {skills.map((skill, index) => (
                  <div key={index} className="skill-tag">
                    {skill}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="geometry-visual">
            <div className="shape-demo">
              <div className="demo-grid">
                <div className="demo-shape demo-rect"></div>
                <div className="demo-shape demo-triangle"></div>
                <div className="demo-shape demo-circle"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="geometry-stats">
        <div className="stat-card">
          <div className="stat-number">{stats.totalLevels}</div>
          <div className="stat-label">Total Levels</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.completedLevels}</div>
          <div className="stat-label">Completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.averageStars.toFixed(1)}</div>
          <div className="stat-label">Avg Stars</div>
        </div>
      </div>
      
      <div className="geometry-actions">
        <Link to="/geometry/levels" className="btn-primary large">
          Start Playing
        </Link>
        <button className="btn-secondary large">
          View Tutorial
        </button>
      </div>
      
      <div className="difficulty-preview">
        <h3>Difficulty Progression</h3>
        <div className="difficulty-bars">
          <div className="difficulty-level">
            <span className="level-name">Beginner</span>
            <div className="level-bar">
              <div className="level-fill" style={{ width: '30%' }}></div>
            </div>
            <span className="level-range">Levels 1-4</span>
          </div>
          <div className="difficulty-level">
            <span className="level-name">Intermediate</span>
            <div className="level-bar">
              <div className="level-fill" style={{ width: '60%' }}></div>
            </div>
            <span className="level-range">Levels 5-8</span>
          </div>
          <div className="difficulty-level">
            <span className="level-name">Advanced</span>
            <div className="level-bar">
              <div className="level-fill" style={{ width: '90%' }}></div>
            </div>
            <span className="level-range">Levels 9-12</span>
          </div>
        </div>
      </div>
    </div>
  );
}