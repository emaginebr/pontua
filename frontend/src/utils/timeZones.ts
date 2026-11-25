/**
 * Fusos do Brasil (IANA) oferecidos ao criar/editar a empresa. Os rótulos ficam no i18n
 * (`empresa:timeZones.{key}.label` e `.city`). Padrão: `America/Sao_Paulo` (horário de Brasília).
 */
import type { TFunction } from "i18next";
import { DEFAULT_TIME_ZONE } from "./dateTime";

export interface BrazilTimeZone {
  /** ID IANA enviado à API */
  id: string;
  /** Chave do rótulo no i18n */
  key: string;
}

export const BRAZIL_TIME_ZONES: readonly BrazilTimeZone[] = [
  { id: "America/Noronha", key: "noronha" },
  { id: "America/Sao_Paulo", key: "saoPaulo" },
  { id: "America/Bahia", key: "bahia" },
  { id: "America/Fortaleza", key: "fortaleza" },
  { id: "America/Recife", key: "recife" },
  { id: "America/Maceio", key: "maceio" },
  { id: "America/Belem", key: "belem" },
  { id: "America/Santarem", key: "santarem" },
  { id: "America/Araguaina", key: "araguaina" },
  { id: "America/Manaus", key: "manaus" },
  { id: "America/Cuiaba", key: "cuiaba" },
  { id: "America/Campo_Grande", key: "campoGrande" },
  { id: "America/Porto_Velho", key: "portoVelho" },
  { id: "America/Boa_Vista", key: "boaVista" },
  { id: "America/Rio_Branco", key: "rioBranco" },
  { id: "America/Eirunepe", key: "eirunepe" },
];

export const DEFAULT_COMPANY_TIME_ZONE = DEFAULT_TIME_ZONE;

/** Fuso do Brasil pelo ID IANA. */
export const findBrazilTimeZone = (id: string | null | undefined): BrazilTimeZone | undefined =>
  BRAZIL_TIME_ZONES.find((zone) => zone.id === id);

/**
 * Ajuda do campo de fuso: estados do fuso escolhido + explicação. As opções ficam curtas
 * ("Brasília (UTC−3)") para não cortar no celular (revisão T070, I-18).
 */
export const timeZoneHelp = (t: TFunction, id: string | null | undefined): string => {
  const zone = findBrazilTimeZone(id);
  const help = t("empresa:new.timeZoneHelp");
  return zone ? `${t("empresa:new.timeZoneStates", { states: t(`empresa:timeZones.${zone.key}.states`) })} ${help}` : help;
};

/** Fuso do aparelho (IANA), se o navegador informar. */
export const deviceTimeZone = (): string | null => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
};
