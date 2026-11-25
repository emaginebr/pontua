import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { ScheduleEditor } from "../ScheduleEditor";
import { setMatchMedia } from "../../test/matchMedia";
import type { ScheduleInput } from "../../types/schedule";
import {
  defaultScheduleDraft,
  mapApiScheduleErrors,
  shapeFromDraft,
  summarizeSchedule,
  switchMode,
  toScheduleInput,
  validateScheduleDraft,
} from "../../utils/schedule";
import type { ScheduleDraft, ScheduleErrors } from "../../utils/schedule";

const TODAY = "2026-11-25";

interface HarnessProps {
  initial?: ScheduleDraft;
  onSubmit: (input: ScheduleInput) => void;
}

/** Formulário mínimo: valida no envio e entrega o `ScheduleInput`. */
const Harness = ({ initial, onSubmit }: HarnessProps) => {
  const [draft, setDraft] = useState<ScheduleDraft>(() => initial ?? defaultScheduleDraft(TODAY));
  const [errors, setErrors] = useState<ScheduleErrors>({});
  return (
    <main>
      <h1>Cargo</h1>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const next = validateScheduleDraft(draft, TODAY);
          setErrors(next);
          if (Object.keys(next).length === 0) onSubmit(toScheduleInput(draft));
        }}
      >
        <ScheduleEditor value={draft} onChange={setDraft} errors={errors} today={TODAY} idPrefix="j" />
        <p data-testid="resumo">{summarizeSchedule(shapeFromDraft(draft))}</p>
        <button type="submit">Salvar cargo</button>
      </form>
    </main>
  );
};

const setup = (initial?: ScheduleDraft) => {
  const onSubmit = vi.fn<(input: ScheduleInput) => void>();
  const view = render(<Harness initial={initial} onSubmit={onSubmit} />);
  return { onSubmit, view, user: userEvent.setup() };
};

