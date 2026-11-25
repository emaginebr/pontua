using Pontua.Domain.Exceptions;
using Pontua.Domain.Interfaces;
using Pontua.Domain.Models;
using Pontua.Infra.Interfaces.Repository;

namespace Pontua.Domain.Services;

/// <summary>
/// Resolve o <see cref="AccessContext"/> do usuário na empresa e aplica as regras de supervisão (R-03, FR-022c).
/// </summary>
public class CompanyAccessPolicy : ICompanyAccessPolicy
{
    private readonly ICompanyRepository<Company> _companyRepository;
    private readonly IMemberRepository<Member, MemberPosition, ManagerPosition> _memberRepository;

    public CompanyAccessPolicy(
        ICompanyRepository<Company> companyRepository,
        IMemberRepository<Member, MemberPosition, ManagerPosition> memberRepository)
    {
        _companyRepository = companyRepository;
        _memberRepository = memberRepository;
    }

    public async Task<AccessContext> GetContextAsync(long companyId, long userId)
    {
        var company = await _companyRepository.GetByIdAsync(companyId);
        if (company == null)
            return new AccessContext { CompanyId = companyId, UserId = userId };

        var member = await _memberRepository.GetByCompanyAndUserAsync(companyId, userId);
        if (member == null || !member.IsActive)
        {
            return new AccessContext
            {
                CompanyId = companyId,
                UserId = userId,
                MemberId = member?.MemberId
            };
        }

        var managedPositionIds = member.IsManager
            ? await _memberRepository.ListManagedPositionIdsAsync(member.MemberId)
            : new List<long>();

        return new AccessContext
        {
            CompanyId = companyId,
            UserId = userId,
            MemberId = member.MemberId,
            IsActive = true,
            IsOwner = company.OwnerUserId == userId,
            IsManager = member.IsManager,
            ManagedPositionIds = managedPositionIds.Distinct().ToList()
        };
    }

    public async Task<AccessContext> RequireMemberAsync(long companyId, long userId)
    {
        var context = await GetContextAsync(companyId, userId);
        context.RequireMember();
        return context;
    }

    public async Task<AccessContext> RequireOwnerAsync(long companyId, long userId)
    {
        var context = await GetContextAsync(companyId, userId);
        context.RequireOwner();
        return context;
    }

    public async Task RequireCanSuperviseAsync(AccessContext context, long targetMemberId, DateOnly date)
    {
        if (!await CanSuperviseAsync(context, targetMemberId, date))
            throw new ForbiddenException("Você não supervisiona este membro.");
    }

    public async Task<bool> CanSuperviseAsync(AccessContext context, long targetMemberId, DateOnly date)
    {
        context.RequireMember();

        var target = await _memberRepository.GetByIdAsync(context.CompanyId, targetMemberId);
        if (target == null)
            throw new NotFoundException("Membro não encontrado.");

        if (context.IsOwner)
            return true;
        if (!context.IsManager || context.ManagedPositionIds.Count == 0)
            return false;

        var positionId = await _memberRepository.GetPositionIdOnAsync(targetMemberId, date);
        return positionId != null && context.ManagedPositionIds.Contains(positionId.Value);
    }
}
