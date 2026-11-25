using FluentValidation;
using Microsoft.Extensions.Logging;
using Pontua.Domain.Enums;
using Pontua.Domain.Exceptions;
using Pontua.Domain.Interfaces;
using Pontua.Domain.Models;
using Pontua.Domain.Validators;
using Pontua.DTO.Companies;
using Pontua.Infra.Interfaces.Repository;

namespace Pontua.Domain.Services;

/// <summary>Criação, listagem, consulta, edição e transferência de responsabilidade de empresas (FR-004 a FR-007, R-16a).</summary>
public class CompanyService : ICompanyService
{
    /// <summary>Cargo criado automaticamente para o responsável (R-16a).</summary>
    public const string OWNER_POSITION_NAME = "Responsável";

    public const string TRANSFER_INACTIVE_TARGET_MESSAGE =
        "A responsabilidade só pode ser transferida para um membro ativo da empresa.";

    private readonly ICompanyRepository<Company> _companyRepository;
    private readonly IMemberRepository<Member, MemberPosition, ManagerPosition> _memberRepository;
    private readonly IPositionRepository<Position> _positionRepository;
    private readonly IScheduleRepository<Schedule> _scheduleRepository;
    private readonly IUserRepository<User> _userRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICompanyAccessPolicy _accessPolicy;
    private readonly ICompanyClock _companyClock;
    private readonly IClock _clock;
    private readonly IValidator<CompanyInsertInfo> _insertValidator;
    private readonly IValidator<CompanyUpdateInfo> _updateValidator;
    private readonly IValidator<TransferOwnershipInfo> _transferValidator;
    private readonly ILogger<CompanyService> _logger;

    public CompanyService(
        ICompanyRepository<Company> companyRepository,
        IMemberRepository<Member, MemberPosition, ManagerPosition> memberRepository,
        IPositionRepository<Position> positionRepository,
        IScheduleRepository<Schedule> scheduleRepository,
        IUserRepository<User> userRepository,
        IUnitOfWork unitOfWork,
        ICompanyAccessPolicy accessPolicy,
        ICompanyClock companyClock,
        IClock clock,
        IValidator<CompanyInsertInfo> insertValidator,
        IValidator<CompanyUpdateInfo> updateValidator,
        IValidator<TransferOwnershipInfo> transferValidator,
        ILogger<CompanyService> logger)
    {
        _companyRepository = companyRepository;
        _memberRepository = memberRepository;
        _positionRepository = positionRepository;
        _scheduleRepository = scheduleRepository;
        _userRepository = userRepository;
        _unitOfWork = unitOfWork;
        _accessPolicy = accessPolicy;
        _companyClock = companyClock;
        _clock = clock;
        _insertValidator = insertValidator;
        _updateValidator = updateValidator;
        _transferValidator = transferValidator;
        _logger = logger;
    }

