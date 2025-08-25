import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App.tsx";
import Splash from "./pages/Splash.tsx";
import Categories from "./pages/Categories.tsx";
import Geometry from "./pages/Geometry.tsx";
import LevelSelect from "./pages/LevelSelect.tsx";
import Game from "./pages/Game.tsx";
import Game2 from "./pages/Game2.tsx";
import "./index.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Splash /> },
      { path: "categories", element: <Categories /> },
      { path: "geometry", element: <Geometry /> },
      { path: "geometry/levels", element: <LevelSelect /> },
      { path: "geometry/level/2", element: <Game2 /> },       // Level 2 first
      { path: "geometry/level/:id", element: <Game /> },      // Generic route for all others (including 1)
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);