import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ptBR from "./pt-BR.json";

/** Idioma único desta versão (FR-005); textos centralizados para tradução futura. */
export const DEFAULT_LANGUAGE = "pt-BR";

/** Namespaces por área (chaves de primeiro nível de `pt-BR.json`). */
export const NAMESPACES = Object.keys(ptBR) as Array<keyof typeof ptBR>;

void i18n.use(initReactI18next).init({
  resources: { [DEFAULT_LANGUAGE]: ptBR },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  ns: NAMESPACES,
  defaultNS: "comum",
  // Recursos embutidos: inicialização síncrona (sem piscar textos e sem Suspense)
  initAsync: false,
  interpolation: { escapeValue: false },
});

export default i18n;
