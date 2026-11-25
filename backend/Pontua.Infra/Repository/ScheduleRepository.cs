using Pontua.Domain.Models;
using Pontua.Infra.Context;
using Pontua.Infra.Interfaces.Repository;
using Microsoft.EntityFrameworkCore;

namespace Pontua.Infra.Repository;

public class ScheduleRepository : IScheduleRepository<Schedule>
{
    private readonly PontuaContext _context;

    public ScheduleRepository(PontuaContext context)
    {
        _context = context;
    }

    private IQueryable<Schedule> WithDetails() =>
        _context.Schedules.Include(s => s.Days).Include(s => s.Periods).AsSplitQuery();

    public Task<Schedule?> GetByIdAsync(long scheduleId) =>
        WithDetails().FirstOrDefaultAsync(s => s.ScheduleId == scheduleId);

    public Task<List<Schedule>> ListByPositionsAsync(IEnumerable<long> positionIds)
    {
        var ids = positionIds.Distinct().ToList();
        return WithDetails().AsNoTracking()
            .Where(s => s.PositionId != null && ids.Contains(s.PositionId.Value))
            .OrderBy(s => s.PositionId).ThenBy(s => s.EffectiveFrom)
            .ToListAsync();
    }

    public Task<List<Schedule>> ListByMembersAsync(IEnumerable<long> memberIds)
    {
        var ids = memberIds.Distinct().ToList();
        return WithDetails().AsNoTracking()
            .Where(s => s.MemberId != null && ids.Contains(s.MemberId.Value))
            .OrderBy(s => s.MemberId).ThenBy(s => s.EffectiveFrom)
            .ToListAsync();
    }

    public Task<Schedule?> GetByPositionAndDateAsync(long positionId, DateOnly effectiveFrom) =>
        WithDetails().FirstOrDefaultAsync(s => s.PositionId == positionId && s.EffectiveFrom == effectiveFrom);

    public Task<Schedule?> GetByMemberAndDateAsync(long memberId, DateOnly effectiveFrom) =>
        WithDetails().FirstOrDefaultAsync(s => s.MemberId == memberId && s.EffectiveFrom == effectiveFrom);

    public async Task<Schedule> InsertAsync(Schedule schedule)
    {
        _context.Schedules.Add(schedule);
        await _context.SaveChangesAsync();
        return schedule;
    }

    public async Task DeleteAsync(long scheduleId)
    {
        var schedule = await WithDetails().FirstOrDefaultAsync(s => s.ScheduleId == scheduleId);
        if (schedule == null)
            return;
        // Sem cascata (Princípio V): remove os filhos explicitamente.
        _context.ScheduleDays.RemoveRange(schedule.Days);
        _context.SchedulePeriods.RemoveRange(schedule.Periods);
        _context.Schedules.Remove(schedule);
        await _context.SaveChangesAsync();
    }
}
