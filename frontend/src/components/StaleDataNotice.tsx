import { useTranslation } from "react-i18next";
import { DEFAULT_TIME_ZONE, formatDateTimeShortInZone } from "../utils/dateTime";
import { Notice } from "./Notice";

export interface StaleDataNoticeProps {
  /** Os dados vieram do cache local por falta de conexão */
  stale: boolean;
  /** Quando os dados vieram do servidor (ISO) */
  fetchedAt: string | null;
  /** Fuso da empresa (padrão `America/Sao_Paulo`) */
  timeZone?: string;
  className?: string;
}

/** "Sem conexão — dados de 25/11 às 07:58." (components.md §9.2). Só aparece com dados antigos. */
export const StaleDataNotice = ({ stale, fetchedAt, timeZone = DEFAULT_TIME_ZONE, className }: StaleDataNoticeProps) => {
  const { t } = useTranslation();
  if (!stale || !fetchedAt) return null;
  const { date, time } = formatDateTimeShortInZone(fetchedAt, timeZone);
  return (
    <Notice variant="offline" className={className}>
      {t("comum:stale", { date, time })}
    </Notice>
  );
};

export default StaleDataNotice;
