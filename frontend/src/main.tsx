import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Fonte self-hosted (vai para o precache do service worker → funciona offline)
import "@fontsource-variable/plus-jakarta-sans";
import "./index.css";
import "./i18n";
import App from "./App";
import { ApprovalProvider } from "./Contexts/ApprovalContext";
import { AuthProvider } from "./Contexts/AuthContext";
import { CompanyProvider } from "./Contexts/CompanyContext";
import { ConnectivityProvider } from "./Contexts/ConnectivityContext";
import { HistoryProvider } from "./Contexts/HistoryContext";
import { InvitationProvider } from "./Contexts/InvitationContext";
import { MemberProvider } from "./Contexts/MemberContext";
import { PositionProvider } from "./Contexts/PositionContext";
import { PunchProvider } from "./Contexts/PunchContext";
import { PunchQueueProvider } from "./Contexts/PunchQueueContext";
import { startInstallPromptCapture } from "./hooks/useInstallPrompt";

// `beforeinstallprompt` pode disparar antes do React montar
startInstallPromptCapture();

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Elemento #root não encontrado em index.html");
}

// Ordem dos providers: Connectivity (independente) → Auth → Company (depende de Auth) →
// PunchQueue (Auth + Connectivity) → Punch (Company + fila) → Position/Invitation/History/
// Approval/Member (Company)
createRoot(rootElement).render(
  <StrictMode>
    <ConnectivityProvider>
      <AuthProvider>
        <CompanyProvider>
          <PunchQueueProvider>
            <PunchProvider>
              <PositionProvider>
                <InvitationProvider>
                  <HistoryProvider>
                    <ApprovalProvider>
                      <MemberProvider>
                        <App />
                      </MemberProvider>
                    </ApprovalProvider>
                  </HistoryProvider>
                </InvitationProvider>
              </PositionProvider>
            </PunchProvider>
          </PunchQueueProvider>
        </CompanyProvider>
      </AuthProvider>
    </ConnectivityProvider>
  </StrictMode>,
);
