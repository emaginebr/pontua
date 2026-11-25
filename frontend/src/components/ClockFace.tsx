import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useServerNow } from "../hooks/useServerNow";
import { cn } from "../utils/cn";
import { formatLongDateInZone, formatTimeInZone } from "../utils/dateTime";
import { findBrazilTimeZone } from "../utils/timeZones";

export interface ClockFaceProps {
  /** Fuso da empresa */
  timeZone: string;
  /** Sem conexão: a hora é a do aparelho corrigida pelo último `serverOffset` conhecido */
  offline?: boolean;
  /** Linha "Próxima: …" / "Sem jornada prevista hoje" */
  status?: ReactNode;
  /** Passos da jornada do dia */
  children?: ReactNode;
  className?: string;
}

/**
 * Relógio da tela de ponto (components.md §2.1): data longa, hora `HH:mm` no fuso da empresa
 * corrigida pelo `serverOffset` (research R-08). Atualiza a cada segundo, mas o `<time>` não é
 * região viva — o leitor de tela não é interrompido a cada troca.
 */
export const ClockFace = ({ timeZone, offline = false, status, children, className }: ClockFaceProps) => {
  const { t } = useTranslation();
  const now = useServerNow(1_000);
  const zone = findBrazilTimeZone(timeZone);
  const city = zone ? t(`empresa:timeZones.${zone.key}.city`) : timeZone;

  return (
    <div
      className={cn(
        "on-dark relative overflow-hidden rounded-xl bg-[linear-gradient(160deg,var(--pt-brand-navy)_0%,var(--pt-brand-navy-2)_100%)] px-[18px] pt-4 pb-3.5 text-on-dark",
        className,
      )}
    >
      <p className="text-body-sm font-[550] text-on-dark-muted">{formatLongDateInZone(now, timeZone)}</p>
      <time
        aria-live="off"
        dateTime={now.toISOString()}
        className="mt-1 mb-0.5 block text-clock tracking-tight tabular-nums"
      >
        {formatTimeInZone(now, timeZone)}
      </time>
      <p className="text-caption text-on-dark-muted">
        {offline ? t("ponto:clock.zoneOffline", { city }) : t("ponto:clock.zone", { city })}
      </p>
      {status}
      {children}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -bottom-15 h-30 w-45 -rotate-[18deg] rounded-[100%_0_100%_0] bg-brand-leaf opacity-[0.08]"
      />
    </div>
  );
};

export default ClockFace;
