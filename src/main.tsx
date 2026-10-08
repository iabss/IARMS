import "./index.css";
import "./App";
import { saveRiskRegister, deleteRiskRegister, fetchLiveRiskRegister } from "./services/api";

// Expose risk register operations to global window for seamless binding across all UI modules
(window as any).saveRiskRegister = saveRiskRegister;
(window as any).deleteRiskRegister = deleteRiskRegister;
(window as any).fetchLiveRiskRegister = fetchLiveRiskRegister;

import "./bundle.js";
