import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BriefcaseBusiness, ChevronRight, Plus } from "lucide-react";
import { buttonClasses } from "../components/buttonStyles";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { ScheduleSummary } from "../components/ScheduleSummary";
import { StaleDataNotice } from "../components/StaleDataNotice";
import { useCompany } from "../hooks/useCompany";
import { usePositions } from "../hooks/usePositions";
import { shapeFromInfo } from "../utils/schedule";

/** Cargos da empresa (`/empresa/cargos`, mockup position-editor.html §3): resumo da jornada e membros. */
const PositionsPage = () => {
  const { t } = useTranslation();
  const { activeCompany } = useCompany();
  const { positions, loading, error, stale, fetchedAt, load } = usePositions();

  useEffect(() => {
    void load();
  }, [load]);

  const newLink = (
    <Link to="/empresa/cargos/novo" className={buttonClasses({ size: "sm" })}>
      <Plus aria-hidden="true" className="size-5" />
      {t("cargos:new")}
    </Link>
  );

  return (
    <>
      <PageHeader title={t("cargos:title")} backTo="/empresa" actions={newLink} />
      <StaleDataNotice stale={stale} fetchedAt={fetchedAt} timeZone={activeCompany?.timeZone} className="mb-4" />
      {loading && positions.length === 0 ? (
        <LoadingState lines={5} />
      ) : error && positions.length === 0 ? (
        <ErrorState message={error} onRetry={() => void load()} retrying={loading} />
      ) : positions.length === 0 ? (
        <EmptyState icon={BriefcaseBusiness} title={t("cargos:empty")} description={t("cargos:emptyText")} />
      ) : (
        <ul className="divide-y divide-separator overflow-hidden rounded-card border border-separator bg-surface shadow-sm">
          {positions.map((position) => (
            <li key={position.positionId}>
              <Link
                to={`/empresa/cargos/${position.positionId}`}
                className="flex min-h-16 items-center gap-3 py-2.5 pr-3 pl-4 text-text hover:bg-surface-2"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-title-sm">{position.name}</span>
                  {position.currentSchedule ? (
                    <ScheduleSummary schedule={shapeFromInfo(position.currentSchedule)} />
                  ) : (
                    <span className="text-body-sm text-muted">{t("cargos:noCurrentSchedule")}</span>
                  )}
                  <span className="text-caption text-subtle">
                    {t("cargos:members", { count: position.activeMembers })}
                  </span>
                </span>
                <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
};

export default PositionsPage;
