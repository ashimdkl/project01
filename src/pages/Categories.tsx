import { Link } from "react-router-dom";

export default function Categories() {
  const categories = [
    {
      id: "geometry",
      name: "Geometry",
      description: "Spatial puzzles and shape manipulation",
      icon: "📐",
      available: true,
      levelCount: 12
    },
    {
      id: "logic",
      name: "Logic",
      description: "Pattern recognition and deduction",
      icon: "🧠",
      available: false,
      levelCount: 15
    },
    {
      id: "numbers",
      name: "Numbers",
      description: "Mathematical reasoning and sequences",
      icon: "🔢",
      available: false,
      levelCount: 10
    }
  ];

  return (
    <div className="categories-container">
      <div className="categories-header">
        <h1>Choose Your Challenge</h1>
        <p className="categories-subtitle">
          Each category offers a unique way to exercise your mind
        </p>
      </div>
      
      <div className="categories-grid">
        {categories.map((category) => (
          <div key={category.id} className="category-card-wrapper">
            {category.available ? (
              <Link to={`/${category.id}`} className="category-card">
                <div className="category-icon">{category.icon}</div>
                <div className="category-content">
                  <h3 className="category-name">{category.name}</h3>
                  <p className="category-description">{category.description}</p>
                  <div className="category-meta">
                    <span className="level-count">{category.levelCount} levels</span>
                    <span className="category-status available">Available</span>
                  </div>
                </div>
                <div className="category-arrow">→</div>
              </Link>
            ) : (
              <div className="category-card disabled">
                <div className="category-icon">{category.icon}</div>
                <div className="category-content">
                  <h3 className="category-name">{category.name}</h3>
                  <p className="category-description">{category.description}</p>
                  <div className="category-meta">
                    <span className="level-count">{category.levelCount} levels</span>
                    <span className="category-status coming-soon">Coming Soon</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="categories-footer">
        <p>More categories and levels coming soon!</p>
      </div>
    </div>
  );
}