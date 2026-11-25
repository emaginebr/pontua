using Pontua.Domain.Models;
using Pontua.Infra.Context;
using Pontua.Infra.Interfaces.Repository;
using Microsoft.EntityFrameworkCore;

namespace Pontua.Infra.Repository;

public class InvitationRepository : IInvitationRepository<Invitation>
{
    private readonly PontuaContext _context;

    public InvitationRepository(PontuaContext context)
    {
        _context = context;
    }

    public Task<Invitation?> GetByIdAsync(long companyId, long invitationId) =>
        _context.Invitations.FirstOrDefaultAsync(i => i.CompanyId == companyId && i.InvitationId == invitationId);

    public Task<Invitation?> GetByTokenAsync(string token) =>
        _context.Invitations.FirstOrDefaultAsync(i => i.Token == token);

    public Task<List<Invitation>> ListByCompanyAsync(long companyId, DateTime fromUtc, DateTime toUtc) =>
        _context.Invitations.AsNoTracking()
            .Where(i => i.CompanyId == companyId && i.CreatedAt >= fromUtc && i.CreatedAt < toUtc)
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync();

    public async Task<Invitation> InsertAsync(Invitation invitation)
    {
        _context.Invitations.Add(invitation);
        await _context.SaveChangesAsync();
        return invitation;
    }

    public async Task<Invitation> UpdateAsync(Invitation invitation)
    {
        if (_context.Entry(invitation).State == EntityState.Detached)
            _context.Invitations.Update(invitation);
        await _context.SaveChangesAsync();
        return invitation;
    }

    public Task IncrementAcceptedCountAsync(long invitationId) =>
        _context.Invitations
            .Where(i => i.InvitationId == invitationId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(i => i.AcceptedCount, i => i.AcceptedCount + 1));
}
