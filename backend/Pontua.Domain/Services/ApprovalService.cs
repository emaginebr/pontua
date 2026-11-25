using FluentValidation;
using Microsoft.Extensions.Logging;
using Pontua.Domain.Enums;
using Pontua.Domain.Exceptions;
using Pontua.Domain.Interfaces;
using Pontua.Domain.Models;
using Pontua.Domain.Validators;
using Pontua.DTO.Approvals;
using Pontua.DTO.Punches;
using Pontua.Infra.Interfaces.Repository;

namespace Pontua.Domain.Services;

/// <summary>
/// Painel de pendências (R-12) e aprovação/rejeição de marcações (R-11, FR-024, FR-025). O painel é montado em
/// memória a partir de consultas em lote (membros, versões de cargo/jornada e marcações do intervalo); as mudanças
/// de status usam o <c>UpdateStatusAsync</c> condicionado ao status anterior, numa transação.
/// </summary>
public class ApprovalService : IApprovalService
{
    public const string PANEL_FORBIDDEN_MESSAGE = "Somente o responsável ou um gestor pode ver o painel de pendências.";
    public const string OWN_PUNCH_MESSAGE =
        "Gestores não podem analisar as próprias marcações. Elas são analisadas pelo responsável ou por outro gestor do cargo.";
    public const string NOT_PENDING_MESSAGE = "A marcação não está pendente.";
    public const string ORIGINAL_UNAVAILABLE_MESSAGE = "A marcação original já não está válida ou aprovada.";

    /// <summary>Nota gravada na original substituída por uma correção aprovada.</summary>
    public const string SUPERSEDED_NOTE = "auto: substituída pela correção NSR {0}";

    private readonly IPunchRepository<Punch, PunchStatusChange> _punchRepository;
    private readonly IMemberRepository<Member, MemberPosition, ManagerPosition> _memberRepository;
    private readonly IScheduleRepository<Schedule> _scheduleRepository;
    private readonly ICompanyRepository<Company> _companyRepository;
    private readonly IUserRepository<User> _userRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICompanyAccessPolicy _accessPolicy;
    private readonly IScheduleResolver _scheduleResolver;
    private readonly ICompanyClock _companyClock;
    private readonly IClock _clock;
    private readonly IValidator<ReviewInsertInfo> _reviewValidator;
    private readonly ILogger<ApprovalService> _logger;

    public ApprovalService(
        IPunchRepository<Punch, PunchStatusChange> punchRepository,
        IMemberRepository<Member, MemberPosition, ManagerPosition> memberRepository,
        IScheduleRepository<Schedule> scheduleRepository,
        ICompanyRepository<Company> companyRepository,
        IUserRepository<User> userRepository,
        IUnitOfWork unitOfWork,
        ICompanyAccessPolicy accessPolicy,
        IScheduleResolver scheduleResolver,
        ICompanyClock companyClock,
        IClock clock,
        IValidator<ReviewInsertInfo> reviewValidator,
        ILogger<ApprovalService> logger)
    {
        _punchRepository = punchRepository;
        _memberRepository = memberRepository;
        _scheduleRepository = scheduleRepository;
        _companyRepository = companyRepository;
        _userRepository = userRepository;
        _unitOfWork = unitOfWork;
        _accessPolicy = accessPolicy;
        _scheduleResolver = scheduleResolver;
        _companyClock = companyClock;
        _clock = clock;
        _reviewValidator = reviewValidator;
        _logger = logger;
    }

