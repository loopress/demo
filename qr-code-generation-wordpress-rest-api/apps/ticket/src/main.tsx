import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App, { config } from "./App";

// [loopress_app name="ticket"] renders <div id="loopress-app-ticket"> and exposes its
// selector as window.loopressApp_ticket.mount.
const mountEl = document.querySelector(config?.mount ?? "#root");
if (!mountEl) throw new Error("ticket app: mount point not found");

createRoot(mountEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
