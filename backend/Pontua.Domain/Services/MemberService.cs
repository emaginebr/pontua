using FluentValidation;
using Microsoft.Extensions.Logging;
using Pontua.Domain.Enums;
using Pontua.Domain.Exceptions;
using Pontua.Domain.Interfaces;
using Pontua.Domain.Models;
using Pontua.Domain.Validators;
using Pontua.DTO.Members;
using Pontua.DTO.Positions;
using Pontua.DTO.Schedules;
using Pontua.Infra.Interfaces.Repository;

namespace Pontua.Domain.Services;

/// <summary>
/// Membros da empresa (FR-011, FR-012, FR-015, FR-022c/d): consultas com cargo e jornada vigentes hoje e as operações
/// administrativas do responsável (cargo com vigência, jornada própria, desativação/reativação e designação de gestor).
/// </summary>
public class MemberService : IMemberService
{
    public const string MEMBER_NOT_FOUND_MESSAGE = "Membro não encontrado.";
    public const string PAST_EFFECTIVE_FROM_MESSAGE = "A vigência não pode ser uma data passada.";
    public const string DEACTIVATE_OWNER_MESSAGE =
        "O responsável pela empresa não pode ser desativado. Transfira a responsabilidade antes.";
    public const string OWNER_AS_MANAGER_MESSAGE = "O responsável já supervisiona todos os membros e não precisa ser gestor.";
    public const string INACTIVE_MANAGER_MESSAGE = "Somente membros ativos podem ser designados gestores.";

    private readonly IMemberRepository<Member, MemberPosition, ManagerPosition> _memberRepository;
    private readonly IScheduleRepository<Schedule> _scheduleRepository;
    private readonly IPositionRepository<Position> _positionRepository;
    private readonly ICompanyRepository<Company> _companyRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICompanyAccessPolicy _accessPolicy;
    private readonly IScheduleResolver _scheduleResolver;
    private readonly ICompanyClock _companyClock;
    private readonly IClock _clock;
    private readonly IValidator<MemberPositionUpdateInfo> _positionValidator;
    private readonly IValidator<ManagerUpdateInfo> _managerValidator;
    private readonly IValidator<ScheduleInput> _scheduleValidator;
    private readonly ILogger<MemberService> _logger;

    public MemberService(
        IMemberRepository<Member, MemberPosition, ManagerPosition> memberRepository,
        IScheduleRepository<Schedule> scheduleRepository,
        IPositionRepository<Position> positionRepository,
        ICompanyRepository<Company> companyRepository,
        IUnitOfWork unitOfWork,
        ICompanyAccessPolicy accessPolicy,
        IScheduleResolver scheduleResolver,
        ICompanyClock companyClock,
        IClock clock,
        IValidator<MemberPositionUpdateInfo> positionValidator,
        IValidator<ManagerUpdateInfo> managerValidator,
        IValidator<ScheduleInput> scheduleValidator,
        ILogger<MemberService> logger)
    {
        _memberRepository = memberRepository;
        _scheduleRepository = scheduleRepository;
        _positionRepository = positionRepository;
        _companyRepository = companyRepository;
        _unitOfWork = unitOfWork;
        _accessPolicy = accessPolicy;
        _scheduleResolver = scheduleResolver;
        _companyClock = companyClock;
        _clock = clock;
        _positionValidator = positionValidator;
        _managerValidator = managerValidator;
        _scheduleValidator = scheduleValidator;
        _logger = logger;
    }

    // ---------- Consultas ----------

