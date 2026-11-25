import type { ReactNode } from "react";
import { CircleCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LOGO_HEIGHT, LOGO_SRC, LOGO_WIDTH } from "../utils/assets";
import { SkipLink } from "./SkipLink";

export interface PublicLayoutProps {
  /** Frase do painel da marca (≥ 1024 px) */
  headline: string;
  /** Texto de apoio do painel */
  text: string;
  /** Benefícios listados no painel */
  bullets: string[];
  children: ReactNode;
}

/**
 * Telas públicas (mockup login.html): uma coluna com a logo no celular; no computador, painel
 * navy da marca à esquerda (logo num selo branco — ela só funciona sobre fundo claro). O
 * painel é decorativo (`aria-hidden`): o conteúdo essencial está no formulário.
 */
export const PublicLayout = ({ headline, text, bullets, children }: PublicLayoutProps) => {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-dvh bg-bg">
      <SkipLink />
      <aside
        aria-hidden="true"
        className="on-dark relative hidden w-[46%] flex-col justify-between overflow-hidden bg-[linear-gradient(160deg,var(--pt-brand-navy),var(--pt-brand-navy-2))] px-14 py-12 text-on-dark lg:flex"
      >
        <div className="self-start rounded-lg bg-surface px-[18px] py-3.5">
          <img src={LOGO_SRC} alt="" width={LOGO_WIDTH} height={LOGO_HEIGHT} className="block h-11 w-auto" />
        </div>
        <div>
          <p className="max-w-[16ch] text-[2.25rem] leading-[2.75rem] font-[750] tracking-tight">{headline}</p>
          <p className="mt-3 max-w-[40ch] text-on-dark-muted">{text}</p>
        </div>
        <ul className="flex flex-col gap-3 text-[0.9375rem] text-on-dark-muted">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex items-center gap-2.5">
              <CircleCheck className="size-5 text-brand-leaf" />
              {bullet}
            </li>
          ))}
        </ul>
        <span className="pointer-events-none absolute -right-20 -bottom-30 h-60 w-90 -rotate-[18deg] rounded-[100%_0_100%_0] bg-brand-leaf opacity-[0.08]" />
      </aside>
      <main
        id="conteudo"
        tabIndex={-1}
        className="flex flex-1 flex-col items-center px-4 pt-7 pb-8 lg:justify-center lg:p-12"
      >
        <div className="flex w-full max-w-[440px] flex-col gap-4">
          <img
            src={LOGO_SRC}
            alt={t("comum:appName")}
            width={LOGO_WIDTH}
            height={LOGO_HEIGHT}
            className="mb-2 h-12 w-auto self-center lg:hidden"
          />
          {children}
        </div>
      </main>
    </div>
  );
};

export default PublicLayout;
