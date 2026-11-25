using Pontua.Domain.Enums;
using Pontua.Domain.Interfaces;
using Pontua.Domain.Models;
using Pontua.DTO.Punches;

namespace Pontua.Domain.Services;

/// <summary>
/// Conversões de marcações e avaliações de dia para os DTOs (contracts/api.md › Punches). Puro: os nomes de
/// usuários e o histórico de status chegam já carregados.
/// </summary>
public static class PunchMapper
{
    public static PunchInfo ToInfo(
        Punch punch,
        string? periodName,
        string timeZoneId,
        ICompanyClock companyClock,
        ReviewInfo? review = null)
    {
        var local = companyClock.ToLocal(punch.PunchedAt, timeZoneId);
        return new PunchInfo
        {
            PunchId = punch.PunchId,
            Nsr = punch.Nsr,
            MemberId = punch.MemberId,
            Kind = ApiText.Of(punch.Kind),
            PunchedAt = punch.PunchedAt,
            WorkDate = punch.WorkDate,
            LocalTime = new TimeOnly(local.Hour, local.Minute),
            ReceivedAt = punch.ReceivedAt,
            Status = ApiText.Of(punch.Status),
            PendingReason = ApiText.Of(punch.PendingReason),
            Justification = punch.Justification,
            ReplacesPunchId = punch.ReplacesPunchId,
            PeriodName = periodName,
            CountsAsWorked = punch.CountsAsWorked,
            Review = review
        };
    }

    /// <summary>Dia avaliado → <see cref="DayRecord"/> com períodos previstos e todas as marcações do dia.</summary>
    public static DayRecord ToDayRecord(
        DayEvaluation evaluation,
        string timeZoneId,
        ICompanyClock companyClock,
        IReadOnlyDictionary<long, ReviewInfo>? reviews = null) => new()
    {
        Date = evaluation.Date,
        IsWorkDay = evaluation.IsWorkDay,
        ExpectedMinutes = evaluation.ExpectedMinutes,
        WorkedMinutes = evaluation.WorkedMinutes,
        BalanceMinutes = evaluation.BalanceMinutes,
        Incomplete = evaluation.Incomplete,
        HasPending = evaluation.HasPending,
        Periods = evaluation.Periods
            .Select(slot => new DayPeriodInfo
            {
                Sequence = slot.Period.Sequence,
                Name = slot.Period.Name,
                ExpectedTime = slot.Period.ExpectedTime,
                PunchId = slot.Punch?.PunchId
            })
            .ToList(),
        Punches = evaluation.Punches
            .Select(e => ToInfo(e.Punch, e.Period?.Name, timeZoneId, companyClock,
                reviews != null && reviews.TryGetValue(e.Punch.PunchId, out var review) ? review : null))
            .ToList()
    };

    /// <summary>
    /// Última análise (mudança para <c>Approved</c> ou <c>Rejected</c>) de cada marcação, a partir do histórico.
    /// </summary>
    public static Dictionary<long, ReviewInfo> Reviews(
        IEnumerable<PunchStatusChange> history,
        IReadOnlyDictionary<long, string> userNames) =>
        history
            .Where(c => c.ToStatus is PunchStatus.Approved or PunchStatus.Rejected)
            .GroupBy(c => c.PunchId)
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    var last = g.OrderBy(c => c.ChangedAt).ThenBy(c => c.PunchStatusChangeId).Last();
                    return new ReviewInfo
                    {
                        By = userNames.GetValueOrDefault(last.ChangedByUserId) ?? string.Empty,
                        At = last.ChangedAt,
                        Note = last.Note
                    };
                });

    public static PunchStatusChangeInfo ToChangeInfo(PunchStatusChange change, IReadOnlyDictionary<long, string> userNames) => new()
    {
        FromStatus = ApiText.Of(change.FromStatus),
        ToStatus = ApiText.Of(change.ToStatus),
        ChangedBy = userNames.GetValueOrDefault(change.ChangedByUserId) ?? string.Empty,
        ChangedAt = change.ChangedAt,
        Note = change.Note
    };
}
