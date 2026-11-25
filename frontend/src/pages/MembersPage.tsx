import { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight, UserPlus, Users } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { buttonClasses } from "../components/buttonStyles";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { RoleBadges } from "../components/RoleBadge";
import { SegmentedControl } from "../components/SegmentedControl";
import { Select } from "../components/Select";
import { StaleDataNotice } from "../components/StaleDataNotice";
import { useCompany } from "../hooks/useCompany";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { useMembers } from "../hooks/useMembers";
import { usePositions } from "../hooks/usePositions";
import { useRole } from "../hooks/useRole";
import type { MemberStatus } from "../types/member";
import { DEFAULT_TIME_ZONE, formatYmdNumeric, toYmdInZone } from "../utils/dateTime";

const STATUS_PARAM = "situacao";
const POSITION_PARAM = "cargo";
const INACTIVE_VALUE = "inativos";

/**
 * Membros (`/empresa/membros`, mockup members.html; US7, FR-020): ativos/inativos, filtro por
 * cargo e papel em texto + ícone. Gestor vê só os membros dos cargos que supervisiona.
 */
const MembersPage = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeCompany } = useCompany();
  const { isOwner, managedPositionIds } = useRole();
  const { members, loading, error, stale, fetchedAt, load } = useMembers();
  const isDesktop = useIsDesktop();
  const { positions, load: loadPositions } = usePositions();
  const timeZone = activeCompany?.timeZone ?? DEFAULT_TIME_ZONE;
  const myMemberId = activeCompany?.myAccess.memberId ?? null;
  const status: MemberStatus = searchParams.get(STATUS_PARAM) === INACTIVE_VALUE ? "inactive" : "active";
  const rawPosition = Number(searchParams.get(POSITION_PARAM));
  const positionId = Number.isInteger(rawPosition) && rawPosition > 0 ? rawPosition : null;

  useEffect(() => {
    void load("all", positionId);
  }, [load, positionId]);

  useEffect(() => {
    void loadPositions();
  }, [loadPositions]);

  const visiblePositions = useMemo(
    () => (isOwner ? positions : positions.filter((item) => managedPositionIds.includes(item.positionId))),
    [isOwner, positions, managedPositionIds],
  );

  const activeCount = members.filter((member) => member.status === "active").length;
  const inactiveCount = members.length - activeCount;
  const shown = members
    .filter((member) => member.status === status)
    .sort((a, b) => (a.memberId === myMemberId ? -1 : b.memberId === myMemberId ? 1 : a.name.localeCompare(b.name, "pt-BR")));

  const setParam = (key: string, value: string | null) => {
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous);
        if (value) params.set(key, value);
        else params.delete(key);
        return params;
      },
      { replace: true },
    );
  };

  const inviteLink = isOwner ? (
    <Link to="/empresa/convites" className={buttonClasses({ variant: "secondary", size: "sm" })}>
      <UserPlus aria-hidden="true" className="size-5" />
      {t("membros:invite")}
    </Link>
  ) : undefined;

  return (
    <>
      <PageHeader title={t("membros:title")} backTo="/empresa" actions={inviteLink} />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end">
        <SegmentedControl
          label={t("membros:statusFilter")}
          value={status}
          onChange={(value) => setParam(STATUS_PARAM, value === "inactive" ? INACTIVE_VALUE : null)}
          options={[
            { value: "active", label: t("membros:activeTab", { count: activeCount }) },
            { value: "inactive", label: t("membros:inactiveTab", { count: inactiveCount }) },
          ]}
          className="lg:flex-1"
        />
        <Select
          label={t("membros:positionFilter")}
          value={positionId !== null ? String(positionId) : ""}
          onChange={(event) => setParam(POSITION_PARAM, event.target.value || null)}
          containerClassName="lg:w-64"
        >
          <option value="">{t("aprovacoes:allPositions")}</option>
          {visiblePositions.map((position) => (
            <option key={position.positionId} value={position.positionId}>
              {position.name}
            </option>
          ))}
        </Select>
      </div>

      <StaleDataNotice stale={stale} fetchedAt={fetchedAt} timeZone={timeZone} className="mb-4" />

      {loading && members.length === 0 ? (
        <LoadingState lines={5} />
      ) : error && members.length === 0 ? (
        <ErrorState message={error} onRetry={() => void load("all", positionId)} retrying={loading} />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={Users}
          title={status === "active" ? t("membros:emptyActive") : t("membros:emptyInactive")}
          description={status === "active" && isOwner ? t("membros:emptyText") : undefined}
        />
      ) : (
        isDesktop ? (
          // ≥ 1024 px: tabela Nome · Cargo · Papel · Desde · Situação (components.md §11, I-17)
          <div className="overflow-hidden rounded-card border border-separator bg-surface shadow-sm">
            <table className="w-full border-collapse text-left text-body-sm">
              <caption className="sr-only">{t("membros:table.caption")}</caption>
              <thead className="border-b border-separator bg-surface-2 text-caption font-semibold text-muted">
                <tr>
                  <th scope="col" className="py-2.5 pr-3 pl-4 font-semibold">
                    {t("membros:table.name")}
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    {t("membros:table.position")}
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    {t("membros:table.role")}
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    {t("membros:table.since")}
                  </th>
                  <th scope="col" className="py-2.5 pr-4 pl-3 font-semibold">
                    {t("membros:table.status")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-separator">
                {shown.map((member) => (
                  // A linha toda é clicável pelo `after:` do link do nome (alvo acessível único)
                  <tr key={member.memberId} className="relative hover:bg-surface-2">
                    <td className="py-2.5 pr-3 pl-4 align-middle">
                      <span className="flex items-center gap-3">
                        <Avatar name={member.name} inactive={member.status === "inactive"} />
                        <Link
                          to={`/empresa/membros/${member.memberId}`}
                          className="min-w-0 font-bold break-words text-text no-underline after:absolute after:inset-0 hover:underline"
                        >
                          {member.name}
                          {member.memberId === myMemberId && (
                            <span className="font-medium text-muted"> {t("membros:you")}</span>
                          )}
                        </Link>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 align-middle break-words text-text">
                      {member.position?.name ?? t("empresa:hub.noPosition")}
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      {/* "Inativo" fica na coluna Situação */}
                      <RoleBadges member={{ ...member, status: "active" }} />
                    </td>
                    <td className="px-3 py-2.5 align-middle whitespace-nowrap tabular-nums text-muted">
                      {formatYmdNumeric(toYmdInZone(member.joinedAt, timeZone))}
                    </td>
                    <td className="py-2.5 pr-4 pl-3 align-middle text-text">
                      {member.status === "active" ? t("membros:table.active") : t("membros:table.inactive")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="divide-y divide-separator overflow-hidden rounded-card border border-separator bg-surface shadow-sm">
            {shown.map((member) => (
              <li key={member.memberId}>
                <Link
                  to={`/empresa/membros/${member.memberId}`}
                  className="flex min-h-16 items-center gap-3 py-2.5 pr-3 pl-4 text-text hover:bg-surface-2"
                >
                  <Avatar name={member.name} inactive={member.status === "inactive"} />
                  {/* Nome quebra linha, nunca reticências (B-03); papel na linha do cargo; "desde" à parte */}
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-bold break-words">
                      {member.name}
                      {member.memberId === myMemberId && (
                        <span className="font-medium text-muted"> {t("membros:you")}</span>
                      )}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-muted">
                      <span className="break-words">{member.position?.name ?? t("empresa:hub.noPosition")}</span>
                      <RoleBadges member={member} />
                    </span>
                    <span className="text-caption text-muted">
                      {t("membros:since", { date: formatYmdNumeric(toYmdInZone(member.joinedAt, timeZone)) })}
                    </span>
                  </span>
                  <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )
      )}
    </>
  );
};

export default MembersPage;