    public async Task<List<MemberInfo>> ListAsync(long companyId, long userId, string? status, long? positionId)
    {
        var access = await _accessPolicy.RequireMemberAsync(companyId, userId);
        if (!access.CanSuperviseAnyone)
            throw new ForbiddenException("Somente o responsável ou um gestor pode listar os membros.");
        var statusFilter = ParseStatus(status);

        var company = await RequireCompanyAsync(companyId);
        var today = _companyClock.TodayLocal(company.TimeZone);

        var members = (await _memberRepository.ListByCompanyAsync(companyId))
            .Where(m => statusFilter == MemberInfo.STATUS_ALL
                        || (statusFilter == MemberInfo.STATUS_ACTIVE ? m.IsActive : !m.IsActive))
            .ToList();
        if (members.Count == 0)
            return new List<MemberInfo>();

        var versions = await ScheduleVersions.LoadAsync(_memberRepository, _scheduleRepository, members.Select(m => m.MemberId));
        var currentPositions = CurrentPositions(versions.MemberPositions, today);

        // Escopo do gestor (FR-022d): só os membros cujo cargo vigente hoje está entre os seus.
        if (!access.IsOwner)
        {
            members = members
                .Where(m => currentPositions.TryGetValue(m.MemberId, out var mp) && access.ManagedPositionIds.Contains(mp.PositionId))
                .ToList();
        }
        if (positionId != null)
        {
            members = members
                .Where(m => currentPositions.TryGetValue(m.MemberId, out var mp) && mp.PositionId == positionId)
                .ToList();
        }

        var result = new List<MemberInfo>(members.Count);
        foreach (var member in members)
            result.Add(await ToInfoAsync(member, company, versions, currentPositions, today));
        return result;
    }

    public async Task<MemberInfo> GetMeAsync(long companyId, long userId)
    {
        var access = await _accessPolicy.RequireMemberAsync(companyId, userId);
        var company = await RequireCompanyAsync(companyId);
        var member = await RequireTargetAsync(companyId, access.MemberId!.Value);

        var today = _companyClock.TodayLocal(company.TimeZone);
        var versions = await ScheduleVersions.LoadAsync(_memberRepository, _scheduleRepository, new[] { member.MemberId });
        return await ToInfoAsync(member, company, versions, CurrentPositions(versions.MemberPositions, today), today);
    }

    public async Task<MemberInfo> GetAsync(long companyId, long userId, long memberId)
    {
        var access = await _accessPolicy.RequireMemberAsync(companyId, userId);
        var company = await RequireCompanyAsync(companyId);
        var today = _companyClock.TodayLocal(company.TimeZone);
        await _accessPolicy.RequireSelfOrSuperviseAsync(access, memberId, today);

        var member = await RequireTargetAsync(companyId, memberId);
        return await BuildDetailAsync(member, company, today);
    }

    // ---------- Administração (só o responsável) ----------

    public async Task<MemberInfo> ChangePositionAsync(long companyId, long userId, long memberId, MemberPositionUpdateInfo info)
    {
        await _accessPolicy.RequireOwnerAsync(companyId, userId);
        await _positionValidator.EnsureValidAsync(info);

        var company = await RequireCompanyAsync(companyId);
        var today = _companyClock.TodayLocal(company.TimeZone);
        var member = await RequireTargetAsync(companyId, memberId);
        var position = await _positionRepository.GetByIdAsync(companyId, info.PositionId!.Value)
            ?? throw new NotFoundException(PositionService.POSITION_NOT_FOUND_MESSAGE);
        var effectiveFrom = RequireNotPast(info.EffectiveFrom, today);

        // Nova vigência: dias anteriores continuam avaliados pelo cargo da época (FR-012). Mesma data → substitui.
        await _memberRepository.UpsertPositionAsync(new MemberPosition
        {
            MemberId = member.MemberId,
            PositionId = position.PositionId,
            EffectiveFrom = effectiveFrom,
            CreatedByUserId = userId,
            CreatedAt = _clock.UtcNow
        });

        _logger.LogInformation("Cargo do membro {MemberId} na empresa {CompanyId} alterado para {PositionId} a partir de {EffectiveFrom} pelo usuário {UserId}.",
            member.MemberId, companyId, position.PositionId, effectiveFrom, userId);
        return await BuildDetailAsync(member, company, today);
    }