    public async Task<List<CompanySummary>> ListAsync(long userId)
    {
        var members = (await _memberRepository.ListByUserAsync(userId)).Where(m => m.IsActive).ToList();
        if (members.Count == 0)
            return new List<CompanySummary>();

        var companies = (await _companyRepository.GetByIdsAsync(members.Select(m => m.CompanyId)))
            .ToDictionary(c => c.CompanyId);
        var history = (await _memberRepository.ListPositionHistoryAsync(members.Select(m => m.MemberId)))
            .GroupBy(mp => mp.MemberId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var result = new List<CompanySummary>();
        foreach (var member in members)
        {
            if (!companies.TryGetValue(member.CompanyId, out var company))
                continue;

            var today = _companyClock.TodayLocal(company.TimeZone);
            var current = history.TryGetValue(member.MemberId, out var versions)
                ? versions.Where(mp => mp.EffectiveFrom <= today).MaxBy(mp => mp.EffectiveFrom)
                : null;

            result.Add(new CompanySummary
            {
                CompanyId = company.CompanyId,
                Name = company.Name,
                IsOwner = company.OwnerUserId == userId,
                IsManager = member.IsManager,
                MemberId = member.MemberId,
                PositionName = current?.Position?.Name
            });
        }

        return result.OrderBy(c => c.Name, StringComparer.CurrentCultureIgnoreCase).ThenBy(c => c.CompanyId).ToList();
    }

    public async Task<CompanyInfo> CreateAsync(long userId, CompanyInsertInfo info)
    {
        await _insertValidator.EnsureValidAsync(info);

        var user = await _userRepository.GetByIdAsync(userId) ?? throw new UnauthorizedException();
        var timeZone = string.IsNullOrEmpty(info.TimeZone) ? Company.DEFAULT_TIME_ZONE : info.TimeZone;
        var now = _clock.UtcNow;
        var today = _companyClock.TodayLocal(timeZone);

        Company company;
        Member owner;
        await _unitOfWork.BeginTransactionAsync();
        try
        {
            company = await _companyRepository.InsertAsync(new Company
            {
                Name = info.Name.Trim(),
                Document = NormalizeDocument(info.Document),
                TimeZone = timeZone,
                ManualRetroDays = Company.DEFAULT_MANUAL_RETRO_DAYS,
                OwnerUserId = userId,
                LastNsr = 0,
                CreatedAt = now,
                UpdatedAt = now
            });

            owner = await _memberRepository.InsertAsync(new Member
            {
                CompanyId = company.CompanyId,
                UserId = userId,
                Status = MemberStatus.Active,
                IsManager = false,
                JoinedAt = now,
                ActiveSince = today,
                CreatedAt = now,
                UpdatedAt = now
            });

            // Cargo inicial com a jornada semanal padrão, para o responsável marcar ponto de imediato (R-16a).
            var position = await _positionRepository.InsertAsync(new Position
            {
                CompanyId = company.CompanyId,
                Name = OWNER_POSITION_NAME,
                CreatedAt = now,
                UpdatedAt = now
            });

            await _scheduleRepository.InsertAsync(ScheduleFactory.Create(
                ScheduleFactory.DefaultWeekly(),
                company.CompanyId,
                positionId: position.PositionId,
                memberId: null,
                effectiveFrom: today,
                createdByUserId: userId,
                utcNow: now));

            await _memberRepository.UpsertPositionAsync(new MemberPosition
            {
                MemberId = owner.MemberId,
                PositionId = position.PositionId,
                EffectiveFrom = today,
                CreatedByUserId = userId,
                CreatedAt = now
            });

            await _unitOfWork.CommitAsync();
        }
        catch
        {
            await _unitOfWork.RollbackAsync();
            throw;
        }

        _logger.LogInformation("Empresa {CompanyId} criada pelo usuário {UserId}.", company.CompanyId, userId);

        var access = new AccessContext
        {
            CompanyId = company.CompanyId,
            UserId = userId,
            MemberId = owner.MemberId,
            IsActive = true,
            IsOwner = true
        };
        return ToInfo(company, owner.MemberId, user, access);
    }

    public async Task<CompanyInfo> GetAsync(long companyId, long userId)
    {
        var access = await _accessPolicy.RequireMemberAsync(companyId, userId);
        return await BuildInfoAsync(companyId, access);
    }

    public async Task<CompanyInfo> UpdateAsync(long companyId, long userId, CompanyUpdateInfo info)
    {
        // Acesso antes da validação: quem não é membro recebe 404 sem saber se o corpo era válido.
        var access = await _accessPolicy.RequireOwnerAsync(companyId, userId);
        await _updateValidator.EnsureValidAsync(info);

        var company = await _companyRepository.GetByIdAsync(companyId)
            ?? throw new NotFoundException(AccessContext.COMPANY_NOT_FOUND_MESSAGE);
        company.Name = info.Name.Trim();
        company.Document = NormalizeDocument(info.Document);
        company.TimeZone = info.TimeZone;
        company.ManualRetroDays = info.ManualRetroDays;
        company.UpdatedAt = _clock.UtcNow;
        await _companyRepository.UpdateAsync(company);

        return await BuildInfoAsync(companyId, access);
    }

    public async Task<CompanyInfo> TransferOwnershipAsync(long companyId, long userId, TransferOwnershipInfo info)
    {
        var access = await _accessPolicy.RequireOwnerAsync(companyId, userId);
        await _transferValidator.EnsureValidAsync(info);

        var company = await _companyRepository.GetByIdAsync(companyId)
            ?? throw new NotFoundException(AccessContext.COMPANY_NOT_FOUND_MESSAGE);
        var target = await _memberRepository.GetByIdAsync(companyId, info.MemberId!.Value)
            ?? throw new NotFoundException(MemberService.MEMBER_NOT_FOUND_MESSAGE);
        if (!target.IsActive)
            throw new BusinessRuleException(TRANSFER_INACTIVE_TARGET_MESSAGE);

        // Transferir para si mesmo não muda nada.
        if (target.UserId == company.OwnerUserId)
            return await BuildInfoAsync(companyId, access);

        var previousOwnerUserId = company.OwnerUserId;
        var now = _clock.UtcNow;
        await _unitOfWork.BeginTransactionAsync();
        try
        {
            company.OwnerUserId = target.UserId;
            company.UpdatedAt = now;
            await _companyRepository.UpdateAsync(company);

            // O novo responsável já supervisiona todos: perde a designação de gestor e os cargos (FR-006). O antigo
            // responsável continua membro ativo comum (não era gestor).
            target.IsManager = false;
            target.UpdatedAt = now;
            await _memberRepository.UpdateAsync(target);
            await _memberRepository.ReplaceManagedPositionsAsync(target.MemberId, Array.Empty<ManagerPosition>());

            await _unitOfWork.CommitAsync();
        }
        catch
        {
            await _unitOfWork.RollbackAsync();
            throw;
        }

        _logger.LogInformation(
            "Responsabilidade da empresa {CompanyId} transferida do usuário {PreviousOwnerUserId} para o membro {MemberId} (usuário {NewOwnerUserId}).",
            companyId, previousOwnerUserId, target.MemberId, target.UserId);

        // O chamador deixou de ser o responsável: o myAccess da resposta reflete isso.
        return await BuildInfoAsync(companyId, await _accessPolicy.GetContextAsync(companyId, userId));
    }

    private async Task<CompanyInfo> BuildInfoAsync(long companyId, AccessContext access)
    {
        var company = await _companyRepository.GetByIdAsync(companyId)
            ?? throw new NotFoundException(AccessContext.COMPANY_NOT_FOUND_MESSAGE);
        var owner = await _memberRepository.GetByCompanyAndUserAsync(companyId, company.OwnerUserId);
        var ownerUser = owner?.User ?? await _userRepository.GetByIdAsync(company.OwnerUserId);
        return ToInfo(company, owner?.MemberId ?? 0, ownerUser, access);
    }

    private static CompanyInfo ToInfo(Company company, long ownerMemberId, User? ownerUser, AccessContext access) => new()
    {
        CompanyId = company.CompanyId,
        Name = company.Name,
        Document = company.Document,
        TimeZone = company.TimeZone,
        ManualRetroDays = company.ManualRetroDays,
        Owner = new CompanyOwnerInfo
        {
            MemberId = ownerMemberId,
            UserId = company.OwnerUserId,
            Name = ownerUser?.Name ?? string.Empty
        },
        MyAccess = new MyAccessInfo
        {
            MemberId = access.MemberId ?? 0,
            IsOwner = access.IsOwner,
            IsManager = access.IsManager,
            ManagedPositionIds = access.ManagedPositionIds.OrderBy(id => id).ToList()
        },
        CreatedAt = company.CreatedAt
    };

    private static string? NormalizeDocument(string? document) =>
        string.IsNullOrWhiteSpace(document) ? null : document.Trim();
}
