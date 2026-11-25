using FluentValidation;
using Microsoft.Extensions.Logging;
using Pontua.Domain.Exceptions;
using Pontua.Domain.Interfaces;
using Pontua.Domain.Models;
using Pontua.Domain.Validators;
using Pontua.DTO.Positions;
using Pontua.DTO.Schedules;
using Pontua.Infra.Interfaces.Repository;

namespace Pontua.Domain.Services;

/// <summary>
/// Cargos e jornadas dos cargos (FR-008 a FR-012). Jornadas são versionadas por vigência (R-08): alterar =
/// inserir nova versão; só versões de hoje em diante podem ser substituídas.
/// </summary>
public class PositionService : IPositionService
{
    public const string POSITION_NOT_FOUND_MESSAGE = "Cargo não encontrado.";
    public const string DUPLICATE_NAME_MESSAGE = "Já existe um cargo com este nome nesta empresa.";
    public const string PAST_EFFECTIVE_FROM_MESSAGE = "A vigência da jornada não pode ser uma data passada.";
    public const string HAS_ACTIVE_MEMBERS_MESSAGE =
        "O cargo tem membros ativos vinculados. Mova-os para outro cargo antes de excluí-lo.";
    public const string HAS_HISTORY_MESSAGE =
        "O cargo já foi usado (membros, convites ou gestores) e não pode ser excluído. Renomeie-o, se necessário.";

    private readonly IPositionRepository<Position> _positionRepository;
    private readonly IScheduleRepository<Schedule> _scheduleRepository;
    private readonly IMemberRepository<Member, MemberPosition, ManagerPosition> _memberRepository;
    private readonly ICompanyRepository<Company> _companyRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICompanyAccessPolicy _accessPolicy;
    private readonly ICompanyClock _companyClock;
    private readonly IClock _clock;
    private readonly IValidator<PositionInsertInfo> _insertValidator;
    private readonly IValidator<PositionUpdateInfo> _updateValidator;
    private readonly IValidator<ScheduleInput> _scheduleValidator;
    private readonly ILogger<PositionService> _logger;

    public PositionService(
        IPositionRepository<Position> positionRepository,
        IScheduleRepository<Schedule> scheduleRepository,
        IMemberRepository<Member, MemberPosition, ManagerPosition> memberRepository,
        ICompanyRepository<Company> companyRepository,
        IUnitOfWork unitOfWork,
        ICompanyAccessPolicy accessPolicy,
        ICompanyClock companyClock,
        IClock clock,
        IValidator<PositionInsertInfo> insertValidator,
        IValidator<PositionUpdateInfo> updateValidator,
        IValidator<ScheduleInput> scheduleValidator,
        ILogger<PositionService> logger)
    {
        _positionRepository = positionRepository;
        _scheduleRepository = scheduleRepository;
        _memberRepository = memberRepository;
        _companyRepository = companyRepository;
        _unitOfWork = unitOfWork;
        _accessPolicy = accessPolicy;
        _companyClock = companyClock;
        _clock = clock;
        _insertValidator = insertValidator;
        _updateValidator = updateValidator;
        _scheduleValidator = scheduleValidator;
        _logger = logger;
    }

    public async Task<List<PositionInfo>> ListAsync(long companyId, long userId)
    {
        await _accessPolicy.RequireMemberAsync(companyId, userId);
        var today = await TodayAsync(companyId);

        var positions = await _positionRepository.ListByCompanyAsync(companyId);
        if (positions.Count == 0)
            return new List<PositionInfo>();

        var schedules = (await _scheduleRepository.ListByPositionsAsync(positions.Select(p => p.PositionId)))
            .GroupBy(s => s.PositionId!.Value)
            .ToDictionary(g => g.Key, g => g.ToList());
        var activeMembers = await CountActiveMembersAsync(companyId, today);

        return positions
            .Select(position => ToInfo(
                position,
                schedules.GetValueOrDefault(position.PositionId) ?? new List<Schedule>(),
                activeMembers.GetValueOrDefault(position.PositionId),
                today,
                includeHistory: false))
            .ToList();
    }

