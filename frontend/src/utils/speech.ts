import type { TFunction } from "i18next";
import { splitMinutes } from "./duration";

/** Duração por extenso para o leitor de tela: "1 hora e 15 minutos", "30 minutos". */
export const durationSpeech = (t: TFunction, totalMinutes: number): string => {
  const { hours, minutes } = splitMinutes(totalMinutes);
  const parts: string[] = [];
  if (hours > 0) parts.push(t("historico:duration.hours", { count: hours }));
  if (minutes > 0 || hours === 0) parts.push(t("historico:duration.minutes", { count: minutes }));
  return parts.length === 2 ? t("historico:duration.join", { a: parts[0], b: parts[1] }) : (parts[0] ?? "");
};

/** Iniciais (2 letras) para o avatar: "Ana Souza" → "AS". */
export const initialsOf = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.charAt(0) ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.charAt(0) ?? "") : (words[0]?.charAt(1) ?? "");
  return `${first}${last}`.toLocaleUpperCase("pt-BR");
};
