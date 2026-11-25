using Pontua.Domain.Enums;
using Pontua.Domain.Models;
using Pontua.Infra.Context;
using Pontua.Infra.Interfaces.Repository;
using Microsoft.EntityFrameworkCore;

namespace Pontua.Infra.Repository;

/// <summary>
/// Marcações imutáveis (R-04): só insere e grava a coluna <c>status</c>. O trigger <c>punches_immutable</c>
/// garante o mesmo no banco.
/// </summary>
public class PunchRepository : IPunchRepository<Punch, PunchStatusChange>
{
    private readonly PontuaContext _context;

    public PunchRepository(PontuaContext context)
    {
        _context = context;
    }

    public async Task<Punch> InsertAsync(Punch punch, PunchStatusChange creationChange)
    {
        _context.Punches.Add(punch);
        await _context.SaveChangesOrUniqueViolationAsync();

        creationChange.PunchId = punch.PunchId;
        _context.PunchStatusChanges.Add(creationChange);
        await _context.SaveChangesAsync();
        return punch;
    }

    public async Task<bool> UpdateStatusAsync(Punch punch, PunchStatusChange change)
    {
        var from = change.FromStatus
            ?? throw new ArgumentException("A mudança de status exige o status anterior.", nameof(change));

        // UPDATE só da coluna status, condicionado ao status anterior (concorrência otimista, sem lock).
        var updated = await _context.Punches
            .Where(p => p.PunchId == punch.PunchId && p.Status == from)
            .ExecuteUpdateAsync(setters => setters.SetProperty(p => p.Status, change.ToStatus));

        // A entidade em memória já tem o novo status: desanexada, ela nunca entra num SaveChanges posterior.
        var entry = _context.Entry(punch);
        if (entry.State != EntityState.Detached)
            entry.State = EntityState.Detached;

        if (updated == 0)
            return false;

        change.PunchId = punch.PunchId;
        _context.PunchStatusChanges.Add(change);
        await _context.SaveChangesAsync();
        return true;
    }

    public Task<Punch?> GetByIdAsync(long companyId, long punchId) =>
        _context.Punches.FirstOrDefaultAsync(p => p.CompanyId == companyId && p.PunchId == punchId);

    public Task<List<Punch>> GetByIdsAsync(long companyId, IEnumerable<long> punchIds)
    {
        var ids = punchIds.Distinct().ToList();
        return _context.Punches.Where(p => p.CompanyId == companyId && ids.Contains(p.PunchId)).ToListAsync();
    }

    public Task<List<Punch>> ListByMemberAsync(long memberId, DateOnly start, DateOnly end) =>
        _context.Punches.AsNoTracking()
            .Where(p => p.MemberId == memberId && p.WorkDate >= start && p.WorkDate <= end)
            .OrderBy(p => p.PunchedAt).ThenBy(p => p.PunchId)
            .ToListAsync();

    public Task<List<Punch>> ListByCompanyAsync(long companyId, DateOnly start, DateOnly end, IEnumerable<long>? memberIds = null)
    {
        var query = _context.Punches.AsNoTracking()
            .Where(p => p.CompanyId == companyId && p.WorkDate >= start && p.WorkDate <= end);
        if (memberIds != null)
        {
            var ids = memberIds.Distinct().ToList();
            query = query.Where(p => ids.Contains(p.MemberId));
        }
        return query.OrderBy(p => p.PunchedAt).ThenBy(p => p.PunchId).ToListAsync();
    }

    public Task<DateTime?> GetLastAutomaticPunchedAtAsync(long memberId) =>
        _context.Punches.AsNoTracking()
            .Where(p => p.MemberId == memberId && (p.Kind == PunchKind.Normal || p.Kind == PunchKind.Offline))
            .OrderByDescending(p => p.PunchedAt)
            .Select(p => (DateTime?)p.PunchedAt)
            .FirstOrDefaultAsync();

    public Task<Punch?> GetByClientIdAsync(long memberId, Guid clientId) =>
        _context.Punches.AsNoTracking()
            .FirstOrDefaultAsync(p => p.MemberId == memberId && p.ClientId == clientId);

    public Task<List<Punch>> ListPendingCorrectionsAsync(long replacesPunchId) =>
        _context.Punches
            .Where(p => p.ReplacesPunchId == replacesPunchId && p.Status == PunchStatus.Pending)
            .ToListAsync();

    public Task<List<PunchStatusChange>> ListStatusHistoryAsync(long punchId) =>
        _context.PunchStatusChanges.AsNoTracking()
            .Where(c => c.PunchId == punchId)
            .OrderBy(c => c.ChangedAt).ThenBy(c => c.PunchStatusChangeId)
            .ToListAsync();

    public Task<List<PunchStatusChange>> ListStatusHistoriesAsync(IEnumerable<long> punchIds)
    {
        var ids = punchIds.Distinct().ToList();
        return _context.PunchStatusChanges.AsNoTracking()
            .Where(c => ids.Contains(c.PunchId))
            .OrderBy(c => c.PunchId).ThenBy(c => c.ChangedAt).ThenBy(c => c.PunchStatusChangeId)
            .ToListAsync();
    }
}
