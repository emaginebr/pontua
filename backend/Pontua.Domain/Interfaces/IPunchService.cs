using Pontua.DTO.Common;
using Pontua.DTO.Punches;

namespace Pontua.Domain.Interfaces;

/// <summary>Marcações de ponto: normal, offline, manual, cancelamento e histórico (FR-016 a FR-022b, FR-026, FR-028).</summary>
public interface IPunchService
{
    /// <summary>
    /// Marcação normal com o horário do servidor (membro ativo; senão 404). Menos de 60 s após a última normal ou
    /// offline → 422. Dia útil → <c>valid</c>; senão → <c>pending/outsideWorkday</c>.
    /// </summary>
    Task<PunchInfo> PunchAsync(long companyId, long userId);

    /// <summary>
    /// Lote offline (R-10): resultado por item — <c>created</c>, <c>duplicate</c> (mesmo <c>clientId</c>, devolve a
    /// existente), <c>future</c> (&gt; agora + 2 min) ou <c>too_old</c> (antes do limite retroativo da empresa).
    /// </summary>
    Task<OfflineSyncResult> SyncOfflineAsync(long companyId, long userId, OfflinePunchBatchInfo batch);

    /// <summary>
    /// Marcação manual (FR-018/018a/019): instante no fuso da empresa; futuro ou antes de
    /// <c>hoje − manual_retro_days</c> → 422. Com <c>replacesPunchId</c>: a original deve ser do próprio membro e
    /// <c>valid</c>/<c>approved</c> (senão 409; inexistente → 404) e a correção pendente anterior da mesma original
    /// vira <c>cancelled</c> ("auto: nova correção") na mesma transação. Nasce <c>pending/manual</c>, com NSR.
    /// </summary>
    Task<PunchInfo> CreateManualAsync(long companyId, long userId, ManualPunchInsertInfo info);

    /// <summary>
    /// Cancela uma marcação manual pendente (FR-020): só o autor (senão 403); não manual ou não pendente → 409.
    /// Grava <c>punch_status_changes</c>.
    /// </summary>
    Task CancelAsync(long companyId, long userId, long punchId);

    /// <summary>Histórico por dia do chamador: todos os dias do intervalo, inclusive sem marcações.</summary>
    Task<List<DayRecord>> GetMyDaysAsync(long companyId, long userId, DateRangeQuery? query);

    /// <summary>Histórico por dia de um membro (o próprio, o responsável ou gestor do cargo do membro).</summary>
    Task<List<DayRecord>> GetDaysAsync(long companyId, long userId, long memberId, DateRangeQuery? query);

    /// <summary>Marcação com o histórico de status (o autor, o responsável ou gestor do cargo do autor).</summary>
    Task<PunchInfo> GetPunchAsync(long companyId, long userId, long punchId);
}