    public async Task<ScheduleInfo> SetOwnScheduleAsync(long companyId, long userId, long memberId, ScheduleInput input)
    {
        await _accessPolicy.RequireOwnerAsync(companyId, userId);
        await _scheduleValidator.EnsureValidAsync(input);

        var company = await RequireCompanyAsync(companyId);
        var today = _companyClock.TodayLocal(company.TimeZone);
        var member = await RequireTargetAsync(companyId, memberId);
        var effectiveFrom = RequireNotPast(input.EffectiveFrom, today);
        var now = _clock.UtcNow;

        Schedule schedule;
        await _unitOfWork.BeginTransactionAsync();
        try
        {
            // Mesma vigência (hoje ou futura) → substitui a versão (R-08).
            var existing = await _scheduleRepository.GetByMemberAndDateAsync(member.MemberId, effectiveFrom);
            if (existing != null)
                await _scheduleRepository.DeleteAsync(existing.ScheduleId);

            schedule = await _scheduleRepository.InsertAsync(ScheduleFactory.Create(
                input,
                companyId,
                positionId: null,
                memberId: member.MemberId,
                effectiveFrom: effectiveFrom,
                createdByUserId: userId,
                utcNow: now));

            await _unitOfWork.CommitAsync();
        }
        catch
        {
            await _unitOfWork.RollbackAsync();
            throw;
        }

        _logger.LogInformation("Jornada própria do membro {MemberId} na empresa {CompanyId} gravada com vigência {EffectiveFrom} pelo usuário {UserId}.",
            member.MemberId, companyId, effectiveFrom, userId);
        return ScheduleFactory.ToInfo(schedule);
    }

    public async Task ClearOwnScheduleAsync(long companyId, long userId, long memberId, DateOnly? effectiveFrom)
    {
        await _accessPolicy.RequireOwnerAsync(companyId, userId);

        var company = await RequireCompanyAsync(companyId);
        var today = _companyClock.TodayLocal(company.TimeZone);
        var member = await RequireTargetAsync(companyId, memberId);
        var from = RequireNotPast(effectiveFrom, today);
        var now = _clock.UtcNow;

        var own = await _scheduleRepository.ListByMembersAsync(new[] { member.MemberId });
        var previous = own.Where(s => s.EffectiveFrom < from).MaxBy(s => s.EffectiveFrom);

        await _unitOfWork.BeginTransactionAsync();
        try
        {
            // Versões da data em diante ainda não vigoraram (from ≥ hoje): são descartadas.
            foreach (var version in own.Where(s => s.EffectiveFrom >= from))
                await _scheduleRepository.DeleteAsync(version.ScheduleId);

            // Se até a data valia uma jornada própria, uma versão inherits_position a encerra (R-08).
            if (previous is { InheritsPosition: false })
                await _scheduleRepository.InsertAsync(ScheduleFactory.InheritPosition(companyId, member.MemberId, from, userId, now));

            await _unitOfWork.CommitAsync();
        }
        catch
        {
            await _unitOfWork.RollbackAsync();
            throw;
        }

        _logger.LogInformation("Membro {MemberId} na empresa {CompanyId} volta à jornada do cargo a partir de {EffectiveFrom} (usuário {UserId}).",
            member.MemberId, companyId, from, userId);
    }

