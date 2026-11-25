import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import type { PunchInfo } from "../types/punch";
import { cn } from "../utils/cn";
import { isStruckPunch } from "../utils/dayRows";
import { PunchBadge } from "./PunchBadge";

export interface CorrectionPairProps {
  /** Marcação original */
  original: PunchInfo;
  /** Pedidos de correção da original (pendentes e analisados), em ordem */
  corrections: PunchInfo[];
  /** Conteúdo extra abaixo de cada correção (justificativa, quem analisou) */
  renderDetails?: (correction: PunchInfo) => ReactNode;
  className?: string;
}

/**
 * Par original → correção pedida, lado a lado (components.md §3.3, revisão T070 B-02/N-04): a
 * original aparece uma vez, só com o selo ao lado do horário (A-06), e cada pedido com o seu
 * horário e status. Usado no histórico (`DayCard`) e em "Marcações de hoje" (tela de ponto).
 */
export const CorrectionPair = ({ original, corrections, renderDetails, className }: CorrectionPairProps) => {
  const { t } = useTranslation();
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {corrections.map((correction, index) => (
        <div key={correction.punchId} className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-end gap-x-3 gap-y-1.5">
            {index === 0 && (
              <span className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "text-[1.0625rem] font-bold tabular-nums",
                    isStruckPunch(original) && "text-muted line-through",
                  )}
                >
                  {original.localTime}
                </span>
                {correction.status === "pending" ? (
                  <span className="inline-flex h-6 items-center rounded-sm bg-neutral-soft px-2 text-caption font-semibold text-neutral">
                    {t("historico:day.originalBadge")}
                  </span>
                ) : (
                  <PunchBadge punch={original} showExtra={false} />
                )}
              </span>
            )}
            {index === 0 && <ChevronRight aria-hidden="true" className="mb-1 size-4 shrink-0 text-muted" />}
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-caption text-muted">{t("historico:day.correction")}</span>
              <span className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "text-[1.0625rem] font-bold tabular-nums",
                    isStruckPunch(correction) && "text-muted line-through",
                  )}
                >
                  {correction.localTime}
                </span>
                <PunchBadge punch={correction} showExtra={false} />
              </span>
            </span>
          </div>
          {renderDetails?.(correction)}
        </div>
      ))}
    </div>
  );
};

export default CorrectionPair;