    public async Task<PositionInfo> GetAsync(long companyId, long userId, long positionId)
    {
        await _accessPolicy.RequireMemberAsync(companyId, userId);
        var position = await RequirePositionAsync(companyId, positionId);
        return await BuildInfoAsync(position, includeHistory: true);
    }

    public async Task<PositionInfo> CreateAsync(long companyId, long userId, PositionInsertInfo info)
    {
        await _accessPolicy.RequireOwnerAsync(companyId, userId);
        await _insertValidator.EnsureValidAsync(info);

        var name = info.Name.Trim();
        if (await _positionRepository.ExistsNameAsync(companyId, name))
            throw new ConflictException(DUPLICATE_NAME_MESSAGE);

        var today = await TodayAsync(companyId);
        var now = _clock.UtcNow;

        Position position;
        Schedule schedule;
        await _unitOfWork.BeginTransactionAsync();
        try
        {
            position = await _positionRepository.InsertAsync(new Position
            {
                CompanyId = companyId,
                Name = name,
                CreatedAt = now,
                UpdatedAt = now
            });

            // Todo cargo nasce com uma versão vigente a partir da data de criação (data-model.md › schedules).
            schedule = await _scheduleRepository.InsertAsync(ScheduleFactory.Create(
                info.Schedule!,
                companyId,
                positionId: position.PositionId,
                memberId: null,
                effectiveFrom: today,
                createdByUserId: userId,
                utcNow: now));

            await _unitOfWork.CommitAsync();
        }
        catch
        {
            await _unitOfWork.RollbackAsync();
            throw;
        }

        _logger.LogInformation("Cargo {PositionId} criado na empresa {CompanyId} pelo usuário {UserId}.",
            position.PositionId, companyId, userId);
        return ToInfo(position, new List<Schedule> { schedule }, activeMembers: 0, today, includeHistory: false);
    }

    public async Task<PositionInfo> UpdateAsync(long companyId, long userId, long positionId, PositionUpdateInfo info)
    {
        await _accessPolicy.RequireOwnerAsync(companyId, userId);
        await _updateValidator.EnsureValidAsync(info);

        var position = await RequirePositionAsync(companyId, positionId);
        var name = info.Name.Trim();
        if (await _positionRepository.ExistsNameAsync(companyId, name, exceptPositionId: positionId))
            throw new ConflictException(DUPLICATE_NAME_MESSAGE);

        position.Name = name;
        position.UpdatedAt = _clock.UtcNow;
        position = await _positionRepository.UpdateAsync(position);

        return await BuildInfoAsync(position, includeHistory: false);
    }

