/**
 * Compartilhar/copiar links (convites): Web Share API quando existe, com a área de
 * transferência (`navigator.clipboard`) como alternativa.
 */

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

export interface LinkShareData {
  title: string;
  text: string;
  url: string;
}

/** O navegador oferece o menu nativo de compartilhar. */
export const canShare = (): boolean => typeof navigator !== "undefined" && typeof navigator.share === "function";

/** Copia o texto; `false` quando o navegador não permite. */
export const copyText = async (text: string): Promise<boolean> => {
  try {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

const isAbortError = (err: unknown): boolean =>
  typeof err === "object" && err !== null && "name" in err && (err as { name: unknown }).name === "AbortError";

/** Abre o menu nativo; sem suporte (ou erro), copia o link. Cancelar o menu não copia. */
export const shareLink = async (data: LinkShareData): Promise<ShareResult> => {
  if (canShare()) {
    try {
      await navigator.share(data);
      return "shared";
    } catch (err) {
      if (isAbortError(err)) return "cancelled";
    }
  }
  return (await copyText(data.url)) ? "copied" : "failed";
};
