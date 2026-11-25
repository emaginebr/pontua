import { render, screen, within } from "@testing-library/react";
import { DayCard } from "../DayCard";
import { TIME_ZONE, TODAY, YESTERDAY, dayRecord, punch } from "../../test/fixtures";
import type { DayRecord, PunchInfo } from "../../types/punch";
import { buildDayRows, daysOffLabel } from "../../utils/dayRows";

/** Dia da revisão T070 (B-02): Entrada 19:03 válida, correção pendente 08:01 e inclusão pendente 13:02. */
const original = punch({ punchId: 5, localTime: "19:03", periodName: "Retorno", workDate: TODAY });
const correction = punch({
  punchId: 29,
  kind: "manual",
  status: "pending",
  pendingReason: "manual",
  localTime: "08:01",
  periodName: "Entrada",
  replacesPunchId: 5,
  countsAsWorked: false,
  justification: "Marquei errado na entrada.",
  workDate: TODAY,
});
const inclusion = punch({
  punchId: 30,
  kind: "manual",
  status: "pending",
  pendingReason: "manual",
  localTime: "13:02",
  periodName: "Pausa",
  countsAsWorked: false,
  justification: "Esqueci de marcar a pausa.",
  workDate: TODAY,
});

const periods = (ids: Array<number | null>): DayRecord["periods"] =>
  ["Entrada", "Pausa", "Retorno", "Saída"].map((name, index) => ({
    sequence: index + 1,
    name,
    expectedTime: ["08:00", "12:00", "13:00", "17:00"][index] ?? null,
    punchId: ids[index] ?? null,
  }));

const today = (periodIds: Array<number | null>, punches: PunchInfo[] = [correction, inclusion, original]): DayRecord =>
  dayRecord({ date: TODAY, hasPending: true, periods: periods(periodIds), punches });

const renderCard = (day: DayRecord) =>
  render(
    <DayCard
      day={day}
      today={TODAY}
      timeZone={TIME_ZONE}
      renderPunchAction={(item, name) => <button type="button">{`Ações da marcação ${name} ${item.localTime}`}</button>}
    />,
  );

describe("DayCard — par original/correção (B-02)", () => {
  it("desenha o par uma única vez, mesmo quando a API aponta dois períodos para ele", () => {
    // Resposta antiga da API: a correção pendente ocupa "Entrada" e a original foi para "Retorno"
    renderCard(today([29, 30, 5, null]));

    const card = screen.getByRole("article");
    expect(within(card).getAllByText("Correção pedida")).toHaveLength(1);
    expect(within(card).getAllByText("19:03")).toHaveLength(1);
    expect(within(card).getAllByText("08:01")).toHaveLength(1);
    expect(within(card).getAllByText("Original")).toHaveLength(1);
    // O par fica na linha do período da original
    const rows = within(card).getAllByRole("listitem");
    const retorno = rows.find((row) => within(row).queryByText("Retorno"));
    expect(retorno).toBeDefined();
    expect(within(retorno as HTMLElement).getByText("Correção pedida")).toBeInTheDocument();
    // Um único "⋯" na linha do par (o da correção pendente)
    expect(within(retorno as HTMLElement).getAllByRole("button")).toHaveLength(1);
    expect(within(retorno as HTMLElement).getByRole("button", { name: "Ações da marcação Retorno 08:01" })).toBeInTheDocument();
  });

  it("com a API corrigida (correção sem período) o par continua na linha da original", () => {
    renderCard(today([5, 30, null, null], [original, correction, inclusion]));

    const card = screen.getByRole("article");
    expect(within(card).getAllByText("Correção pedida")).toHaveLength(1);
    const entrada = within(card)
      .getAllByRole("listitem")
      .find((row) => within(row).queryByText("Entrada"));
    expect(within(entrada as HTMLElement).getByText("08:01")).toBeInTheDocument();
  });

  it("ordena os períodos pela sequência da jornada, não pelo horário das pendentes", () => {
    const rows = buildDayRows(today([29, 30, 5, null]));
    expect(rows.map((row) => row.name)).toEqual(["Entrada", "Pausa", "Retorno", "Saída"]);
    // A original aparece numa linha só
    expect(rows.filter((row) => row.punch?.punchId === 5)).toHaveLength(1);
  });

  it("extras entram pelo horário entre os períodos", () => {
    const extra = punch({ punchId: 40, localTime: "12:30", periodName: null, workDate: TODAY });
    const day = dayRecord({
      date: TODAY,
      periods: periods([41, 42, null, null]),
      punches: [
        punch({ punchId: 41, localTime: "08:00", periodName: "Entrada", workDate: TODAY }),
        punch({ punchId: 42, localTime: "12:00", periodName: "Pausa", workDate: TODAY }),
        extra,
      ],
    });
    expect(buildDayRows(day).map((row) => row.name ?? "Extra")).toEqual(["Entrada", "Pausa", "Extra", "Retorno", "Saída"]);
  });

  it("correção aprovada: original riscada com 'Substituída' na linha do período", () => {
    const superseded = { ...original, status: "superseded" as const, countsAsWorked: false };
    const approved = { ...correction, status: "approved" as const, countsAsWorked: true };
    renderCard(today([29, null, null, null], [approved, superseded]));

    const card = screen.getByRole("article");
    expect(within(card).getAllByText("Correção pedida")).toHaveLength(1);
    expect(within(card).getByText("Substituída")).toBeInTheDocument();
    expect(within(card).getByText("19:03")).toHaveClass("line-through");
  });
});

describe("DayCard — recolhido no celular (I-09) e folgas (I-08)", () => {
  it("dia passado sem pendência começa recolhido; hoje começa aberto", () => {
    const past = dayRecord({
      date: YESTERDAY,
      periods: periods([50, null, null, null]),
      punches: [punch({ punchId: 50, localTime: "08:00" })],
    });
    const { unmount } = render(<DayCard day={past} today={TODAY} timeZone={TIME_ZONE} />);
    expect(screen.getByRole("button", { expanded: false })).toBeInTheDocument();
    unmount();

    render(<DayCard day={today([5, null, null, null], [original])} today={TODAY} timeZone={TIME_ZONE} />);
    expect(screen.getByRole("button", { expanded: true })).toBeInTheDocument();
  });

  it("folgas: 2 dias listados, 3 ou mais viram intervalo", () => {
    const off = (date: string) => dayRecord({ date, isWorkDay: false });
    expect(daysOffLabel([off("2026-11-22"), off("2026-11-21")])).toBe("dom, 22 nov · sáb, 21 nov");
    expect(daysOffLabel([off("2026-11-17"), off("2026-11-16"), off("2026-11-01")])).toBe("1–17 nov");
  });
});
