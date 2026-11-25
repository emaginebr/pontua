import { useCallback, useSyncExternalStore } from "react";

/** Dias em que o convite de instalação fica oculto depois de "Agora não". */
export const INSTALL_DISMISS_DAYS = 30;
/** Data (ISO) em que o convite foi dispensado (data-model.md §3). */
export const INSTALL_DISMISSED_STORAGE_KEY = "pontua:install-dismissed";

const DAY_MS = 24 * 60 * 60 * 1000;
const STANDALONE_QUERY = "(display-mode: standalone)";

/** Evento `beforeinstallprompt` (Chromium; não está no lib.dom). */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

export type InstallOutcome = "accepted" | "dismissed" | "unavailable";

interface InstallSnapshot {
  deferred: BeforeInstallPromptEvent | null;
  installed: boolean;
  dismissedAt: string | null;
}

const readDismissedAt = (): string | null => {
  try {
    const value = localStorage.getItem(INSTALL_DISMISSED_STORAGE_KEY);
    return value !== null && !Number.isNaN(Date.parse(value)) ? value : null;
  } catch {
    return null;
  }
};

const detectStandalone = (): boolean =>
  (typeof window.matchMedia === "function" && window.matchMedia(STANDALONE_QUERY).matches) ||
  (navigator as NavigatorWithStandalone).standalone === true;

let snapshot: InstallSnapshot = { deferred: null, installed: false, dismissedAt: null };
const listeners = new Set<() => void>();
let started = false;

const update = (patch: Partial<InstallSnapshot>): void => {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
};

/**
 * Começa a escutar `beforeinstallprompt`/`appinstalled`. Chamado em `main.tsx` antes do React
 * (o evento pode chegar cedo) e de novo, sem efeito, por cada hook.
 */
export const startInstallPromptCapture = (): void => {
  if (started || typeof window === "undefined") return;
  started = true;
  snapshot = { deferred: null, installed: detectStandalone(), dismissedAt: readDismissedAt() };
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    update({ deferred: event as BeforeInstallPromptEvent });
  });
  window.addEventListener("appinstalled", () => update({ deferred: null, installed: true }));
};

/** Restaura o estado (testes). */
export const resetInstallPromptState = (): void => {
  snapshot = { deferred: null, installed: detectStandalone(), dismissedAt: readDismissedAt() };
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void): (() => void) => {
  startInstallPromptCapture();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): InstallSnapshot => snapshot;

/** iPhone/iPod/iPad (inclui iPadOS que se apresenta como Mac com toque). */
const detectIos = (): boolean => {
  const userAgent = navigator.userAgent;
  const iPad = /iPad/.test(userAgent) || (/Macintosh/.test(userAgent) && (navigator.maxTouchPoints ?? 0) > 1);
  return /iPhone|iPod/.test(userAgent) || iPad;
};

export interface InstallPromptState {
  /** Já instalado / aberto como app */
  isInstalled: boolean;
  /** iOS: instalação manual pelo menu Compartilhar */
  isIos: boolean;
  /** Há prompt nativo disponível */
  canPromptNative: boolean;
  /** Algum caminho de instalação existe (nativo ou instruções do iOS) */
  canInstall: boolean;
  /** Convite (cartão) visível: instalável e não dispensado nos últimos 30 dias */
  showInvite: boolean;
  /** Abre o prompt nativo */
  promptInstall: () => Promise<InstallOutcome>;
  /** "Agora não": oculta o convite por 30 dias */
  dismiss: () => void;
}

/**
 * Instalação do PWA (research R-14): `beforeinstallprompt`, detecção de instalado, iOS com
 * instruções e dispensa por 30 dias em `pontua:install-dismissed`.
 */
export const useInstallPrompt = (): InstallPromptState => {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const isIos = detectIos();

  const promptInstall = useCallback(async (): Promise<InstallOutcome> => {
    const deferred = snapshot.deferred;
    if (!deferred) return "unavailable";
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      update({ deferred: null, installed: choice.outcome === "accepted" || snapshot.installed });
      return choice.outcome;
    } catch {
      update({ deferred: null });
      return "unavailable";
    }
  }, []);

  const dismiss = useCallback(() => {
    const now = new Date().toISOString();
    try {
      localStorage.setItem(INSTALL_DISMISSED_STORAGE_KEY, now);
    } catch {
      // Armazenamento negado: oculta só nesta sessão
    }
    update({ dismissedAt: now });
  }, []);

  const canPromptNative = state.deferred !== null && !state.installed;
  const canInstall = !state.installed && (canPromptNative || isIos);
  const recentlyDismissed =
    state.dismissedAt !== null && Date.now() - Date.parse(state.dismissedAt) < INSTALL_DISMISS_DAYS * DAY_MS;

  return {
    isInstalled: state.installed,
    isIos,
    canPromptNative,
    canInstall,
    showInvite: canInstall && !recentlyDismissed,
    promptInstall,
    dismiss,
  };
};

export default useInstallPrompt;
