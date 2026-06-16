import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// Mounts <App /> into the page.
// NOTE: React.StrictMode is intentionally NOT used here. In development
// StrictMode mounts every component twice, which makes MapLibre create
// and destroy each map twice and can crash the map. Leaving it off keeps
// the maps stable while you run `npm run dev`.
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
