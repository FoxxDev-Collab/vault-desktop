import { VaultApp } from "./VaultApp";
import { ToastProvider } from "./components/Toast";
import "./index.css";

export function App() {
  return (
    <ToastProvider>
      <VaultApp />
    </ToastProvider>
  );
}

export default App;
