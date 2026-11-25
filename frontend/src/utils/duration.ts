/**
 * Durações em minutos ↔ `hh:mm` e saldo com sinal sempre visível (Princípio IX: a informação
 * não depende só da cor). Saldo negativo usa o sinal de menos tipográfico U+2212.
 */

/** Sinal de menos (U+2212) — nunca hífen (docs/design/DESIGN_DIRECTION.md §2). */
export const MINUS_SIGN = "−";

const HHMM_PATTERN = /^(\d{1,3}):([0-5]\d)$/;

const pad = (value: number): string => String(value).padStart(2, "0");

/** Horas e minutos absolutos de uma duração. */
export interface DurationParts {
  hours: number;
  minutes: number;
}

/** Separa minutos em horas e minutos (valor absoluto). */
export const splitMinutes = (totalMinutes: number): DurationParts => {
  const abs = Math.abs(Math.trunc(totalMinutes));
  return { hours: Math.floor(abs / 60), minutes: abs % 60 };
};

/** Minutos → `hh:mm` sem sinal (horas podem passar de 24: "44:00"). */
export const minutesToHhmm = (totalMinutes: number): string => {
  const { hours, minutes } = splitMinutes(totalMinutes);
  return `${pad(hours)}:${pad(minutes)}`;
};

/** `hh:mm` (ou `h:mm`) → minutos; `null` se inválido. */
export const hhmmToMinutes = (value: string): number | null => {
  const match = HHMM_PATTERN.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

export type BalanceTone = "positive" | "negative" | "zero";

/** Tom do saldo (cor complementar ao sinal). */
export const balanceTone = (balanceMinutes: number): BalanceTone => {
  if (balanceMinutes > 0) return "positive";
  if (balanceMinutes < 0) return "negative";
  return "zero";
};

/** Saldo com sinal sempre visível: "+01:15", "−00:30", "00:00". */
export const formatBalance = (balanceMinutes: number): string => {
  const tone = balanceTone(balanceMinutes);
  const value = minutesToHhmm(balanceMinutes);
  if (tone === "positive") return `+${value}`;
  if (tone === "negative") return `${MINUS_SIGN}${value}`;
  return value;
};
