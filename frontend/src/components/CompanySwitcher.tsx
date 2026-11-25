import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Building2, Check, ChevronsUpDown, CloudUpload, Link as LinkIcon } from "lucide-react";
import { useCompany } from "../hooks/useCompany";
import { usePunchQueue } from "../hooks/usePunchQueue";
import { useRole } from "../hooks/useRole";
import type { CompanySummary } from "../types/company";
import { cn } from "../utils/cn";
import { notifyError } from "../utils/notify";
import { toErrorMessage } from "../Services/apiClient";
import { buttonClasses } from "./buttonStyles";
import { Modal, ModalBody, ModalContent, ModalDescription, ModalHeader, ModalTitle } from "./Modal";

export interface CompanySwitcherProps {
  className?: string;
}

const roleKeyOf = (company: CompanySummary): "owner" | "manager" | "member" =>
  company.isOwner ? "owner" : company.isManager ? "manager" : "member";

/**
 * Seletor de empresa sempre acessível (FR-010, components.md §1.1): botão com nome + papel que
 * abre a folha "Trocar de empresa" (lista em `radio`, "Criar empresa", "Tenho um convite").
 */
export const CompanySwitcher = ({ className }: CompanySwitcherProps) => {
  const { t } = useTranslation();
  const { companies, activeCompany, selectCompany, loading } = useCompany();
  const { role } = useRole();
  const { waitingFor } = usePunchQueue();
  const [open, setOpen] = useState(false);

  if (!activeCompany) return null;

  const choose = async (companyId: number) => {
    if (companyId === activeCompany.companyId) {
      setOpen(false);
      return;
    }
    try {
      await selectCompany(companyId);
      setOpen(false);
    } catch (err) {
      notifyError(toErrorMessage(err));
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cn(
          "flex min-h-touch min-w-0 items-center gap-2 rounded-control px-2 py-1 text-left hover:bg-surface-2",
          className,
        )}
      >
        {/* I-06: sem `aria-label` — o nome é o texto visível ("Padaria Sol Responsável") + a ação
            em `sr-only` no fim (", trocar de empresa") */}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="line-clamp-2 text-title-sm text-text">{activeCompany.name}</span>{" "}
          <span className="text-caption text-muted">
            {t(`comum:roles.${role}`)}
            <span className="sr-only">{t("comum:companySwitcher.action")}</span>
          </span>
        </span>
        <ChevronsUpDown aria-hidden="true" className="size-5 shrink-0 text-muted" />
      </button>

      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>{t("comum:companySwitcher.title")}</ModalTitle>
            <ModalDescription>{t("comum:companySwitcher.description")}</ModalDescription>
          </ModalHeader>
          <ModalBody>
            <fieldset className="flex flex-col gap-1" disabled={loading}>
              <legend className="sr-only">{t("comum:companySwitcher.title")}</legend>
              {companies.map((company) => {
                const checked = company.companyId === activeCompany.companyId;
                return (
                  <label
                    key={company.companyId}
                    className={cn(
                      "flex min-h-14 cursor-pointer items-center gap-3 rounded-control px-3 py-2",
                      checked ? "bg-primary-soft" : "hover:bg-surface-2",
                    )}
                  >
                    <input
                      type="radio"
                      name="empresa-ativa"
                      value={company.companyId}
                      checked={checked}
                      onChange={() => void choose(company.companyId)}
                      className="size-5 shrink-0 accent-(--pt-primary)"
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-body font-semibold text-text">{company.name}</span>
                      <span className="text-caption text-muted">{t(`comum:roles.${roleKeyOf(company)}`)}</span>
                      {waitingFor(company.companyId) > 0 && (
                        <span className="flex items-center gap-1 text-caption font-semibold text-offline">
                          <CloudUpload aria-hidden="true" className="size-3.5" />
                          {t("comum:companySwitcher.queued", { count: waitingFor(company.companyId) })}
                        </span>
                      )}
                    </span>
                    {checked && <Check aria-hidden="true" className="size-5 shrink-0 text-primary" />}
                  </label>
                );
              })}
            </fieldset>
            <div className="flex flex-col gap-2">
              <Link
                to="/empresas/nova"
                onClick={() => setOpen(false)}
                className={buttonClasses({ variant: "secondary", fullWidth: true })}
              >
                <Building2 aria-hidden="true" className="size-5" />
                {t("comum:companySwitcher.createCompany")}
              </Link>
              <Link
                to="/bem-vindo?convite=1"
                onClick={() => setOpen(false)}
                className={buttonClasses({ variant: "tertiary", fullWidth: true })}
              >
                <LinkIcon aria-hidden="true" className="size-5" />
                {t("comum:companySwitcher.haveInvite")}
              </Link>
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
};

export default CompanySwitcher;