    public async Task<List<PendingPanelDay>> GetPanelAsync(long companyId, long userId, PanelQuery? query)
    {
        var access = await _accessPolicy.RequireMemberAsync(companyId, userId);
        if (!access.CanSuperviseAnyone)
            throw new ForbiddenException(PANEL_FORBIDDEN_MESSAGE);
        var type = ParseType(query?.Type);

        var company = await RequireCompanyAsync(companyId);
        var timeZone = company.TimeZone;
        var today = _companyClock.TodayLocal(timeZone);
        var range = DateRangeResolver.Resolve(query, today);

        // 1) Membros (com usuário) que estiveram ativos em algum dia do intervalo. O gestor não se vê no painel:
        //    as próprias marcações são analisadas pelo responsável ou por outro gestor (FR-022e).
        var members = (await _memberRepository.ListByCompanyAsync(companyId))
            .Where(m => m.ActiveSince <= range.End
                        && (m.DeactivatedAt == null || _companyClock.LocalDate(m.DeactivatedAt.Value, timeZone) > range.Start))
            .Where(m => access.IsOwner || m.MemberId != access.MemberId)
            .OrderBy(m => m.User?.Name ?? string.Empty, StringComparer.CurrentCultureIgnoreCase)
            .ThenBy(m => m.MemberId)
            .ToList();
        if (members.Count == 0)
            return new List<PendingPanelDay>();
        var memberIds = members.Select(m => m.MemberId).ToList();

        // 2) Versões de cargo e jornada, em lote.
        var versions = await ScheduleVersions.LoadAsync(_memberRepository, _scheduleRepository, memberIds);
        var schedules = _scheduleResolver.ResolveRange(memberIds, range.Start, range.End, versions.MemberPositions, versions.Schedules);
        var positionHistory = versions.MemberPositions
            .GroupBy(mp => mp.MemberId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(mp => mp.EffectiveFrom).ToList());

        // 3) Marcações do intervalo (índice (company_id, work_date)).
        var punchesByMemberDay = (await _punchRepository.ListByCompanyAsync(companyId, range.Start, range.End, memberIds))
            .GroupBy(p => (p.MemberId, p.WorkDate))
            .ToDictionary(g => g.Key, g => g.ToList());

        var entries = new List<(DateOnly Date, Member Member, string? Position, string Situation, DayEvaluation Day)>();
        for (var day = range.End; day >= range.Start; day = day.AddDays(-1))
        {
            foreach (var member in members)
            {
                if (!MemberActivity.IsActiveOn(member, day, timeZone, _companyClock))
                    continue;

                // Cargo vigente no dia: define o escopo do gestor e o filtro por cargo (data-model › manager_positions).
                var position = positionHistory.TryGetValue(member.MemberId, out var history)
                    ? history.FirstOrDefault(mp => mp.EffectiveFrom <= day)
                    : null;
                if (!access.IsOwner && (position == null || !access.ManagedPositionIds.Contains(position.PositionId)))
                    continue;
                if (query?.PositionId != null && position?.PositionId != query.PositionId)
                    continue;

                var evaluation = DayEvaluator.Evaluate(
                    day,
                    schedules[member.MemberId].GetValueOrDefault(day),
                    punchesByMemberDay.TryGetValue((member.MemberId, day), out var dayPunches) ? dayPunches : new List<Punch>(),
                    countsExpected: day <= today);

                var situation = evaluation.HasPending
                    ? PendingPanelMember.SITUATION_PENDING
                    : evaluation.Missing ? PendingPanelMember.SITUATION_MISSING : null;
                if (situation == null || (type != PanelQuery.TYPE_ALL && type != situation))
                    continue;

                entries.Add((day, member, position?.Position?.Name, situation, evaluation));
            }
        }

        var reviews = await ReviewsAsync(entries.SelectMany(e => e.Day.Punches.Select(p => p.Punch)));
        return entries
            .GroupBy(e => e.Date)
            .Select(g => new PendingPanelDay
            {
                Date = g.Key,
                Members = g.Select(e => new PendingPanelMember
                {
                    MemberId = e.Member.MemberId,
                    Name = e.Member.User?.Name ?? string.Empty,
                    Position = e.Position,
                    Situation = e.Situation,
                    IsWorkDay = e.Day.IsWorkDay,
                    Punches = e.Day.Punches
                        .Select(p => PunchMapper.ToInfo(p.Punch, p.Period?.Name, timeZone, _companyClock,
                            reviews.TryGetValue(p.Punch.PunchId, out var review) ? review : null))
                        .ToList()
                }).ToList()
            })
            .ToList();
    }

    public Task<PunchInfo> ApproveAsync(long companyId, long userId, long punchId, ReviewInsertInfo? info) =>
        ReviewAsync(companyId, userId, punchId, info, PunchStatus.Approved);

    public Task<PunchInfo> RejectAsync(long companyId, long userId, long punchId, ReviewInsertInfo? info) =>
        ReviewAsync(companyId, userId, punchId, info, PunchStatus.Rejected);

