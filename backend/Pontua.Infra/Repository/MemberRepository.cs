using Pontua.Domain.Models;
using Pontua.Infra.Context;
using Pontua.Infra.Interfaces.Repository;
using Microsoft.EntityFrameworkCore;

namespace Pontua.Infra.Repository;

public class MemberRepository : IMemberRepository<Member, MemberPosition, ManagerPosition>
{
    private readonly PontuaContext _context;

    public MemberRepository(PontuaContext context)
    {
        _context = context;
    }

    public Task<Member?> GetByIdAsync(long companyId, long memberId) =>
        _context.Members.Include(m => m.User)
            .FirstOrDefaultAsync(m => m.CompanyId == companyId && m.MemberId == memberId);

    public Task<Member?> GetByCompanyAndUserAsync(long companyId, long userId) =>
        _context.Members.Include(m => m.User)
            .FirstOrDefaultAsync(m => m.CompanyId == companyId && m.UserId == userId);

    public Task<List<Member>> ListByCompanyAsync(long companyId) =>
        _context.Members.AsNoTracking().Include(m => m.User)
            .Where(m => m.CompanyId == companyId)
            .OrderBy(m => m.User!.Name)
            .ToListAsync();

    public Task<List<Member>> ListByUserAsync(long userId) =>
        _context.Members.AsNoTracking()
            .Where(m => m.UserId == userId)
            .ToListAsync();

    public async Task<Member> InsertAsync(Member member)
    {
        _context.Members.Add(member);
        // Índice único (company_id, user_id): aceite concorrente do mesmo usuário → UniqueConstraintViolationException.
        await _context.SaveChangesOrUniqueViolationAsync();
        return member;
    }

    public async Task<Member> UpdateAsync(Member member)
    {
        if (_context.Entry(member).State == EntityState.Detached)
            _context.Members.Update(member);
        await _context.SaveChangesAsync();
        return member;
    }

    public Task<List<MemberPosition>> ListPositionHistoryAsync(IEnumerable<long> memberIds)
    {
        var ids = memberIds.Distinct().ToList();
        return _context.MemberPositions.AsNoTracking().Include(mp => mp.Position)
            .Where(mp => ids.Contains(mp.MemberId))
            .OrderBy(mp => mp.MemberId).ThenBy(mp => mp.EffectiveFrom)
            .ToListAsync();
    }

    public Task<long?> GetPositionIdOnAsync(long memberId, DateOnly date) =>
        _context.MemberPositions.AsNoTracking()
            .Where(mp => mp.MemberId == memberId && mp.EffectiveFrom <= date)
            .OrderByDescending(mp => mp.EffectiveFrom)
            .Select(mp => (long?)mp.PositionId)
            .FirstOrDefaultAsync();

    public async Task<MemberPosition> UpsertPositionAsync(MemberPosition memberPosition)
    {
        var existing = await _context.MemberPositions.FirstOrDefaultAsync(mp =>
            mp.MemberId == memberPosition.MemberId && mp.EffectiveFrom == memberPosition.EffectiveFrom);
        if (existing == null)
        {
            _context.MemberPositions.Add(memberPosition);
            await _context.SaveChangesOrUniqueViolationAsync();
            return memberPosition;
        }

        existing.PositionId = memberPosition.PositionId;
        existing.CreatedByUserId = memberPosition.CreatedByUserId;
        await _context.SaveChangesAsync();
        return existing;
    }

    public Task<List<long>> ListManagedPositionIdsAsync(long memberId) =>
        _context.ManagerPositions.AsNoTracking()
            .Where(m => m.MemberId == memberId)
            .Select(m => m.PositionId)
            .ToListAsync();

    public async Task ReplaceManagedPositionsAsync(long memberId, IEnumerable<ManagerPosition> managerPositions)
    {
        var current = await _context.ManagerPositions.Where(m => m.MemberId == memberId).ToListAsync();
        _context.ManagerPositions.RemoveRange(current);
        foreach (var managerPosition in managerPositions.DistinctBy(m => m.PositionId))
        {
            managerPosition.MemberId = memberId;
            _context.ManagerPositions.Add(managerPosition);
        }
        await _context.SaveChangesOrUniqueViolationAsync();
    }
}
