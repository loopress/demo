import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App, { config } from "./App";

// [loopress_app name="image-shapes"] renders <div id="loopress-app-image-shapes"> and exposes its
// selector as window.loopressApp_image_shapes.mount.
const mountEl = document.querySelector(config?.mount ?? "#root");
if (!mountEl) throw new Error("image-shapes app: mount point not found");

createRoot(mountEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