    private async Task<PunchInfo> ReviewAsync(long companyId, long userId, long punchId, ReviewInsertInfo? info, PunchStatus decision)
    {
        var access = await _accessPolicy.RequireMemberAsync(companyId, userId);
        info ??= new ReviewInsertInfo();
        await _reviewValidator.EnsureValidAsync(info);

        var company = await RequireCompanyAsync(companyId);
        var punch = await _punchRepository.GetByIdAsync(companyId, punchId)
            ?? throw new NotFoundException(PunchService.PUNCH_NOT_FOUND_MESSAGE);

        // FR-022e: gestor não analisa a própria marcação; o responsável analisa qualquer uma, inclusive as suas.
        if (!access.IsOwner && punch.MemberId == access.MemberId)
            throw new ForbiddenException(OWN_PUNCH_MESSAGE);
        await _accessPolicy.RequireCanSuperviseAsync(access, punch.MemberId, punch.WorkDate);
        if (punch.Status != PunchStatus.Pending)
            throw new ConflictException(NOT_PENDING_MESSAGE);

        var now = _clock.UtcNow;
        PunchStatusChange change;
        Punch? original = null;
        await _unitOfWork.BeginTransactionAsync();
        try
        {
            change = punch.ChangeStatus(decision, userId, info.Note, now);
            if (!await _punchRepository.UpdateStatusAsync(punch, change))
                throw new ConflictException(NOT_PENDING_MESSAGE);

            // Correção aprovada (R-11): a original deixa de contar e vira Superseded, mantida consultável.
            if (decision == PunchStatus.Approved && punch.ReplacesPunchId != null)
            {
                original = await _punchRepository.GetByIdAsync(companyId, punch.ReplacesPunchId.Value)
                    ?? throw new ConflictException(ORIGINAL_UNAVAILABLE_MESSAGE);
                var originalChange = original.ChangeStatus(
                    PunchStatus.Superseded, userId, string.Format(SUPERSEDED_NOTE, punch.Nsr), now);
                if (!await _punchRepository.UpdateStatusAsync(original, originalChange))
                    throw new ConflictException(ORIGINAL_UNAVAILABLE_MESSAGE);
            }

            await _unitOfWork.CommitAsync();
        }
        catch
        {
            await _unitOfWork.RollbackAsync();
            throw;
        }

        _logger.LogInformation(
            "Marcação {PunchId} (NSR {Nsr}) do membro {MemberId} na empresa {CompanyId} analisada pelo usuário {UserId}: {Status}; original substituída: {SupersededPunchId}.",
            punch.PunchId, punch.Nsr, punch.MemberId, companyId, userId, punch.Status, original?.PunchId);

        var reviewer = await _userRepository.GetByIdAsync(userId);
        var periodNames = await MemberDays.PeriodNamesAsync(
            _memberRepository, _scheduleRepository, _punchRepository, _scheduleResolver, punch.MemberId, new[] { punch });
        return PunchMapper.ToInfo(
            punch,
            periodNames.GetValueOrDefault(punch.PunchId),
            company.TimeZone,
            _companyClock,
            new ReviewInfo { By = reviewer?.Name ?? string.Empty, At = change.ChangedAt, Note = change.Note });
    }

    /// <summary>Última análise das marcações aprovadas/rejeitadas informadas (uma consulta em lote, só se houver).</summary>
    private async Task<IReadOnlyDictionary<long, ReviewInfo>> ReviewsAsync(IEnumerable<Punch> punches)
    {
        var reviewed = punches.Where(p => p.Status is PunchStatus.Approved or PunchStatus.Rejected).Select(p => p.PunchId).Distinct().ToList();
        if (reviewed.Count == 0)
            return new Dictionary<long, ReviewInfo>();

        var history = await _punchRepository.ListStatusHistoriesAsync(reviewed);
        var userIds = history.Select(c => c.ChangedByUserId).Distinct().ToList();
        var names = userIds.Count == 0
            ? new Dictionary<long, string>()
            : (await _userRepository.GetByIdsAsync(userIds)).ToDictionary(u => u.UserId, u => u.Name);
        return PunchMapper.Reviews(history, names);
    }

    private static string ParseType(string? type)
    {
        if (string.IsNullOrWhiteSpace(type))
            return PanelQuery.TYPE_ALL;
        var normalized = type.Trim().ToLowerInvariant();
        return normalized is PanelQuery.TYPE_ALL or PanelQuery.TYPE_MISSING or PanelQuery.TYPE_PENDING
            ? normalized
            : throw new Exceptions.ValidationException("type", "Tipo inválido. Use all, missing ou pending.");
    }

    private async Task<Company> RequireCompanyAsync(long companyId) =>
        await _companyRepository.GetByIdAsync(companyId)
        ?? throw new NotFoundException(AccessContext.COMPANY_NOT_FOUND_MESSAGE);
}
