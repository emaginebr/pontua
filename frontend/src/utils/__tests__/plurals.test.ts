import type { TFunction } from "i18next";
import i18n from "../../i18n";
import ptBR from "../../i18n/pt-BR.json";
import { durationSpeech } from "../speech";

/** Todas as chaves de `pt-BR.json` achatadas (`ns:a.b.c`). */
const flatten = (value: unknown, prefix: string, out: string[]): string[] => {
  if (value && typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([key, child]) =>
      flatten(child, prefix ? `${prefix}${prefix.includes(":") ? "." : ":"}${key}` : key, out),
    );
  } else {
    out.push(prefix);
  }
  return out;
};

describe("plurais pt-BR (N-05)", () => {
  const t = i18n.t.bind(i18n) as TFunction;

  it("duração zero fica no plural: '0 minutos', não '0 minuto'", () => {
    expect(durationSpeech(t, 0)).toBe("0 minutos");
    expect(durationSpeech(t, 1)).toBe("1 minuto");
    expect(durationSpeech(t, 60)).toBe("1 hora");
    expect(durationSpeech(t, 121)).toBe("2 horas e 1 minuto");
    expect(t("historico:workedOf", { worked: durationSpeech(t, 0), expected: durationSpeech(t, 0) })).toBe(
      "trabalhado 0 minutos de 0 minutos previstos",
    );
  });

  it("contagens com zero usam a forma certa", () => {
    expect(t("cargos:editor.dayPeriods", { count: 0 })).toBe("0 períodos");
    expect(t("cargos:editor.dayPeriods", { count: 1 })).toBe("1 período");
    expect(t("cargos:editor.daySummary", { count: 0, load: "—" })).toBe("0 períodos · —");
    expect(t("cargos:summary.punches", { count: 0 })).toBe("0 marcações");
    expect(t("historico:day.pending", { count: 0 })).toBe("0 pendentes");
    expect(t("empresa:hub.days", { count: 0 })).toBe("0 dias");
    expect(t("aprovacoes:people", { count: 0 })).toBe("0 pessoas");
    expect(t("membros:manager.count", { count: 0 })).toBe("0 cargos");
  });

  it("toda chave com `_one` tem `_zero` (pt-BR trata 0 como `one`)", () => {
    const keys = flatten(ptBR, "", []);
    const ones = keys.filter((key) => key.endsWith("_one"));
    expect(ones.length).toBeGreaterThan(0);
    const missingZero = ones.filter((key) => !keys.includes(key.replace(/_one$/, "_zero")));
    expect(missingZero).toEqual([]);
  });
});