    public async Task<ScheduleInfo> SaveScheduleAsync(long companyId, long userId, long positionId, ScheduleInput input)
    {
        await _accessPolicy.RequireOwnerAsync(companyId, userId);
        await _scheduleValidator.EnsureValidAsync(input);

        var position = await RequirePositionAsync(companyId, positionId);
        var today = await TodayAsync(companyId);
        var effectiveFrom = input.EffectiveFrom ?? today;
        // Versões passadas são imutáveis: dias já vividos continuam avaliados pela jornada da época (FR-012).
        if (effectiveFrom < today)
            throw new BusinessRuleException(PAST_EFFECTIVE_FROM_MESSAGE);

        var now = _clock.UtcNow;
        Schedule schedule;
        await _unitOfWork.BeginTransactionAsync();
        try
        {
            // Mesma vigência (hoje ou futura) → substitui a versão (R-08).
            var existing = await _scheduleRepository.GetByPositionAndDateAsync(position.PositionId, effectiveFrom);
            if (existing != null)
                await _scheduleRepository.DeleteAsync(existing.ScheduleId);

            schedule = await _scheduleRepository.InsertAsync(ScheduleFactory.Create(
                input,
                companyId,
                positionId: position.PositionId,
                memberId: null,
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

        _logger.LogInformation("Jornada do cargo {PositionId} gravada com vigência {EffectiveFrom} pelo usuário {UserId}.",
            position.PositionId, effectiveFrom, userId);
        return ScheduleFactory.ToInfo(schedule);
    }

    public async Task DeleteAsync(long companyId, long userId, long positionId)
    {
        await _accessPolicy.RequireOwnerAsync(companyId, userId);
        var position = await RequirePositionAsync(companyId, positionId);

        // Membros ativos têm prioridade na mensagem: a ação esperada é movê-los, não renomear (FR-008).
        var today = await TodayAsync(companyId);
        var activeMembers = await CountActiveMembersAsync(companyId, today);
        if (activeMembers.GetValueOrDefault(position.PositionId) > 0)
            throw new BusinessRuleException(HAS_ACTIVE_MEMBERS_MESSAGE);

        if (await _positionRepository.HasHistoryAsync(position.PositionId))
            throw new ConflictException(HAS_HISTORY_MESSAGE);

        await _positionRepository.DeleteAsync(position.PositionId);
        _logger.LogInformation("Cargo {PositionId} excluído da empresa {CompanyId} pelo usuário {UserId}.",
            position.PositionId, companyId, userId);
    }

    private async Task<Position> RequirePositionAsync(long companyId, long positionId) =>
        await _positionRepository.GetByIdAsync(companyId, positionId)
        ?? throw new NotFoundException(POSITION_NOT_FOUND_MESSAGE);

    private async Task<DateOnly> TodayAsync(long companyId)
    {
        var company = await _companyRepository.GetByIdAsync(companyId)
            ?? throw new NotFoundException(AccessContext.COMPANY_NOT_FOUND_MESSAGE);
        return _companyClock.TodayLocal(company.TimeZone);
    }

    private async Task<PositionInfo> BuildInfoAsync(Position position, bool includeHistory)
    {
        var today = await TodayAsync(position.CompanyId);
        var schedules = await _scheduleRepository.ListByPositionsAsync(new[] { position.PositionId });
        var activeMembers = await CountActiveMembersAsync(position.CompanyId, today);
        return ToInfo(position, schedules, activeMembers.GetValueOrDefault(position.PositionId), today, includeHistory);
    }

    /// <summary>Membros ativos por cargo vigente hoje (<c>member_positions</c> com maior vigência ≤ hoje).</summary>
    private async Task<Dictionary<long, int>> CountActiveMembersAsync(long companyId, DateOnly today)
    {
        var activeMemberIds = (await _memberRepository.ListByCompanyAsync(companyId))
            .Where(m => m.IsActive)
            .Select(m => m.MemberId)
            .ToList();
        if (activeMemberIds.Count == 0)
            return new Dictionary<long, int>();

        return (await _memberRepository.ListPositionHistoryAsync(activeMemberIds))
            .Where(mp => mp.EffectiveFrom <= today)
            .GroupBy(mp => mp.MemberId)
            .Select(g => g.MaxBy(mp => mp.EffectiveFrom)!.PositionId)
            .GroupBy(positionId => positionId)
            .ToDictionary(g => g.Key, g => g.Count());
    }

    private static PositionInfo ToInfo(
        Position position,
        IReadOnlyCollection<Schedule> schedules,
        int activeMembers,
        DateOnly today,
        bool includeHistory)
    {
        var current = ScheduleFactory.CurrentOn(schedules, today);
        return new PositionInfo
        {
            PositionId = position.PositionId,
            Name = position.Name,
            ActiveMembers = activeMembers,
            CurrentSchedule = current == null ? null : ScheduleFactory.ToInfo(current),
            ScheduleHistory = includeHistory
                ? schedules.OrderByDescending(s => s.EffectiveFrom).Select(ScheduleFactory.ToInfo).ToList()
                : null
        };
    }
}
