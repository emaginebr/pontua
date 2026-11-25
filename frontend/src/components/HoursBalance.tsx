import { useTranslation } from "react-i18next";
import { cn } from "../utils/cn";
import { balanceTone, formatBalance, minutesToHhmm } from "../utils/duration";
import { durationSpeech } from "../utils/speech";

const TONE_CLASSES = {
  positive: "text-success",
  negative: "text-danger",
  zero: "text-muted",
} as const;

export interface HoursBalanceProps {
  /** Saldo em minutos */
  minutes: number;
  /** `display` (totais) ou `sm` (dia/semana) */
  size?: "display" | "sm";
  className?: string;
}

/**
 * Saldo `±hh:mm` com sinal sempre visível e cor complementar (components.md §3.2). O leitor de
 * tela ouve "Saldo: mais 1 hora e 15 minutos".
 */
export const HoursBalance = ({ minutes, size = "sm", className }: HoursBalanceProps) => {
  const { t } = useTranslation();
  const tone = balanceTone(minutes);
  return (
    <span
      className={cn(
        "font-bold tabular-nums",
        size === "display" ? "text-[1.375rem] leading-7 font-[750] tracking-tight" : "text-body-sm",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <span aria-hidden="true">{formatBalance(minutes)}</span>
      <span className="sr-only">{t(`historico:balance.${tone}`, { value: durationSpeech(t, minutes) })}</span>
    </span>
  );
};

/** "08:50 / 08:48" com texto acessível "trabalhado 8 horas e 50 minutos de 8 horas e 48 minutos". */
export const WorkedOfExpected = ({ worked, expected, className }: { worked: number; expected: number; className?: string }) => {
  const { t } = useTranslation();
  return (
    <span className={cn("tabular-nums", className)}>
      <span aria-hidden="true">{`${minutesToHhmm(worked)} / ${minutesToHhmm(expected)}`}</span>
      <span className="sr-only">
        {t("historico:workedOf", { worked: durationSpeech(t, worked), expected: durationSpeech(t, expected) })}
      </span>
    </span>
  );
};

export default HoursBalance;
