using Pontua.DTO.Approvals;
using Pontua.DTO.Punches;

namespace Pontua.Domain.Interfaces;

/// <summary>Painel de pendências e análise de marcações (FR-022d/e, FR-023 a FR-025).</summary>
public interface IApprovalService
{
    /// <summary>
    /// Painel (R-12): para cada (membro, dia) do intervalo em que o membro estava ativo e dentro do escopo
    /// (responsável: todos; gestor: membros cujo cargo vigente no dia é um dos seus, exceto ele mesmo), situação
    /// <c>missing</c> (dia útil até hoje sem marcação efetiva) ou <c>pending</c> (alguma marcação pendente). Dias
    /// decrescentes, membros por nome. Membro comum → 403.
    /// </summary>
    Task<List<PendingPanelDay>> GetPanelAsync(long companyId, long userId, PanelQuery? query);

    /// <summary>
    /// Aprova uma marcação pendente (FR-024). Gestor analisando a própria marcação ou fora dos seus cargos → 403;
    /// não pendente → 409. Correção aprovada: a original vira <c>superseded</c> na mesma transação (409 se ela já
    /// não estiver <c>valid</c>/<c>approved</c>).
    /// </summary>
    Task<PunchInfo> ApproveAsync(long companyId, long userId, long punchId, ReviewInsertInfo? info);

    /// <summary>Rejeita uma marcação pendente, com motivo opcional (mesmas permissões de <see cref="ApproveAsync"/>).</summary>
    Task<PunchInfo> RejectAsync(long companyId, long userId, long punchId, ReviewInsertInfo? info);
}