    public async Task DeactivateAsync(long companyId, long userId, long memberId)
    {
        await _accessPolicy.RequireOwnerAsync(companyId, userId);
        var company = await RequireCompanyAsync(companyId);
        var member = await RequireTargetAsync(companyId, memberId);

        if (member.UserId == company.OwnerUserId)
            throw new BusinessRuleException(DEACTIVATE_OWNER_MESSAGE);
        if (!member.IsActive)
            return;

        var now = _clock.UtcNow;
        await _unitOfWork.BeginTransactionAsync();
        try
        {
            // Desativar encerra também a designação de gestor (data-model › members).
            member.Status = MemberStatus.Inactive;
            member.DeactivatedAt = now;
            member.IsManager = false;
            member.UpdatedAt = now;
            await _memberRepository.UpdateAsync(member);
            await _memberRepository.ReplaceManagedPositionsAsync(member.MemberId, Array.Empty<ManagerPosition>());

            await _unitOfWork.CommitAsync();
        }
        catch
        {
            await _unitOfWork.RollbackAsync();
            throw;
        }

        _logger.LogInformation("Membro {MemberId} desativado na empresa {CompanyId} pelo usuário {UserId}.", member.MemberId, companyId, userId);
    }

    public async Task ReactivateAsync(long companyId, long userId, long memberId)
    {
        await _accessPolicy.RequireOwnerAsync(companyId, userId);
        var company = await RequireCompanyAsync(companyId);
        var member = await RequireTargetAsync(companyId, memberId);
        if (member.IsActive)
            return;

        var now = _clock.UtcNow;
        member.Status = MemberStatus.Active;
        member.DeactivatedAt = null;
        member.ActiveSince = _companyClock.TodayLocal(company.TimeZone);
        member.UpdatedAt = now;
        await _memberRepository.UpdateAsync(member);

        _logger.LogInformation("Membro {MemberId} reativado na empresa {CompanyId} pelo usuário {UserId} (ativo desde {ActiveSince}).",
            member.MemberId, companyId, userId, member.ActiveSince);
    }

    public async Task<MemberInfo> SetManagerAsync(long companyId, long userId, long memberId, ManagerUpdateInfo info)
    {
        await _accessPolicy.RequireOwnerAsync(companyId, userId);
        await _managerValidator.EnsureValidAsync(info);

        var company = await RequireCompanyAsync(companyId);
        var today = _companyClock.TodayLocal(company.TimeZone);
        var member = await RequireTargetAsync(companyId, memberId);
        var isManager = info.IsManager!.Value;

        var positionIds = new List<long>();
        if (isManager)
        {
            if (member.UserId == company.OwnerUserId)
                throw new BusinessRuleException(OWNER_AS_MANAGER_MESSAGE);
            if (!member.IsActive)
                throw new BusinessRuleException(INACTIVE_MANAGER_MESSAGE);

            positionIds = info.PositionIds!.Distinct().Order().ToList();
            var companyPositions = (await _positionRepository.ListByCompanyAsync(companyId)).Select(p => p.PositionId).ToHashSet();
            if (positionIds.Any(id => !companyPositions.Contains(id)))
                throw new NotFoundException(PositionService.POSITION_NOT_FOUND_MESSAGE);
        }

        var now = _clock.UtcNow;
        await _unitOfWork.BeginTransactionAsync();
        try
        {
            member.IsManager = isManager;
            member.UpdatedAt = now;
            await _memberRepository.UpdateAsync(member);
            await _memberRepository.ReplaceManagedPositionsAsync(
                member.MemberId,
                positionIds.Select(id => new ManagerPosition { MemberId = member.MemberId, PositionId = id, CreatedAt = now }));

            await _unitOfWork.CommitAsync();
        }
        catch
        {
            await _unitOfWork.RollbackAsync();
            throw;
        }

        _logger.LogInformation("Membro {MemberId} na empresa {CompanyId}: gestor = {IsManager}, cargos {PositionIds} (usuário {UserId}).",
            member.MemberId, companyId, isManager, positionIds, userId);
        return await BuildDetailAsync(member, company, today);
    }

    // ---------- Auxiliares ----------

