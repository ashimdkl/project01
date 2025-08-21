import { Outlet, Link } from "react-router-dom";

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">pw01</Link>
        <nav className="nav">
          <Link to="/categories">Categories</Link>
          <Link to="/geometry">Geometry</Link>
        </nav>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <footer className="footer">
        <span>© version 8.21.25</span>
      </footer>
    </div>
  );
}
