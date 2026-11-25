import { useTranslation } from "react-i18next";
import { CloudUpload, LoaderCircle, TriangleAlert } from "lucide-react";
import type { QueuedPunch } from "../types/punch";
import { cn } from "../utils/cn";
import { formatDateTimeShortInZone } from "../utils/dateTime";
import { Button } from "./Button";
import { Notice } from "./Notice";

export interface QueueIndicatorProps {
  /** Marcações aguardando envio */
  waiting: number;
  /** Envio em andamento */
  sending?: boolean;
  /** Recusadas pelo servidor (aviso persistente até dispensar) */
  rejected: QueuedPunch[];
  onDismiss: (clientId: string) => void;
  /** Fuso para exibir o horário das recusadas */
  timeZone: string;
  /** Nome da empresa de uma marcação recusada (quando diferente da ativa) */
  companyNameOf?: (companyId: number) => string | null;
  className?: string;
}

/**
 * Indicador da fila offline (components.md §9.3): pílula "2 aguardando envio" / "Enviando…" e
 * avisos de marcações recusadas (`future`/`too_old`) com "Entendi".
 */
export const QueueIndicator = ({
  waiting,
  sending = false,
  rejected,
  onDismiss,
  timeZone,
  companyNameOf,
  className,
}: QueueIndicatorProps) => {
  const { t } = useTranslation();
  if (waiting === 0 && !sending && rejected.length === 0) return null;

  return (
    <div className={cn("flex w-full flex-col items-center gap-3", className)}>
      {(waiting > 0 || sending) && (
        <p
          role="status"
          className="inline-flex min-h-touch items-center gap-2 rounded-full bg-offline-soft px-4 text-[0.9375rem] font-[650] text-offline"
        >
          {sending ? (
            <LoaderCircle aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" />
          ) : (
            <CloudUpload aria-hidden="true" className="size-5" />
          )}
          {sending ? (
            <span>{t("ponto:queue.sending", { count: waiting })}</span>
          ) : (
            <span>
              <strong>{waiting}</strong> {t("ponto:queue.waiting", { count: waiting })}
            </span>
          )}
        </p>
      )}
      {rejected.map((item) => {
        const { date, time } = formatDateTimeShortInZone(item.punchedAt, timeZone);
        const company = companyNameOf?.(item.companyId) ?? null;
        return (
          <Notice key={item.clientId} variant="danger" role="alert" icon={TriangleAlert} className="w-full">
            <p className="font-bold">{t("ponto:queue.rejectedTitle")}</p>
            <p>
              {t("ponto:queue.rejectedDetail", {
                date,
                time,
                reason: t(`ponto:queue.reasons.${item.rejectReason ?? "too_old"}`),
              })}
              {company ? ` ${t("ponto:queue.rejectedCompany", { name: company })}` : ""}
            </p>
            <Button variant="secondary" size="sm" className="mt-2" onClick={() => onDismiss(item.clientId)}>
              {t("ponto:queue.dismiss")}
            </Button>
          </Notice>
        );
      })}
    </div>
  );
};

export default QueueIndicator;
