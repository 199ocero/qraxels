import { createRoot } from "react-dom/client";
import { Office } from "./Office.tsx";
import { Sidebar } from "./Sidebar.tsx";
import { handle, sim } from "./sim.ts";
import { isDemo, startDemo } from "./demo.ts";
import "./style.css";

if (isDemo) {
  sim.connected = true;
  startDemo();
} else {
  // EventSource reconnects by itself; the server resends a full snapshot each time.
  const es = new EventSource("/events");
  es.onmessage = (e) => handle(JSON.parse(e.data));
  es.onopen = () => (sim.connected = true);
  es.onerror = () => {
    sim.connected = false;
    handle({ type: "noop" } as any);
  };
}

createRoot(document.getElementById("root")!).render(
  <main className="app">
    <section className="office" aria-label="3D office where the bots work">
      <Office />
    </section>
    <Sidebar />
  </main>,
);
