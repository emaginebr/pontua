using Pontua.Domain.Models;
using Pontua.Infra.Context;
using Pontua.Infra.Interfaces.Repository;
using Microsoft.EntityFrameworkCore;

namespace Pontua.Infra.Repository;

public class PositionRepository : IPositionRepository<Position>
{
    private readonly PontuaContext _context;

    public PositionRepository(PontuaContext context)
    {
        _context = context;
    }

    public Task<Position?> GetByIdAsync(long companyId, long positionId) =>
        _context.Positions.FirstOrDefaultAsync(p => p.CompanyId == companyId && p.PositionId == positionId);

    public Task<List<Position>> ListByCompanyAsync(long companyId) =>
        _context.Positions.AsNoTracking()
            .Where(p => p.CompanyId == companyId)
            .OrderBy(p => p.Name)
            .ToListAsync();

    public Task<bool> ExistsNameAsync(long companyId, string name, long? exceptPositionId = null)
    {
        var normalized = name.Trim().ToLower();
        return _context.Positions.AnyAsync(p =>
            p.CompanyId == companyId
            && p.Name.ToLower() == normalized
            && (exceptPositionId == null || p.PositionId != exceptPositionId));
    }

    public async Task<bool> HasHistoryAsync(long positionId) =>
        await _context.MemberPositions.AnyAsync(mp => mp.PositionId == positionId)
        || await _context.Invitations.AnyAsync(i => i.PositionId == positionId)
        || await _context.ManagerPositions.AnyAsync(m => m.PositionId == positionId);

    public async Task<Position> InsertAsync(Position position)
    {
        _context.Positions.Add(position);
        await _context.SaveChangesAsync();
        return position;
    }

    public async Task<Position> UpdateAsync(Position position)
    {
        if (_context.Entry(position).State == EntityState.Detached)
            _context.Positions.Update(position);
        await _context.SaveChangesAsync();
        return position;
    }

    /// <summary>Remove o cargo e as versões de jornada dele (FKs sem cascata: filhos primeiro).</summary>
    public async Task DeleteAsync(long positionId)
    {
        var schedules = await _context.Schedules
            .Include(s => s.Days)
            .Include(s => s.Periods)
            .Where(s => s.PositionId == positionId)
            .ToListAsync();
        foreach (var schedule in schedules)
        {
            _context.ScheduleDays.RemoveRange(schedule.Days);
            _context.SchedulePeriods.RemoveRange(schedule.Periods);
        }
        _context.Schedules.RemoveRange(schedules);

        var position = await _context.Positions.FirstOrDefaultAsync(p => p.PositionId == positionId);
        if (position != null)
            _context.Positions.Remove(position);

        await _context.SaveChangesAsync();
    }
}
