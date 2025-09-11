import { Link } from "react-router-dom";

export default function Splash() {
  return (
    <div className="splash-container">
      <div className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">-- some typa name here later--</h1>
          <p className="hero-subtitle">
            room for eric description ideas
          </p>
          <p className="hero-description">
            some text here for l8r
          </p>
          <div className="hero-actions">
            <Link to="/categories" className="btn-primary">
              Begin Puzzles!
            </Link>
            <Link to="/about" className="btn-secondary">
              (tutorial)
            </Link>
          </div>
        </div>
        <div className="hero-visual">
          <div className="puzzle-preview">
            <div className="preview-grid">
              {Array.from({ length: 16 }, (_, i) => (
                <div 
                  key={i} 
                  className={`preview-cell ${i % 3 === 0 ? 'filled' : ''}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* idk if i like this whole emoji as the buttons but ofr now keep this cause i dont have time to find proper svg assosciated with this [COME BACK TO THIS ASHIM] */}
      <div className="features-section">
        <div className="feature-card">
          <div className="feature-icon">🧩</div> 
          <h3>Spatial Reasoning</h3>
          <p>some typa motive on how our games help their skills in this?</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">🎯</div>
          <h3>Progressive Difficulty</h3>
          <p>some typa motive on how our games help their skills in this?</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">⚡</div>
          <h3>Quick Sessions</h3>
          <p>some typa motive on how our games help their skills in this?</p>
        </div>
      </div>
    </div>
  );
}