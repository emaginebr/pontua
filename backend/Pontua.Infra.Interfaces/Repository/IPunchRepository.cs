namespace Pontua.Infra.Interfaces.Repository;

/// <summary>
/// Marcações imutáveis (R-04): só inserção e mudança de status — não há Update genérico nem Delete.
/// </summary>
public interface IPunchRepository<TPunch, TStatusChange>
    where TPunch : class
    where TStatusChange : class
{
    /// <summary>
    /// Insere a marcação e a linha de histórico da criação (o <c>punch_id</c> da linha é preenchido aqui).
    /// Deve rodar dentro da transação que alocou o NSR. Índice único violado (NSR ou <c>(member_id, client_id)</c>)
    /// → <see cref="UniqueConstraintViolationException"/>.
    /// </summary>
    Task<TPunch> InsertAsync(TPunch punch, TStatusChange creationChange);

    /// <summary>
    /// Grava apenas a coluna <c>status</c> da marcação (já alterada pelo domínio) e a linha de histórico, com
    /// verificação otimista: o <c>UPDATE</c> só acontece se o status no banco ainda for o <c>from_status</c> da
    /// mudança (<c>UPDATE punches SET status = @to WHERE punch_id = @id AND status = @from</c>).
    /// </summary>
    /// <returns><c>false</c> se outra transação já mudou o status (nada é gravado); o chamador responde 409.</returns>
    Task<bool> UpdateStatusAsync(TPunch punch, TStatusChange change);

    Task<TPunch?> GetByIdAsync(long companyId, long punchId);
    Task<List<TPunch>> GetByIdsAsync(long companyId, IEnumerable<long> punchIds);

    /// <summary>Marcações do membro com <c>work_date</c> no intervalo (inclusivo), por horário.</summary>
    Task<List<TPunch>> ListByMemberAsync(long memberId, DateOnly start, DateOnly end);

    /// <summary>Marcações da empresa com <c>work_date</c> no intervalo (inclusivo), opcionalmente de alguns membros.</summary>
    Task<List<TPunch>> ListByCompanyAsync(long companyId, DateOnly start, DateOnly end, IEnumerable<long>? memberIds = null);

    /// <summary>Instante da última marcação normal ou offline do membro (regra dos 60 s, FR-021).</summary>
    Task<DateTime?> GetLastAutomaticPunchedAtAsync(long memberId);

    /// <summary>Marcação offline já recebida com o mesmo identificador do aparelho (idempotência, R-10).</summary>
    Task<TPunch?> GetByClientIdAsync(long memberId, Guid clientId);

    /// <summary>Correções pendentes que substituem a marcação informada.</summary>
    Task<List<TPunch>> ListPendingCorrectionsAsync(long replacesPunchId);

    Task<List<TStatusChange>> ListStatusHistoryAsync(long punchId);

    /// <summary>Histórico de status de várias marcações, em lote (por marcação e data).</summary>
    Task<List<TStatusChange>> ListStatusHistoriesAsync(IEnumerable<long> punchIds);
}
