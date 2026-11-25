using Pontua.Domain.Models;
using Pontua.Infra.Interfaces.Repository;

namespace Pontua.Domain.Services;

/// <summary>
/// Versões necessárias ao <see cref="Interfaces.IScheduleResolver"/> (R-08), carregadas em lote: histórico de
/// cargos dos membros, jornadas próprias dos membros e jornadas de todos os cargos que eles já tiveram.
/// </summary>
public sealed record ScheduleVersions(IReadOnlyList<MemberPosition> MemberPositions, IReadOnlyList<Schedule> Schedules)
{
    public static async Task<ScheduleVersions> LoadAsync(
        IMemberRepository<Member, MemberPosition, ManagerPosition> memberRepository,
        IScheduleRepository<Schedule> scheduleRepository,
        IEnumerable<long> memberIds)
    {
        var ids = memberIds.Distinct().ToList();
        if (ids.Count == 0)
            return new ScheduleVersions(Array.Empty<MemberPosition>(), Array.Empty<Schedule>());

        var memberPositions = await memberRepository.ListPositionHistoryAsync(ids);
        var schedules = new List<Schedule>(await scheduleRepository.ListByMembersAsync(ids));

        var positionIds = memberPositions.Select(mp => mp.PositionId).Distinct().ToList();
        if (positionIds.Count > 0)
            schedules.AddRange(await scheduleRepository.ListByPositionsAsync(positionIds));

        return new ScheduleVersions(memberPositions, schedules);
    }
}
