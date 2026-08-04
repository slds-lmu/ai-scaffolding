import React from "react";
import ReactDOM from "react-dom/client";
// order matters: config module first, then the MathJax bundle that reads it
import "./mathjax-setup";
import "mathjax/es5/tex-svg-full.js";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