describe("ScheduleEditor", () => {
  it("modo semanal vira ScheduleInput com cargas em minutos, sem violações", async () => {
    const { onSubmit, view, user } = setup();

    await user.click(screen.getByRole("checkbox", { name: "Sábado" }));
    const weekly = screen.getByLabelText("Carga semanal");
    await user.clear(weekly);
    await user.type(weekly, "44:00");
    const names = screen.getAllByLabelText("Nome do período");
    await user.clear(names[3] as HTMLElement);
    await user.type(names[3] as HTMLElement, "Saída final");
    expect(screen.getByTestId("resumo")).toHaveTextContent("Seg–Sáb · 4 marcações · 44 h/semana");
    expect(await axe(view.container)).toHaveNoViolations();

    await user.click(screen.getByRole("button", { name: "Salvar cargo" }));

    expect(onSubmit).toHaveBeenCalledWith({
      mode: "weekly",
      effectiveFrom: TODAY,
      weeklyMinutes: 2640,
      workDays: [1, 2, 3, 4, 5, 6],
      dailyMinutes: 480,
      periods: [
        { name: "Entrada", expectedTime: "08:00" },
        { name: "Pausa", expectedTime: "12:00" },
        { name: "Retorno", expectedTime: "13:00" },
        { name: "Saída final", expectedTime: "17:00" },
      ],
    });
  });

  it("reordena com botões acessíveis e aponta horário fora de ordem no campo exato", async () => {
    const { onSubmit, user } = setup();

    await user.click(screen.getByRole("button", { name: "Mover Pausa para cima" }));
    // O foco continua num botão do mesmo período (agora no topo: a seta para baixo)
    expect(screen.getByRole("button", { name: "Mover Pausa para baixo" })).toHaveFocus();
    expect(screen.getAllByLabelText("Nome do período").map((input) => (input as HTMLInputElement).value)).toEqual([
      "Pausa",
      "Entrada",
      "Retorno",
      "Saída",
    ]);

    await user.click(screen.getByRole("button", { name: "Salvar cargo" }));

    expect(onSubmit).not.toHaveBeenCalled();
    const times = screen.getAllByLabelText(/^Previsto/);
    expect(times[1]).toHaveAttribute("aria-invalid", "true");
    expect(times[1]).toHaveAccessibleDescription("O horário deve ser depois de Pausa (12:00).");
  });

  it("valida nenhum dia útil, período sem nome e carga fora do formato", async () => {
    const { onSubmit, view, user } = setup();

    for (const day of ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"]) {
      await user.click(screen.getByRole("checkbox", { name: day }));
    }
    await user.clear(screen.getAllByLabelText("Nome do período")[1] as HTMLElement);
    const daily = screen.getByLabelText("Carga diária");
    await user.clear(daily);
    await user.type(daily, "8h");
    await user.click(screen.getByRole("button", { name: "Salvar cargo" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Escolha pelo menos um dia útil.")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Nome do período")[1]).toHaveAccessibleDescription("Dê um nome ao período.");
    expect(daily).toHaveAccessibleDescription(/Informe no formato hh:mm/);
    expect(await axe(view.container)).toHaveNoViolations();
  });

  it("modo diário: sábado diferente e 'copiar de outro dia'", async () => {
    const { onSubmit, view, user } = setup();

    await user.click(screen.getByRole("radio", { name: "Diferente por dia" }));
    await user.click(screen.getByRole("switch", { name: "Sábado é dia útil" }));
    const saturday = view.container.querySelector("#j-dia-6") as HTMLElement;
    expect(saturday).not.toBeNull();
    await user.click(within(saturday).getByRole("button", { name: "Remover Saída" }));
    await user.click(within(saturday).getByRole("button", { name: "Remover Retorno" }));
    const load = within(saturday).getByLabelText("Carga do dia");
    await user.clear(load);
    await user.type(load, "04:00");
    expect(screen.getByTestId("resumo")).toHaveTextContent("Seg–Sáb · 4 marcações (Sáb: 2) · 40 h/semana");

    await user.click(screen.getByRole("button", { name: "Salvar cargo" }));
    const input = onSubmit.mock.calls[0]?.[0];
    expect(input?.mode).toBe("daily");
    expect(input?.days?.map((day) => day.dayOfWeek)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(input?.days?.[5]).toEqual({
      dayOfWeek: 6,
      dailyMinutes: 240,
      periods: [
        { name: "Entrada", expectedTime: "08:00" },
        { name: "Pausa", expectedTime: "12:00" },
      ],
    });

    // Copiar de Segunda para Sábado
    await user.click(within(saturday).getByRole("button", { name: "Copiar de outro dia" }));
    const dialog = await screen.findByRole("dialog", { name: "Copiar para Sábado" });
    await user.click(within(dialog).getByRole("button", { name: /^Segunda/ }));
    expect(within(saturday).getAllByLabelText("Nome do período")).toHaveLength(4);
    expect(within(saturday).getByLabelText("Carga do dia")).toHaveValue("08:00");
  });

  it("modo diário ≥ 1024 px: dias em lista vertical e o dia escolhido no painel ao lado (I-14), sem violações", async () => {
    setMatchMedia((query) => query === "(min-width: 1024px)");
    const { view, user } = setup();

    await user.click(screen.getByRole("radio", { name: "Diferente por dia" }));
    const days = screen.getByRole("list", { name: "Dias da semana" });
    expect(within(days).getAllByRole("listitem")).toHaveLength(7);
    // Sem acordeão: o primeiro dia útil fica escolhido e o painel mostra os períodos dele
    expect(within(days).getByRole("button", { name: /^Segunda/ })).toHaveAttribute("aria-current", "true");
    expect(screen.queryByRole("button", { expanded: true })).not.toBeInTheDocument();
    const panel = view.container.querySelector("#j-dia-painel") as HTMLElement;
    expect(within(panel).getByRole("heading", { level: 3, name: "Segunda" })).toBeInTheDocument();
    // Rótulo visível "Dia útil" ao lado de cada switch (A-14)
    expect(within(days).getAllByText("Dia útil")).toHaveLength(7);

    await user.click(within(days).getByRole("button", { name: /^Quarta/ }));
    expect(within(days).getByRole("button", { name: /^Quarta/ })).toHaveAttribute("aria-current", "true");
    expect(within(panel).getByRole("heading", { level: 3, name: "Quarta" })).toBeInTheDocument();

    // Ligar o sábado escolhe o sábado
    await user.click(screen.getByRole("switch", { name: "Sábado é dia útil" }));
    expect(within(panel).getByRole("heading", { level: 3, name: "Sábado" })).toBeInTheDocument();
    expect(within(panel).getAllByLabelText("Nome do período").length).toBeGreaterThan(0);
    expect(await axe(view.container)).toHaveNoViolations();
  });

  it("modo diário ≥ 1024 px: layout por largura do contêiner, não da janela (N-01)", async () => {
    setMatchMedia((query) => query === "(min-width: 1024px)");
    const { view, user } = setup();
    await user.click(screen.getByRole("radio", { name: "Diferente por dia" }));

    // Lista + painel lado a lado só com o contêiner largo; abaixo disso empilha (jsdom não mede
    // largura: conferimos as regras que o CSS aplica)
    const layout = screen.getByTestId("daily-layout");
    expect(layout).toHaveClass("@container");
    const grid = layout.firstElementChild as HTMLElement;
    expect(grid.className).toMatch(/@min-\[41rem\]:grid-cols-\[15rem_minmax\(0,1fr\)\]/);
    expect(grid.className).not.toMatch(/(^|\s)grid-cols-\[280px/);
    const days = screen.getByRole("list", { name: "Dias da semana" });
    expect(days.className).toMatch(/grid-cols-\[repeat\(auto-fill,minmax\(15rem,1fr\)\)\]/);
    expect(days.className).toContain("@min-[41rem]:flex-col");

    // Linha do período: ações à direita só com a LISTA ≥ 36rem; nada depende de `lg:`
    const panel = view.container.querySelector("#j-dia-painel") as HTMLElement;
    const list = within(panel).getByTestId("period-list");
    expect(list).toHaveClass("@container", "min-w-0");
    within(panel)
      .getAllByTestId("period-row")
      .forEach((row) => {
        expect(row).toHaveClass("grid-cols-1");
        expect(row.className).toContain("@min-[18rem]:grid-cols-[minmax(0,1fr)_minmax(0,7.5rem)]");
        expect(row.className).toContain("@min-[36rem]:grid-cols-[minmax(0,1fr)_minmax(0,7.5rem)_auto]");
        expect(row.className).not.toMatch(/(^|\s)lg:/);
      });
  });

  it("modo diário no celular: resumo do dia sem separar número e unidade (N-06)", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("radio", { name: "Diferente por dia" }));

    const tuesday = screen.getByRole("button", { name: /^Terça/ });
    const count = within(tuesday).getByText("4 períodos");
    expect(count).toHaveClass("whitespace-nowrap");
    expect(within(tuesday).getByText("· 08:00")).toHaveClass("whitespace-nowrap");
    expect(tuesday).toHaveTextContent("Terça4 períodos · 08:00");
  });

  it("vigência no passado é recusada", async () => {
    const { onSubmit, user } = setup();
    const effective = screen.getByLabelText("Vale a partir de");
    fireEvent.change(effective, { target: { value: "2026-11-01" } });
    await user.click(screen.getByRole("button", { name: "Salvar cargo" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(effective).toHaveAccessibleDescription(/A vigência não pode começar no passado\./);
  });
});

describe("utils/schedule", () => {
  it("mapeia erros[] da API (com e sem prefixo schedule, modo diário por índice do dia útil)", () => {
    const daily = switchMode(defaultScheduleDraft(TODAY), "daily");
    const mapped = mapApiScheduleErrors(
      [
        { campo: "name", mensagem: "O nome do cargo é obrigatório." },
        { campo: "schedule.days[4].periods[1].name", mensagem: "O nome do período é obrigatório." },
        { campo: "weeklyMinutes", mensagem: "Carga inválida." },
        { campo: "", mensagem: "Erro geral." },
      ],
      daily,
    );
    expect(mapped.name).toBe("O nome do cargo é obrigatório.");
    // days[4] = quinto dia útil enviado = sexta (5)
    expect(mapped.fields).toEqual({
      "day5.periods.1.name": "O nome do período é obrigatório.",
      weeklyMinutes: "Carga inválida.",
    });
    expect(mapped.general).toEqual(["Erro geral."]);
  });
});