    private async Task<MemberInfo> BuildDetailAsync(Member member, Company company, DateOnly today)
    {
        var versions = await ScheduleVersions.LoadAsync(_memberRepository, _scheduleRepository, new[] { member.MemberId });
        var info = await ToInfoAsync(member, company, versions, CurrentPositions(versions.MemberPositions, today), today);

        info.PositionHistory = versions.MemberPositions
            .Where(mp => mp.MemberId == member.MemberId)
            .OrderByDescending(mp => mp.EffectiveFrom)
            .Select(mp => new MemberPositionInfo
            {
                PositionId = mp.PositionId,
                Name = mp.Position?.Name ?? string.Empty,
                EffectiveFrom = mp.EffectiveFrom
            })
            .ToList();
        info.ScheduleHistory = versions.Schedules
            .Where(s => s.MemberId == member.MemberId)
            .OrderByDescending(s => s.EffectiveFrom)
            .Select(ScheduleFactory.ToInfo)
            .ToList();
        return info;
    }

    private async Task<MemberInfo> ToInfoAsync(
        Member member,
        Company company,
        ScheduleVersions versions,
        IReadOnlyDictionary<long, MemberPosition> currentPositions,
        DateOnly today)
    {
        var resolved = _scheduleResolver.Resolve(member.MemberId, today, versions.MemberPositions, versions.Schedules);
        var schedule = resolved == null ? null : versions.Schedules.FirstOrDefault(s => s.ScheduleId == resolved.ScheduleId);
        var position = currentPositions.GetValueOrDefault(member.MemberId);

        var managed = member.IsManager
            ? (await _memberRepository.ListManagedPositionIdsAsync(member.MemberId)).Distinct().Order().ToList()
            : new List<long>();

        return new MemberInfo
        {
            MemberId = member.MemberId,
            UserId = member.UserId,
            Name = member.User?.Name ?? string.Empty,
            Email = member.User?.Email ?? string.Empty,
            Status = ApiText.Of(member.Status),
            IsOwner = company.OwnerUserId == member.UserId,
            IsManager = member.IsManager,
            ManagedPositionIds = managed,
            Position = position == null
                ? null
                : new PositionRef { PositionId = position.PositionId, Name = position.Position?.Name ?? string.Empty },
            HasOwnSchedule = resolved?.IsMemberSchedule ?? false,
            JoinedAt = member.JoinedAt,
            CurrentSchedule = schedule == null ? null : ScheduleFactory.ToInfo(schedule)
        };
    }

    /// <summary>Cargo vigente na data por membro (maior <c>effective_from ≤ data</c>).</summary>
    private static Dictionary<long, MemberPosition> CurrentPositions(IEnumerable<MemberPosition> history, DateOnly date) =>
        history
            .Where(mp => mp.EffectiveFrom <= date)
            .GroupBy(mp => mp.MemberId)
            .ToDictionary(g => g.Key, g => g.MaxBy(mp => mp.EffectiveFrom)!);

    /// <summary>Vigência informada ou hoje; data passada → 422 (versões passadas são imutáveis, FR-012).</summary>
    private static DateOnly RequireNotPast(DateOnly? effectiveFrom, DateOnly today)
    {
        var value = effectiveFrom ?? today;
        if (value < today)
            throw new BusinessRuleException(PAST_EFFECTIVE_FROM_MESSAGE);
        return value;
    }

    private static string ParseStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
            return MemberInfo.STATUS_ACTIVE;
        var normalized = status.Trim().ToLowerInvariant();
        return normalized is MemberInfo.STATUS_ACTIVE or MemberInfo.STATUS_INACTIVE or MemberInfo.STATUS_ALL
            ? normalized
            : throw new Exceptions.ValidationException("status", "Situação inválida. Use active, inactive ou all.");
    }

    private async Task<Member> RequireTargetAsync(long companyId, long memberId) =>
        await _memberRepository.GetByIdAsync(companyId, memberId)
        ?? throw new NotFoundException(MEMBER_NOT_FOUND_MESSAGE);

    private async Task<Company> RequireCompanyAsync(long companyId) =>
        await _companyRepository.GetByIdAsync(companyId)
        ?? throw new NotFoundException(AccessContext.COMPANY_NOT_FOUND_MESSAGE);
}
