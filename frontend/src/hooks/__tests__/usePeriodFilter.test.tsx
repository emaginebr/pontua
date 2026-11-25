import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { vi } from "vitest";
import { AuthProvider } from "../../Contexts/AuthContext";
import { CompanyProvider } from "../../Contexts/CompanyContext";
import { usePeriodFilter } from "../usePeriodFilter";

/** 25/11/2026 09:00 em Brasília. */
const NOW = new Date("2026-11-25T12:00:00Z");

const renderFilter = (initialEntry = "/historico") => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider>
      <CompanyProvider>
        <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
      </CompanyProvider>
    </AuthProvider>
  );
  return renderHook(
    () => {
      const filter = usePeriodFilter();
      const location = useLocation();
      return { filter, search: location.search };
    },
    { wrapper },
  );
};

describe("usePeriodFilter", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  it("abre no mês corrente do fuso da empresa", () => {
    const { result } = renderFilter();

    expect(result.current.filter.period).toEqual({ kind: "month", month: "2026-11" });
    expect(result.current.filter.query).toEqual({ month: "2026-11" });
    expect(result.current.filter.label).toBe("Novembro de 2026");
    expect(result.current.filter.canGoNext).toBe(false);
  });

  it("usa o fuso da empresa para decidir o mês na virada", () => {
    // 01/12 01:00 UTC ainda é 30/11 em Brasília
    vi.setSystemTime(new Date("2026-12-01T01:00:00Z"));
    const { result } = renderFilter();
    expect(result.current.filter.query).toEqual({ month: "2026-11" });
  });

  it("troca de mês com ‹ › e volta ao corrente sem parâmetro", () => {
    const { result } = renderFilter();

    act(() => result.current.filter.previousMonth());
    expect(result.current.search).toBe("?month=2026-10");
    expect(result.current.filter.label).toBe("Outubro de 2026");
    expect(result.current.filter.canGoNext).toBe(true);

    act(() => result.current.filter.previousMonth());
    expect(result.current.search).toBe("?month=2026-09");

    act(() => result.current.filter.nextMonth());
    act(() => result.current.filter.nextMonth());
    expect(result.current.search).toBe("");
    expect(result.current.filter.query).toEqual({ month: "2026-11" });
  });

  it("aplica e limpa um intervalo", () => {
    const { result } = renderFilter();

    act(() => result.current.filter.setRange("2026-11-01", "2026-11-15"));
    expect(result.current.search).toBe("?start=2026-11-01&end=2026-11-15");
    expect(result.current.filter.isRange).toBe(true);
    expect(result.current.filter.query).toEqual({ start: "2026-11-01", end: "2026-11-15" });
    expect(result.current.filter.label).toBe("01/11 – 15/11/2026");

    act(() => result.current.filter.clearRange());
    expect(result.current.search).toBe("");
    expect(result.current.filter.isRange).toBe(false);
  });

  it("lê mês e intervalo válidos da URL", () => {
    expect(renderFilter("/historico?month=2026-03").result.current.filter.query).toEqual({ month: "2026-03" });
    expect(renderFilter("/historico?start=2026-01-01&end=2026-12-31").result.current.filter.query).toEqual({
      start: "2026-01-01",
      end: "2026-12-31",
    });
  });

  it.each([
    "/historico?month=2026-13",
    "/historico?month=abc",
    "/historico?start=2026-11-10&end=2026-11-01",
    "/historico?start=2025-01-01&end=2026-11-25",
    "/historico?start=2026-11-01",
    "/historico?month=2026-10&start=2026-11-01&end=2026-11-02",
  ])("troca a URL inválida %s pelo mês corrente", (entry) => {
    const { result } = renderFilter(entry);

    expect(result.current.filter.query).toEqual({ month: "2026-11" });
    expect(result.current.search).toBe("");
  });

  it("preserva os outros parâmetros da URL", () => {
    const { result } = renderFilter("/aprovacoes?tipo=pending&month=2026-99");
    expect(result.current.search).toBe("?tipo=pending");

    act(() => result.current.filter.previousMonth());
    expect(result.current.search).toBe("?tipo=pending&month=2026-10");
  });
});
