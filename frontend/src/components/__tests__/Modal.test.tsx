import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmModal } from "../ConfirmModal";
import { Modal, ModalBody, ModalContent, ModalHeader, ModalTitle } from "../Modal";

/** Modal aberto por estado (sem `ModalTrigger`), como em todo o app. */
const StateModal = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir filtro
      </button>
      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Filtro avançado</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <button type="button">Aplicar</button>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
};

/** "⋯" → folha de ações → "Cancelar pedido" → confirmação (um modal abre outro no lugar). */
const ChainedModals = () => {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setActionsOpen(true)}>
        Mais ações
      </button>
      <Modal open={actionsOpen} onOpenChange={setActionsOpen}>
        <ModalContent aria-describedby={undefined}>
          <ModalHeader>
            <ModalTitle>Ações</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <button
              type="button"
              onClick={() => {
                setActionsOpen(false);
                setConfirmOpen(true);
              }}
            >
              Cancelar pedido
            </button>
          </ModalBody>
        </ModalContent>
      </Modal>
      <ConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => undefined}
        title="Cancelar o pedido?"
        cancelLabel="Manter pedido"
        variant="danger"
      />
    </>
  );
};

/** Confirmação aberta por estado, como o "Registrar ponto?". */
const StateConfirm = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Registrar ponto
      </button>
      <ConfirmModal open={open} onOpenChange={setOpen} onConfirm={() => undefined} title="Registrar ponto?" />
    </>
  );
};

describe("Modal — foco volta ao gatilho ao fechar (N-03, WCAG 2.4.3)", () => {
  it("Esc e o X devolvem o foco ao botão que abriu o modal", async () => {
    const user = userEvent.setup();
    render(<StateModal />);
    const trigger = screen.getByRole("button", { name: "Abrir filtro" });

    await user.click(trigger);
    expect(await screen.findByRole("dialog", { name: "Filtro avançado" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());

    await user.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Filtro avançado" });
    await user.click(within(dialog).getByRole("button", { name: "Fechar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(document.body).not.toHaveFocus();
  });

  it("ConfirmModal: Cancelar e Confirmar devolvem o foco ao gatilho", async () => {
    const user = userEvent.setup();
    render(<StateConfirm />);
    const trigger = screen.getByRole("button", { name: "Registrar ponto" });

    await user.click(trigger);
    let dialog = await screen.findByRole("dialog", { name: "Registrar ponto?" });
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(trigger).toHaveFocus());

    await user.click(trigger);
    dialog = await screen.findByRole("dialog", { name: "Registrar ponto?" });
    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("modal que abre outro no lugar: ao fechar o segundo, o foco volta ao primeiro gatilho", async () => {
    const user = userEvent.setup();
    render(<ChainedModals />);
    const trigger = screen.getByRole("button", { name: "Mais ações" });

    await user.click(trigger);
    const actions = await screen.findByRole("dialog", { name: "Ações" });
    await user.click(within(actions).getByRole("button", { name: "Cancelar pedido" }));
    const confirm = await screen.findByRole("dialog", { name: "Cancelar o pedido?" });
    // O foco fica no novo modal (não volta para a página por trás dele)
    await waitFor(() => expect(within(confirm).getByRole("button", { name: "Manter pedido" })).toHaveFocus());

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
