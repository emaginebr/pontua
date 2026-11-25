using Pontua.Domain.Models;
using Pontua.Infra.Context;
using Pontua.Infra.Interfaces.Repository;
using Microsoft.EntityFrameworkCore;

namespace Pontua.Infra.Repository;

public class CompanyRepository : ICompanyRepository<Company>
{
    private readonly PontuaContext _context;

    public CompanyRepository(PontuaContext context)
    {
        _context = context;
    }

    public Task<Company?> GetByIdAsync(long companyId) =>
        _context.Companies.FirstOrDefaultAsync(c => c.CompanyId == companyId);

    public Task<List<Company>> GetByIdsAsync(IEnumerable<long> companyIds)
    {
        var ids = companyIds.Distinct().ToList();
        return _context.Companies.AsNoTracking().Where(c => ids.Contains(c.CompanyId)).ToListAsync();
    }

    public async Task<Company> InsertAsync(Company company)
    {
        _context.Companies.Add(company);
        await _context.SaveChangesAsync();
        return company;
    }

    public async Task<Company> UpdateAsync(Company company)
    {
        var entry = _context.Entry(company);
        if (entry.State == EntityState.Detached)
            _context.Companies.Update(company);
        // last_nsr só muda pelo NsrAllocator (R-05): nunca sobrescrever com o valor em memória.
        _context.Entry(company).Property(c => c.LastNsr).IsModified = false;
        await _context.SaveChangesAsync();
        return company;
    }
}
