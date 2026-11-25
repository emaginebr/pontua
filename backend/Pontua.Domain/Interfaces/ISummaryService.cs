using Pontua.DTO.Common;
using Pontua.DTO.Summary;

namespace Pontua.Domain.Interfaces;

/// <summary>Resumo de horas trabalhadas × previstas por dia, semana e período (FR-027, R-09).</summary>
public interface ISummaryService
{
    /// <summary>Resumo do chamador (membro ativo).</summary>
    Task<HoursSummary> GetMySummaryAsync(long companyId, long userId, DateRangeQuery? query);

    /// <summary>Resumo de um membro (o próprio, o responsável ou gestor do cargo do membro — FR-028).</summary>
    Task<HoursSummary> GetSummaryAsync(long companyId, long userId, long memberId, DateRangeQuery? query);
}
