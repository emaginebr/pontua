import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { cn } from "../utils/cn";

/** Depois da primeira tela, cada troca de rota leva o foco ao `h1` (components.md §1.1). */
let firstPageRendered = false;

export interface PageHeaderProps {
  /** Título da tela (`h1` e `document.title` "{título} · Pontua") */
  title: string;
  subtitle?: ReactNode;
  /** Ações (à direita ≥ 1024 px; abaixo, em largura total, no celular) */
  actions?: ReactNode;
  /** Link "Voltar" acima do título */
  backTo?: string;
  /** Título visualmente oculto (telas cuja identidade já está no layout) */
  hideTitle?: boolean;
  /** Título da aba quando diferente do `h1` (ex.: saudação) */
  documentTitle?: string;
  /** Título e subtítulo centralizados (telas públicas: login, cadastro) */
  centered?: boolean;
  className?: string;
}

/** Cabeçalho de tela (components.md §1.2). */
export const PageHeader = ({
  title,
  subtitle,
  actions,
  backTo,
  hideTitle = false,
  documentTitle,
  centered = false,
  className,
}: PageHeaderProps) => {
  const { t } = useTranslation();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const tabTitle = documentTitle ?? title;
  // `cn` não resolve conflito: com `mb-*` no className, a margem padrão sai (senão `mb-6` podia vencer)
  const customMargin = /(^|\s)mb-/.test(className ?? "");

  useEffect(() => {
    document.title = t("comum:pageTitle", { title: tabTitle });
  }, [t, tabTitle]);

  useEffect(() => {
    if (firstPageRendered) headingRef.current?.focus({ preventScroll: false });
    firstPageRendered = true;
  }, []);

  return (
    <header
      className={cn(
        "flex flex-col gap-3",
        !customMargin && "mb-6",
        centered ? "items-center text-center" : "lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      {/* Centralizado: o bloco do título ocupa a largura toda da coluna (revisão T070, I-01/I-02) */}
      <div className={cn("flex min-w-0 flex-col gap-1", centered && "w-full items-center")}>
        {backTo && (
          <Link
            to={backTo}
            className="-ml-1 inline-flex min-h-touch items-center gap-1 self-start rounded-control px-1 text-[0.9375rem] font-semibold text-primary"
          >
            <ChevronLeft aria-hidden="true" className="size-5" />
            {t("comum:back")}
          </Link>
        )}
        <h1 ref={headingRef} tabIndex={-1} className={cn("text-title-lg text-text", hideTitle && "sr-only")}>
          {title}
        </h1>
        {subtitle && <p className="text-body-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-col gap-2 lg:flex-row [&>*]:w-full lg:[&>*]:w-auto">{actions}</div>}
    </header>
  );
};

export default PageHeader;
