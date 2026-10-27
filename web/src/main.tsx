import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applyAppearance, defaultAppearance } from "./appearance/appearance";
import "./styles/tokens.css";
import "./styles/base.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root não existe em index.html");

applyAppearance(defaultAppearance);
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
