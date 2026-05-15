import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installFetchCsrf } from "./lib/installFetchCsrf";

installFetchCsrf();

createRoot(document.getElementById("root")!).render(<App />);
