import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BriefcaseBusiness, ChevronRight, Settings, UserPlus, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { StaleDataNotice } from "../components/StaleDataNotice";
import { useCompany } from "../hooks/useCompany";
import { useRole } from "../hooks/useRole";
import { findBrazilTimeZone } from "../utils/timeZones";

interface Shortcut {
  key: "positions" | "invitations" | "members" | "settings";
  to: string;
  icon: LucideIcon;
  /** `owner` = só responsável; `supervisor` = responsável ou gestor */
  role: "owner" | "supervisor";
}

const SHORTCUTS: Shortcut[] = [
  { key: "positions", to: "/empresa/cargos", icon: BriefcaseBusiness, role: "owner" },
  { key: "invitations", to: "/empresa/convites", icon: UserPlus, role: "owner" },
  { key: "members", to: "/empresa/membros", icon: Users, role: "supervisor" },
  { key: "settings", to: "/empresa/configuracoes", icon: Settings, role: "owner" },
];

/**
 * Hub "Empresa" (`/empresa`; US3, FR-011): informações para todos e atalhos de configuração só
 * para quem pode usá-los (cargos, convites e configurações: responsável; membros: também gestor).
 */
const CompanyPage = () => {
  const { t } = useTranslation();
  const { activeCompany, me, stale, fetchedAt } = useCompany();
  const { isOwner, canSupervise, role } = useRole();

  if (!activeCompany) return null;

  const zone = findBrazilTimeZone(activeCompany.timeZone);
  const shortcuts = SHORTCUTS.filter((item) => (item.role === "owner" ? isOwner : canSupervise));

  const info: Array<{ key: string; label: string; value: string }> = [
    { key: "owner", label: t("empresa:hub.owner"), value: activeCompany.owner.name },
    {
      key: "document",
      label: t("empresa:hub.document"),
      value: activeCompany.document ?? t("empresa:hub.noDocument"),
    },
    {
      key: "timeZone",
      label: t("empresa:hub.timeZone"),
      value: zone ? t(`empresa:timeZones.${zone.key}.label`) : activeCompany.timeZone,
    },
    {
      key: "retro",
      label: t("empresa:hub.manualRetro"),
      value: t("empresa:hub.days", { count: activeCompany.manualRetroDays }),
    },
    { key: "role", label: t("empresa:hub.myRole"), value: t(`comum:roles.${role}`) },
    { key: "position", label: t("empresa:hub.myPosition"), value: me?.position?.name ?? t("empresa:hub.noPosition") },
  ];

  return (
    <>
      <PageHeader title={t("empresa:title")} subtitle={activeCompany.name} />
      <StaleDataNotice stale={stale} fetchedAt={fetchedAt} timeZone={activeCompany.timeZone} className="mb-4" />
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start lg:gap-6">
        {shortcuts.length > 0 && (
          <section aria-labelledby="empresa-atalhos">
            <h2 id="empresa-atalhos" className="mb-2 text-title-sm text-text">
              {t("empresa:hub.manage")}
            </h2>
            <ul className="divide-y divide-separator overflow-hidden rounded-card border border-separator bg-surface shadow-sm">
              {shortcuts.map(({ key, to, icon: Icon }) => (
                <li key={key}>
                  <Link to={to} className="flex min-h-16 items-center gap-3 px-4 py-2.5 text-text hover:bg-surface-2">
                    <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-primary-soft text-primary">
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-title-sm">{t(`empresa:hub.shortcuts.${key}.title`)}</span>
                      <span className="text-body-sm text-muted">{t(`empresa:hub.shortcuts.${key}.text`)}</span>
                    </span>
                    <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section aria-labelledby="empresa-info">
          <h2 id="empresa-info" className="mb-2 text-title-sm text-text">
            {t("empresa:hub.info")}
          </h2>
          <dl className="divide-y divide-separator rounded-card border border-separator bg-surface px-4 shadow-sm">
            {info.map((item) => (
              <div key={item.key} className="flex flex-col gap-0.5 py-3">
                <dt className="text-caption text-muted">{item.label}</dt>
                <dd className="text-body text-text">{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </>
  );
};

export default CompanyPage;
