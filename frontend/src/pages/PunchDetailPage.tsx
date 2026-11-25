import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { PunchBadge } from "../components/PunchBadge";
import { useCompany } from "../hooks/useCompany";
import { useHistory } from "../hooks/useHistory";
import { toErrorMessage } from "../Services/apiClient";
import type { PunchInfo, PunchStatusChangeInfo } from "../types/punch";
import { DEFAULT_TIME_ZONE, formatDateTimeShortInZone, formatYmdNumeric, formatYmdShort } from "../utils/dateTime";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** Rota de volta: a tela que abriu o detalhe (histórico, membro ou painel) ou o histórico. */
const backFrom = (state: unknown): string =>
  isRecord(state) && typeof state.from === "string" && state.from.startsWith("/") ? state.from : "/historico";

/**
 * Detalhe da marcação (`/historico/marcacao/:punchId`; US5, FR-017): dados, NSR, tipo,
 * justificativa, análise e histórico de status com quem, quando e motivo.
 */
const PunchDetailPage = () => {
  const { t } = useTranslation();
  const { punchId: rawId } = useParams();
  const location = useLocation();
  const backTo = backFrom(location.state);
  const punchId = Number(rawId);
  const validId = Number.isInteger(punchId) && punchId > 0;
  const { activeCompany } = useCompany();
  const { getPunch } = useHistory();
  const timeZone = activeCompany?.timeZone ?? DEFAULT_TIME_ZONE;
  const [punch, setPunch] = useState<PunchInfo | null>(null);
  const [loading, setLoading] = useState(validId);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!validId) return;
    try {
      setLoading(true);
      setError(null);
      setPunch(await getPunch(punchId));
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [validId, punchId, getPunch]);

  useEffect(() => {
    void load();
  }, [load]);

  const title = t("historico:detailTitle");

  if (!validId) {
    return (
      <>
        <PageHeader title={title} backTo={backTo} />
        <ErrorState title={t("historico:detail.notFound")} message={t("historico:detail.notFoundText")} />
      </>
    );
  }

  if (loading && !punch) {
    return (
      <>
        <PageHeader title={title} backTo={backTo} />
        <LoadingState lines={6} />
      </>
    );
  }

  if (!punch) {
    return (
      <>
        <PageHeader title={title} backTo={backTo} />
        <ErrorState message={error} onRetry={() => void load()} retrying={loading} />
      </>
    );
  }

  const at = (iso: string) => {
    const { date, time } = formatDateTimeShortInZone(iso, timeZone);
    return t("historico:detail.at", { date, time });
  };

  const statusLabel = (status: PunchInfo["status"]) => t(`historico:status.${status}`);

  const changeText = (change: PunchStatusChangeInfo): string => {
    const head =
      change.fromStatus === null
        ? t("historico:detail.created", { status: statusLabel(change.toStatus) })
        : t("historico:detail.changed", { from: statusLabel(change.fromStatus), to: statusLabel(change.toStatus) });
    return `${head} · ${t("historico:detail.by", { by: change.changedBy })} ${at(change.changedAt)}`;
  };

  const fields: Array<{ key: string; label: string; value: string }> = [
    { key: "period", label: t("historico:detail.period"), value: punch.periodName ?? t("ponto:extra") },
    { key: "date", label: t("historico:detail.date"), value: `${formatYmdShort(punch.workDate)} · ${formatYmdNumeric(punch.workDate)}` },
    { key: "time", label: t("historico:detail.time"), value: punch.localTime },
    { key: "kind", label: t("historico:detail.kind"), value: t(`historico:kinds.${punch.kind}`) },
    { key: "status", label: t("historico:detail.status"), value: statusLabel(punch.status) },
    { key: "nsr", label: t("historico:detail.nsr"), value: String(punch.nsr) },
    { key: "received", label: t("historico:detail.receivedAt"), value: at(punch.receivedAt) },
  ];
  if (punch.pendingReason)
    fields.push({
      key: "reason",
      label: t("historico:detail.pendingReason"),
      value: t(`historico:reasons.${punch.pendingReason}`),
    });

  const history = punch.statusHistory ?? [];

  return (
    <>
      <PageHeader
        title={title}
        subtitle={`${punch.periodName ?? t("ponto:extra")} · ${punch.localTime} · ${formatYmdShort(punch.workDate)}`}
        backTo={backTo}
      />
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start lg:gap-6">
        <section aria-labelledby="marcacao-dados" className="rounded-card border border-separator bg-surface p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 id="marcacao-dados" className="text-title-sm text-text">
              {t("historico:detail.data")}
            </h2>
            <PunchBadge punch={punch} />
          </div>
          <dl className="divide-y divide-separator">
            {fields.map((field) => (
              <div key={field.key} className="flex flex-col gap-0.5 py-2.5">
                <dt className="text-caption text-muted">{field.label}</dt>
                <dd className="text-body text-text tabular-nums">{field.value}</dd>
              </div>
            ))}
            {punch.replacesPunchId !== null && (
              <div className="flex flex-col gap-0.5 py-2.5">
                <dt className="text-caption text-muted">{t("historico:detail.replaces")}</dt>
                <dd>
                  <Link
                    to={`/historico/marcacao/${punch.replacesPunchId}`}
                    state={{ from: backTo }}
                    className="font-semibold text-primary underline"
                  >
                    {t("historico:detail.viewOriginal")}
                  </Link>
                </dd>
              </div>
            )}
          </dl>
        </section>

        <div className="flex flex-col gap-4">
          {punch.justification && (
            <section aria-labelledby="marcacao-justificativa" className="rounded-card border border-separator bg-surface p-4 shadow-sm">
              <h2 id="marcacao-justificativa" className="mb-2 text-title-sm text-text">
                {t("historico:day.justification")}
              </h2>
              <p className="rounded-sm bg-surface-2 px-3 py-2.5 text-body-sm">“{punch.justification}”</p>
            </section>
          )}
          {punch.review && (
            <section aria-labelledby="marcacao-analise" className="rounded-card border border-separator bg-surface p-4 shadow-sm">
              <h2 id="marcacao-analise" className="mb-2 text-title-sm text-text">
                {t("historico:detail.review")}
              </h2>
              <p className="text-body-sm">
                {t("historico:detail.reviewedBy", { status: statusLabel(punch.status), by: punch.review.by })} {at(punch.review.at)}
              </p>
              {punch.review.note && (
                <p className="mt-1 text-body-sm text-muted">{t("historico:day.reviewNote", { note: punch.review.note })}</p>
              )}
            </section>
          )}
          <section aria-labelledby="marcacao-historico" className="rounded-card border border-separator bg-surface p-4 shadow-sm">
            <h2 id="marcacao-historico" className="mb-2 text-title-sm text-text">
              {t("historico:detail.historyTitle")}
            </h2>
            {history.length === 0 ? (
              <p className="text-body-sm text-muted">{t("historico:detail.noHistory")}</p>
            ) : (
              <ol className="flex flex-col gap-3 border-l-2 border-separator pl-4">
                {history.map((change, index) => (
                  <li key={`${change.changedAt}-${index}`} className="flex flex-col gap-0.5">
                    <span className="text-body-sm font-semibold text-text">{changeText(change)}</span>
                    {change.note && (
                      <span className="text-caption text-muted">{t("historico:day.reviewNote", { note: change.note })}</span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </>
  );
};

export default PunchDetailPage;
