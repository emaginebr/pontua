using Pontua.Domain.Enums;
using Pontua.Domain.Interfaces;
using Pontua.Domain.Models;

namespace Pontua.Domain.Services;

/// <summary>
/// Resolução de jornada para (membro, data D) — R-08:
/// <list type="number">
/// <item>versão do membro mais recente com <c>effective_from ≤ D</c>; se existir e não herdar o cargo, usa-a;</item>
/// <item>senão, cargo do membro em D (<c>member_positions</c>) → versão do cargo mais recente com
/// <c>effective_from ≤ D</c>.</item>
/// </list>
/// </summary>
public class ScheduleResolver : IScheduleResolver
{
    public ResolvedSchedule? Resolve(
        long memberId,
        DateOnly date,
        IEnumerable<MemberPosition> memberPositions,
        IEnumerable<Schedule> schedules)
    {
        var index = new VersionIndex(memberPositions, schedules);
        return index.Resolve(memberId, date);
    }

    public IReadOnlyDictionary<long, IReadOnlyDictionary<DateOnly, ResolvedSchedule?>> ResolveRange(
        IEnumerable<long> memberIds,
        DateOnly start,
        DateOnly end,
        IEnumerable<MemberPosition> memberPositions,
        IEnumerable<Schedule> schedules)
    {
        if (end < start)
            throw new ArgumentException("A data final deve ser maior ou igual à inicial.", nameof(end));

        var index = new VersionIndex(memberPositions, schedules);
        var result = new Dictionary<long, IReadOnlyDictionary<DateOnly, ResolvedSchedule?>>();
        foreach (var memberId in memberIds.Distinct())
        {
            var days = new Dictionary<DateOnly, ResolvedSchedule?>();
            for (var day = start; day <= end; day = day.AddDays(1))
                days[day] = index.Resolve(memberId, day);
            result[memberId] = days;
        }
        return result;
    }

    /// <summary>Versões agrupadas por dono e ordenadas por vigência decrescente, para busca rápida por data.</summary>
    private sealed class VersionIndex
    {
        private readonly Dictionary<long, List<MemberPosition>> _positionsByMember;
        private readonly Dictionary<long, List<Schedule>> _schedulesByMember;
        private readonly Dictionary<long, List<Schedule>> _schedulesByPosition;

        public VersionIndex(IEnumerable<MemberPosition> memberPositions, IEnumerable<Schedule> schedules)
        {
            _positionsByMember = memberPositions
                .GroupBy(mp => mp.MemberId)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(mp => mp.EffectiveFrom).ToList());

            var all = schedules.ToList();
            _schedulesByMember = all
                .Where(s => s.MemberId.HasValue)
                .GroupBy(s => s.MemberId!.Value)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(s => s.EffectiveFrom).ToList());
            _schedulesByPosition = all
                .Where(s => s.PositionId.HasValue)
                .GroupBy(s => s.PositionId!.Value)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(s => s.EffectiveFrom).ToList());
        }

        public ResolvedSchedule? Resolve(long memberId, DateOnly date)
        {
            var positionId = Latest(_positionsByMember, memberId, date, mp => mp.EffectiveFrom)?.PositionId;

            var own = Latest(_schedulesByMember, memberId, date, s => s.EffectiveFrom);
            if (own != null && !own.InheritsPosition)
                return Build(own, date, positionId, isMemberSchedule: true);

            if (positionId == null)
                return null;

            var positionSchedule = Latest(_schedulesByPosition, positionId.Value, date, s => s.EffectiveFrom);
            return positionSchedule == null ? null : Build(positionSchedule, date, positionId, isMemberSchedule: false);
        }

        private static T? Latest<T>(Dictionary<long, List<T>> source, long key, DateOnly date, Func<T, DateOnly> effectiveFrom)
            where T : class
        {
            if (!source.TryGetValue(key, out var versions))
                return null;
            // Lista em ordem decrescente: a primeira com effective_from ≤ D é a vigente.
            return versions.FirstOrDefault(v => effectiveFrom(v) <= date);
        }
    }

    private static ResolvedSchedule Build(Schedule schedule, DateOnly date, long? positionId, bool isMemberSchedule)
    {
        var dayOfWeek = date.DayOfWeek;
        var scheduleDay = schedule.Days.FirstOrDefault(d => d.DayOfWeek == dayOfWeek);
        var isWorkDay = scheduleDay != null;

        IReadOnlyList<ResolvedPeriod> periods = Array.Empty<ResolvedPeriod>();
        if (isWorkDay)
        {
            periods = schedule.Periods
                .Where(p => schedule.Mode == ScheduleMode.Weekly ? p.DayOfWeek == null : p.DayOfWeek == dayOfWeek)
                .OrderBy(p => p.Sequence)
                .Select(p => new ResolvedPeriod(p.Sequence, p.Name, p.ExpectedTime))
                .ToList();
        }

        return new ResolvedSchedule
        {
            Date = date,
            ScheduleId = schedule.ScheduleId,
            PositionId = positionId,
            IsMemberSchedule = isMemberSchedule,
            Mode = schedule.Mode,
            IsWorkDay = isWorkDay,
            DailyMinutes = scheduleDay?.DailyMinutes ?? 0,
            WeeklyMinutes = schedule.WeeklyMinutes,
            Periods = periods
        };
    }
}
