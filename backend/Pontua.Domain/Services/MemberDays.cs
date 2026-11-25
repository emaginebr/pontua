using Pontua.Domain.Interfaces;
using Pontua.Domain.Models;
using Pontua.Infra.Interfaces.Repository;

namespace Pontua.Domain.Services;

/// <summary>
/// Avaliação dia a dia de um membro num intervalo (R-07, R-09): carrega em lote as versões de jornada e as
/// marcações e devolve uma <see cref="DayEvaluation"/> para <b>cada</b> dia do intervalo, inclusive sem marcações.
/// O predicado <c>countsExpected</c> (ver <see cref="MemberActivity.ExpectedCounts"/>) zera o previsto dos dias
/// futuros e dos dias em que o membro não estava ativo.
/// </summary>
public static class MemberDays
{
    public static async Task<(IReadOnlyList<DayEvaluation> Days, IReadOnlyList<Punch> Punches)> EvaluateAsync(
        IMemberRepository<Member, MemberPosition, ManagerPosition> memberRepository,
        IScheduleRepository<Schedule> scheduleRepository,
        IPunchRepository<Punch, PunchStatusChange> punchRepository,
        IScheduleResolver scheduleResolver,
        long memberId,
        DateRange range,
        Func<DateOnly, bool>? countsExpected = null)
    {
        var versions = await ScheduleVersions.LoadAsync(memberRepository, scheduleRepository, new[] { memberId });
        var punches = await punchRepository.ListByMemberAsync(memberId, range.Start, range.End);
        return (Evaluate(memberId, range, versions, punches, scheduleResolver, countsExpected), punches);
    }

    public static IReadOnlyList<DayEvaluation> Evaluate(
        long memberId,
        DateRange range,
        ScheduleVersions versions,
        IEnumerable<Punch> punches,
        IScheduleResolver scheduleResolver,
        Func<DateOnly, bool>? countsExpected = null)
    {
        var schedules = scheduleResolver.ResolveRange(
            new[] { memberId }, range.Start, range.End, versions.MemberPositions, versions.Schedules)[memberId];
        var byDate = punches
            .Where(p => p.MemberId == memberId && range.Contains(p.WorkDate))
            .GroupBy(p => p.WorkDate)
            .ToDictionary(g => g.Key, g => g.ToList());

        return range.Days()
            .Select(day => DayEvaluator.Evaluate(
                day,
                schedules.GetValueOrDefault(day),
                byDate.TryGetValue(day, out var dayPunches) ? dayPunches : new List<Punch>(),
                countsExpected?.Invoke(day) ?? true))
            .ToList();
    }

    /// <summary>
    /// Período calculado (R-07) de cada marcação informada, avaliando os dias delas com todas as marcações do membro
    /// (as informadas são acrescentadas se ainda não estiverem no banco).
    /// </summary>
    public static async Task<Dictionary<long, string?>> PeriodNamesAsync(
        IMemberRepository<Member, MemberPosition, ManagerPosition> memberRepository,
        IScheduleRepository<Schedule> scheduleRepository,
        IPunchRepository<Punch, PunchStatusChange> punchRepository,
        IScheduleResolver scheduleResolver,
        long memberId,
        IReadOnlyCollection<Punch> punches)
    {
        var result = new Dictionary<long, string?>();
        if (punches.Count == 0)
            return result;

        var range = new DateRange(punches.Min(p => p.WorkDate), punches.Max(p => p.WorkDate));
        var versions = await ScheduleVersions.LoadAsync(memberRepository, scheduleRepository, new[] { memberId });
        var dayPunches = await punchRepository.ListByMemberAsync(memberId, range.Start, range.End);
        foreach (var punch in punches.Where(p => dayPunches.All(d => d.PunchId != p.PunchId)))
            dayPunches.Add(punch);

        var wanted = punches.Select(p => p.WorkDate).ToHashSet();
        foreach (var day in Evaluate(memberId, range, versions, dayPunches, scheduleResolver).Where(d => wanted.Contains(d.Date)))
        {
            foreach (var evaluated in day.Punches)
                result[evaluated.Punch.PunchId] = evaluated.Period?.Name;
        }
        return result;
    }
}
