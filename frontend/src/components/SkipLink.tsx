import { useTranslation } from "react-i18next";

/** "Pular para o conteúdo" — primeiro foco da página, visível só no foco (components.md §11). */
export const SkipLink = () => {
  const { t } = useTranslation();
  return (
    <a
      href="#conteudo"
      className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-(--z-toast) focus:inline-flex focus:min-h-touch focus:items-center focus:rounded-control focus:bg-primary focus:px-4 focus:text-on-primary"
    >
      {t("comum:skipToContent")}
    </a>
  );
};

export default SkipLink;
