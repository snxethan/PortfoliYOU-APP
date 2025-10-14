import React from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./index.css";
createRoot(document.getElementById("root")!).render(<App />);

// boots react app by rendering the App component into the root div in index.html