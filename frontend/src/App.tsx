import { BrowserRouter, useRoutes } from "react-router-dom";
import { Toaster } from "./components/Toaster";
import { UpdatePrompt } from "./components/UpdatePrompt";
import { routes } from "./routes";

/** `basename` do roteador (`VITE_SITE_BASENAME`, opcional). */
const ROUTER_BASENAME = (import.meta.env.VITE_SITE_BASENAME ?? "").replace(/\/+$/, "") || undefined;

/** Árvore de rotas (separada para os testes usarem `MemoryRouter`). */
export const AppRoutes = () => useRoutes(routes);

export interface AppProps {
  /** Desliga o registro do service worker (testes) */
  withUpdatePrompt?: boolean;
}

/** Roteador, toasts e aviso de nova versão. Providers ficam em `main.tsx`. */
const App = ({ withUpdatePrompt = true }: AppProps) => (
  <BrowserRouter basename={ROUTER_BASENAME}>
    <AppRoutes />
    <Toaster />
    {withUpdatePrompt && <UpdatePrompt />}
  </BrowserRouter>
);

export default App;
