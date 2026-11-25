import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { ManualPunchModal } from "../ManualPunchModal";
import type { ManualPunchModalProps } from "../ManualPunchModal";
import { ApiError } from "../../Services/apiClient";
import { punch } from "../../test/fixtures";
import type { ManualPunchInput } from "../../types/punch";
import { manualWindow } from "../../utils/manualWindow";

const TODAY = "2026-11-25";

const setup = (props: Partial<ManualPunchModalProps> = {}) => {
  const onSubmit = vi.fn<(input: ManualPunchInput) => Promise<void>>().mockResolvedValue(undefined);
  const onOpenChange = vi.fn<(open: boolean) => void>();
  render(
    <ManualPunchModal
      open
      onOpenChange={onOpenChange}
      mode="include"
      initialDate="2026-11-24"
      minDate="2026-10-26"
      maxDate={TODAY}
      nowTime="10:30"
      onSubmit={onSubmit}
      {...props}
    />,
  );
  return { onSubmit, onOpenChange, user: userEvent.setup() };
};

describe("manualWindow (research R-13)", () => {
  it("limita ao limite de dias da empresa quando o membro entrou antes", () => {
    expect(manualWindow(TODAY, 30, "2026-09-01T12:00:00Z", "America/Sao_Paulo")).toEqual({ min: "2026-10-26", max: TODAY });
  });

  it("limita à data de entrada do membro quando ela é mais recente (no fuso da empresa)", () => {
    // 02:00 UTC do dia 10 ainda é dia 09 em São Paulo
    expect(manualWindow(TODAY, 30, "2026-11-10T02:00:00Z", "America/Sao_Paulo")).toEqual({ min: "2026-11-09", max: TODAY });
  });
});

describe("ManualPunchModal", () => {
  it("mostra a data com mínimo e máximo, contador e nota de pendência, sem violações", async () => {
    setup();
    const dialog = await screen.findByRole("dialog", { name: "Incluir marcação" });

    const date = within(dialog).getByLabelText("Data");
    expect(date).toHaveAttribute("min", "2026-10-26");
    expect(date).toHaveAttribute("max", TODAY);
    expect(date).toHaveAccessibleDescription("Datas de 26/10 até hoje.");
    expect(within(dialog).getByLabelText("Justificativa")).toHaveAccessibleDescription("0 de 500 caracteres");
    expect(within(dialog).getByText(/até o responsável aprovar e não conta nas horas/)).toBeInTheDocument();
    expect(await axe(dialog)).toHaveNoViolations();
  });

  it("exige horário e justificativa e aponta cada erro no campo", async () => {
    const { onSubmit, user } = setup();
    const dialog = await screen.findByRole("dialog", { name: "Incluir marcação" });

    await user.click(within(dialog).getByRole("button", { name: "Enviar pedido" }));

    expect(within(dialog).getByText("Corrija 2 campos para continuar.")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Horário")).toHaveAccessibleDescription("Informe o horário da marcação.");
    expect(within(dialog).getByLabelText("Justificativa")).toHaveAccessibleDescription(
      "Explique o motivo da marcação. 0 de 500 caracteres",
    );
    expect(within(dialog).getByLabelText("Horário")).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText("Horário"), "17:30");
    await user.type(within(dialog).getByLabelText("Justificativa"), "ok");
    await user.click(within(dialog).getByRole("button", { name: "Enviar pedido" }));
    expect(within(dialog).getByLabelText("Justificativa")).toHaveAccessibleDescription(
      "A justificativa precisa ter pelo menos 5 caracteres. 2 de 500 caracteres",
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("recusa data fora do limite e horário no futuro", async () => {
    const { onSubmit, user } = setup({ initialDate: TODAY });
    const dialog = await screen.findByRole("dialog", { name: "Incluir marcação" });

    await user.type(within(dialog).getByLabelText("Horário"), "11:00");
    await user.type(within(dialog).getByLabelText("Justificativa"), "Esqueci de marcar a entrada.");
    await user.click(within(dialog).getByRole("button", { name: "Enviar pedido" }));
    expect(within(dialog).getByLabelText("Horário")).toHaveAccessibleDescription("O horário não pode estar no futuro.");

    const date = within(dialog).getByLabelText("Data");
    fireEvent.change(date, { target: { value: "2026-10-20" } });
    await user.click(within(dialog).getByRole("button", { name: "Enviar pedido" }));
    expect(date).toHaveAccessibleDescription("Datas de 26/10 até hoje. Escolha uma data entre 26/10 e hoje.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("envia a inclusão com a justificativa sem espaços nas pontas", async () => {
    const { onSubmit, onOpenChange, user } = setup();
    const dialog = await screen.findByRole("dialog", { name: "Incluir marcação" });

    await user.type(within(dialog).getByLabelText("Horário"), "17:30");
    await user.type(within(dialog).getByLabelText("Justificativa"), "  Esqueci a saída.  ");
    expect(within(dialog).getByText("20/500")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Enviar pedido" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        workDate: "2026-11-24",
        time: "17:30",
        justification: "Esqueci a saída.",
        replacesPunchId: null,
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("corrigir horário mostra a original e liga os erros da API aos campos", async () => {
    const original = punch({ punchId: 881, localTime: "17:04", periodName: "Saída", workDate: "2026-11-24" });
    const { onSubmit, user } = setup({ mode: "correct", original: { punch: original, name: "Saída" } });
    onSubmit.mockRejectedValueOnce(
      new ApiError(400, "Dados inválidos.", [{ campo: "time", mensagem: "O horário é igual ao da marcação original." }]),
    );
    const dialog = await screen.findByRole("dialog", { name: "Corrigir horário" });
    expect(within(dialog).getByText("Saída · 17:04")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Data")).toHaveAttribute("readonly");

    await user.type(within(dialog).getByLabelText("Horário certo"), "17:04");
    await user.type(within(dialog).getByLabelText("Justificativa"), "Horário certo da saída.");
    await user.click(within(dialog).getByRole("button", { name: "Enviar pedido" }));

    await waitFor(() =>
      expect(within(dialog).getByLabelText("Horário certo")).toHaveAccessibleDescription(
        "O horário é igual ao da marcação original.",
      ),
    );
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ replacesPunchId: 881, workDate: "2026-11-24" }));
  });
});
