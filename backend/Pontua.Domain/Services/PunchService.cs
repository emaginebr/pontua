using FluentValidation;
using Microsoft.Extensions.Logging;
using Pontua.Domain.Enums;
using Pontua.Domain.Exceptions;
using Pontua.Domain.Interfaces;
using Pontua.Domain.Models;
using Pontua.Domain.Validators;
using Pontua.DTO.Common;
using Pontua.DTO.Punches;
using Pontua.Infra.Interfaces.Repository;

namespace Pontua.Domain.Services;

/// <summary>
/// Registro e consulta de marcações (R-04, R-05, R-07, R-10, R-11). Toda gravação aloca o NSR, insere a marcação e a
/// linha inicial de <c>punch_status_changes</c> na mesma transação; o lock da linha da empresa (NSR) também serializa
/// as verificações de 60 s e de idempotência offline. Mudanças de status (cancelamento) usam o
/// <c>UpdateStatusAsync</c> condicionado ao status anterior (409 se outra operação chegou antes).
/// </summary>
public class PunchService : IPunchService
{
    public static readonly TimeSpan MIN_INTERVAL = TimeSpan.FromSeconds(60);
    public static readonly TimeSpan FUTURE_TOLERANCE = TimeSpan.FromMinutes(2);

    public const string TOO_SOON_MESSAGE = "Aguarde pelo menos 1 minuto após a marcação anterior para marcar o ponto novamente.";
    public const string PUNCH_NOT_FOUND_MESSAGE = "Marcação não encontrada.";
    public const string MANUAL_FUTURE_MESSAGE = "A data e o horário da marcação manual não podem estar no futuro.";
    public const string MANUAL_TOO_OLD_MESSAGE =
        "A data da marcação manual é anterior ao limite retroativo da empresa ({0} dias). Fale com o responsável.";
    public const string REPLACED_NOT_OWN_MESSAGE = "Só é possível corrigir as suas próprias marcações.";
    public const string REPLACED_NOT_CORRECTABLE_MESSAGE = "Só é possível corrigir marcações válidas ou aprovadas.";
    public const string CANCEL_NOT_AUTHOR_MESSAGE = "Só quem registrou a marcação manual pode cancelá-la.";
    public const string CANCEL_NOT_MANUAL_MESSAGE = "Só marcações manuais pendentes podem ser canceladas.";
    public const string STATUS_CHANGED_MESSAGE = "A marcação foi alterada por outra operação. Atualize e tente novamente.";

    /// <summary>Nota gravada na correção pendente cancelada automaticamente por uma nova correção (R-11).</summary>
    public const string AUTO_CANCEL_NOTE = "auto: nova correção";

    private readonly IPunchRepository<Punch, PunchStatusChange> _punchRepository;
    private readonly IMemberRepository<Member, MemberPosition, ManagerPosition> _memberRepository;
    private readonly IScheduleRepository<Schedule> _scheduleRepository;
    private readonly ICompanyRepository<Company> _companyRepository;
    private readonly IUserRepository<User> _userRepository;
    private readonly INsrAllocator _nsrAllocator;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICompanyAccessPolicy _accessPolicy;
    private readonly IScheduleResolver _scheduleResolver;
    private readonly ICompanyClock _companyClock;
    private readonly IClock _clock;
    private readonly IValidator<OfflinePunchBatchInfo> _offlineValidator;
    private readonly IValidator<ManualPunchInsertInfo> _manualValidator;
    private readonly ILogger<PunchService> _logger;

    public PunchService(
        IPunchRepository<Punch, PunchStatusChange> punchRepository,
        IMemberRepository<Member, MemberPosition, ManagerPosition> memberRepository,
        IScheduleRepository<Schedule> scheduleRepository,
        ICompanyRepository<Company> companyRepository,
        IUserRepository<User> userRepository,
        INsrAllocator nsrAllocator,
        IUnitOfWork unitOfWork,
        ICompanyAccessPolicy accessPolicy,
        IScheduleResolver scheduleResolver,
        ICompanyClock companyClock,
        IClock clock,
        IValidator<OfflinePunchBatchInfo> offlineValidator,
        IValidator<ManualPunchInsertInfo> manualValidator,
        ILogger<PunchService> logger)
    {
        _punchRepository = punchRepository;
        _memberRepository = memberRepository;
        _scheduleRepository = scheduleRepository;
        _companyRepository = companyRepository;
        _userRepository = userRepository;
        _nsrAllocator = nsrAllocator;
        _unitOfWork = unitOfWork;
        _accessPolicy = accessPolicy;
        _scheduleResolver = scheduleResolver;
        _companyClock = companyClock;
        _clock = clock;
        _offlineValidator = offlineValidator;
        _manualValidator = manualValidator;
        _logger = logger;
    }

    public async Task<PunchInfo> PunchAsync(long companyId, long userId)
    {
        var access = await _accessPolicy.RequireMemberAsync(companyId, userId);
        var memberId = access.MemberId!.Value;
        var company = await RequireCompanyAsync(companyId);

        var now = _clock.UtcNow;
        var workDate = _companyClock.LocalDate(now, company.TimeZone);

        var versions = await ScheduleVersions.LoadAsync(_memberRepository, _scheduleRepository, new[] { memberId });
        var schedule = _scheduleResolver.Resolve(memberId, workDate, versions.MemberPositions, versions.Schedules);
        var isWorkDay = schedule?.IsWorkDay ?? false;

        Punch punch;
        await _unitOfWork.BeginTransactionAsync();
        try
        {
            // O NSR é alocado primeiro: o lock da empresa serializa marcações concorrentes, e a regra dos 60 s é
            // verificada já enxergando a marcação anterior confirmada. O rollback desfaz o NSR (sem lacunas).
            var nsr = await _nsrAllocator.NextAsync(companyId);

            var last = await _punchRepository.GetLastAutomaticPunchedAtAsync(memberId);
            if (last != null && now - last.Value < MIN_INTERVAL)
                throw new BusinessRuleException(TOO_SOON_MESSAGE);

            punch = Punch.Create(
                companyId,
                memberId,
                nsr,
                PunchKind.Normal,
                punchedAtUtc: now,
                workDate: workDate,
                receivedAtUtc: now,
                status: isWorkDay ? PunchStatus.Valid : PunchStatus.Pending,
                pendingReason: isWorkDay ? null : PendingReason.OutsideWorkday,
                createdByUserId: userId);
            punch = await _punchRepository.InsertAsync(punch, punch.CreationChange(now));

            await _unitOfWork.CommitAsync();
        }
        catch
        {
            await _unitOfWork.RollbackAsync();
            throw;
        }

        _logger.LogInformation(
            "Marcação {PunchId} (NSR {Nsr}) registrada pelo membro {MemberId} na empresa {CompanyId}: {Status}.",
            punch.PunchId, punch.Nsr, memberId, companyId, punch.Status);

        // Período calculado na leitura (R-07): avalia o dia com a nova marcação.
        var dayPunches = await _punchRepository.ListByMemberAsync(memberId, workDate, workDate);
        if (dayPunches.All(p => p.PunchId != punch.PunchId))
            dayPunches.Add(punch);
        var evaluation = DayEvaluator.Evaluate(workDate, schedule, dayPunches);
        return PunchMapper.ToInfo(punch, DayEvaluator.PeriodNameOf(evaluation, punch), company.TimeZone, _companyClock);
    }

    public async Task<OfflineSyncResult> SyncOfflineAsync(long companyId, long userId, OfflinePunchBatchInfo batch)
    {
        var access = await _accessPolicy.RequireMemberAsync(companyId, userId);
        await _offlineValidator.EnsureValidAsync(batch);

        var memberId = access.MemberId!.Value;
        var company = await RequireCompanyAsync(companyId);
        var now = _clock.UtcNow;
        var retroLimit = _companyClock.LocalDate(now, company.TimeZone).AddDays(-company.ManualRetroDays);

        var outcomes = new List<(string ClientId, string Result, Punch? Punch)>();
        foreach (var item in batch.Items!)
        {
            OfflinePunchBatchInfoValidator.TryParseClientId(item.ClientId, out var clientId);
            OfflinePunchBatchInfoValidator.TryParsePunchedAt(item.PunchedAt, out var punchedAt);
            var (result, punch) = await SyncItemAsync(company, memberId, userId, clientId, punchedAt.UtcDateTime, now, retroLimit);
            outcomes.Add((item.ClientId!.Trim(), result, punch));
        }

        var created = outcomes.Count(o => o.Result == OfflineSyncItemResult.CREATED);
        _logger.LogInformation(
            "Sincronização offline do membro {MemberId} na empresa {CompanyId}: {Total} itens, {Created} gravados.",
            memberId, companyId, outcomes.Count, created);

        var periodNames = await PeriodNamesAsync(memberId, outcomes.Where(o => o.Punch != null).Select(o => o.Punch!).ToList());
        return new OfflineSyncResult
        {
            Items = outcomes.Select(o => new OfflineSyncItemResult
            {
                ClientId = o.ClientId,
                Result = o.Result,
                Punch = o.Punch == null
                    ? null
                    : PunchMapper.ToInfo(o.Punch, periodNames.GetValueOrDefault(o.Punch.PunchId), company.TimeZone, _companyClock)
            }).ToList()
        };
    }

    public async Task<PunchInfo> CreateManualAsync(long companyId, long userId, ManualPunchInsertInfo info)
    {
        var access = await _accessPolicy.RequireMemberAsync(companyId, userId);
        await _manualValidator.EnsureValidAsync(info);

        var memberId = access.MemberId!.Value;
        var company = await RequireCompanyAsync(companyId);
        var now = _clock.UtcNow;
        var today = _companyClock.TodayLocal(company.TimeZone);
        var workDate = info.WorkDate!.Value;

        // Instante montado no fuso da empresa (R-06); nunca no futuro e nunca antes do limite retroativo (FR-018a).
        var punchedAt = _companyClock.ToUtc(workDate, info.Time!.Value, company.TimeZone);
        if (punchedAt > now)
            throw new BusinessRuleException(MANUAL_FUTURE_MESSAGE);
        if (workDate < today.AddDays(-company.ManualRetroDays))
            throw new BusinessRuleException(string.Format(MANUAL_TOO_OLD_MESSAGE, company.ManualRetroDays));

        Punch? original = null;
        if (info.ReplacesPunchId != null)
        {
            original = await _punchRepository.GetByIdAsync(companyId, info.ReplacesPunchId.Value)
                ?? throw new NotFoundException(PUNCH_NOT_FOUND_MESSAGE);
            if (original.MemberId != memberId)
                throw new ConflictException(REPLACED_NOT_OWN_MESSAGE);
            if (original.Status is not (PunchStatus.Valid or PunchStatus.Approved))
                throw new ConflictException(REPLACED_NOT_CORRECTABLE_MESSAGE);
        }

        Punch punch;
        var autoCancelled = new List<long>();
        await _unitOfWork.BeginTransactionAsync();
        try
        {
            var nsr = await _nsrAllocator.NextAsync(companyId);

            // Correções sobrepostas (R-11): a correção pendente anterior da mesma original é cancelada na mesma
            // transação, com histórico de quem e quando.
            if (original != null)
            {
                foreach (var previous in await _punchRepository.ListPendingCorrectionsAsync(original.PunchId))
                {
                    var change = previous.ChangeStatus(PunchStatus.Cancelled, userId, AUTO_CANCEL_NOTE, now);
                    if (!await _punchRepository.UpdateStatusAsync(previous, change))
                        throw new ConflictException(STATUS_CHANGED_MESSAGE);
                    autoCancelled.Add(previous.PunchId);
                }
            }

            punch = Punch.Create(
                companyId,
                memberId,
                nsr,
                PunchKind.Manual,
                punchedAtUtc: punchedAt,
                workDate: workDate,
                receivedAtUtc: now,
                status: PunchStatus.Pending,
                pendingReason: PendingReason.Manual,
                createdByUserId: userId,
                justification: info.Justification,
                replacesPunchId: original?.PunchId);
            punch = await _punchRepository.InsertAsync(punch, punch.CreationChange(now));

            await _unitOfWork.CommitAsync();
        }
        catch
        {
            await _unitOfWork.RollbackAsync();
            throw;
        }

        _logger.LogInformation(
            "Marcação manual {PunchId} (NSR {Nsr}) registrada pelo membro {MemberId} na empresa {CompanyId} para {WorkDate}: {Status}; corrige {ReplacesPunchId}; correções canceladas: {AutoCancelled}.",
            punch.PunchId, punch.Nsr, memberId, companyId, workDate, punch.Status, punch.ReplacesPunchId, autoCancelled);

        var periodNames = await PeriodNamesAsync(memberId, new[] { punch });
        return PunchMapper.ToInfo(punch, periodNames.GetValueOrDefault(punch.PunchId), company.TimeZone, _companyClock);
    }

    public async Task CancelAsync(long companyId, long userId, long punchId)
    {
        var access = await _accessPolicy.RequireMemberAsync(companyId, userId);
        var memberId = access.MemberId!.Value;
        var punch = await _punchRepository.GetByIdAsync(companyId, punchId)
            ?? throw new NotFoundException(PUNCH_NOT_FOUND_MESSAGE);

        if (punch.MemberId != memberId || punch.CreatedByUserId != userId)
            throw new ForbiddenException(CANCEL_NOT_AUTHOR_MESSAGE);
        if (punch.Kind != PunchKind.Manual)
            throw new ConflictException(CANCEL_NOT_MANUAL_MESSAGE);

        // ChangeStatus recusa (409) o que não estiver pendente.
        var change = punch.ChangeStatus(PunchStatus.Cancelled, userId, null, _clock.UtcNow);

        await _unitOfWork.BeginTransactionAsync();
        try
        {
            if (!await _punchRepository.UpdateStatusAsync(punch, change))
                throw new ConflictException(STATUS_CHANGED_MESSAGE);
            await _unitOfWork.CommitAsync();
        }
        catch
        {
            await _unitOfWork.RollbackAsync();
            throw;
        }

        _logger.LogInformation(
            "Marcação manual {PunchId} (NSR {Nsr}) cancelada pelo membro {MemberId} na empresa {CompanyId}: {Status}.",
            punch.PunchId, punch.Nsr, memberId, companyId, punch.Status);
    }

    public async Task<List<DayRecord>> GetMyDaysAsync(long companyId, long userId, DateRangeQuery? query)
    {
        var access = await _accessPolicy.RequireMemberAsync(companyId, userId);
        return await BuildDaysAsync(companyId, access.MemberId!.Value, query);
    }

    public async Task<List<DayRecord>> GetDaysAsync(long companyId, long userId, long memberId, DateRangeQuery? query)
    {
        var access = await _accessPolicy.RequireMemberAsync(companyId, userId);
        var company = await RequireCompanyAsync(companyId);
        await _accessPolicy.RequireSelfOrSuperviseAsync(access, memberId, _companyClock.TodayLocal(company.TimeZone));
        return await BuildDaysAsync(companyId, memberId, query);
    }

    public async Task<PunchInfo> GetPunchAsync(long companyId, long userId, long punchId)
    {
        var access = await _accessPolicy.RequireMemberAsync(companyId, userId);
        var company = await RequireCompanyAsync(companyId);
        var punch = await _punchRepository.GetByIdAsync(companyId, punchId)
            ?? throw new NotFoundException(PUNCH_NOT_FOUND_MESSAGE);
        await _accessPolicy.RequireSelfOrSuperviseAsync(access, punch.MemberId, _companyClock.TodayLocal(company.TimeZone));

        var periodNames = await PeriodNamesAsync(punch.MemberId, new[] { punch });
        var history = await _punchRepository.ListStatusHistoryAsync(punch.PunchId);
        var userNames = await UserNamesAsync(history.Select(c => c.ChangedByUserId));

        var info = PunchMapper.ToInfo(
            punch,
            periodNames.GetValueOrDefault(punch.PunchId),
            company.TimeZone,
            _companyClock,
            PunchMapper.Reviews(history, userNames).GetValueOrDefault(punch.PunchId));
        info.StatusHistory = history.Select(c => PunchMapper.ToChangeInfo(c, userNames)).ToList();
        return info;
    }

    /// <summary>Um item do lote offline, na ordem: duplicado → futuro → antigo demais → gravação.</summary>
    private async Task<(string Result, Punch? Punch)> SyncItemAsync(
        Company company,
        long memberId,
        long userId,
        Guid clientId,
        DateTime punchedAtUtc,
        DateTime now,
        DateOnly retroLimit)
    {
        var existing = await _punchRepository.GetByClientIdAsync(memberId, clientId);
        if (existing != null)
            return (OfflineSyncItemResult.DUPLICATE, existing);

        if (punchedAtUtc > now + FUTURE_TOLERANCE)
            return (OfflineSyncItemResult.FUTURE, null);

        var workDate = _companyClock.LocalDate(punchedAtUtc, company.TimeZone);
        if (workDate < retroLimit)
            return (OfflineSyncItemResult.TOO_OLD, null);

        await _unitOfWork.BeginTransactionAsync();
        try
        {
            var nsr = await _nsrAllocator.NextAsync(company.CompanyId);

            // Reenvio concorrente: com o lock da empresa, uma gravação confirmada do mesmo clientId já é visível.
            existing = await _punchRepository.GetByClientIdAsync(memberId, clientId);
            if (existing != null)
            {
                await _unitOfWork.RollbackAsync();
                return (OfflineSyncItemResult.DUPLICATE, existing);
            }

            var punch = Punch.Create(
                company.CompanyId,
                memberId,
                nsr,
                PunchKind.Offline,
                punchedAtUtc: punchedAtUtc,
                workDate: workDate,
                receivedAtUtc: now,
                status: PunchStatus.Pending,
                pendingReason: PendingReason.Offline,
                createdByUserId: userId,
                clientId: clientId);
            punch = await _punchRepository.InsertAsync(punch, punch.CreationChange(now));

            await _unitOfWork.CommitAsync();
            return (OfflineSyncItemResult.CREATED, punch);
        }
        catch (UniqueConstraintViolationException)
        {
            // Última barreira: o índice único (member_id, client_id) recusou uma gravação concorrente.
            await _unitOfWork.RollbackAsync();
            existing = await _punchRepository.GetByClientIdAsync(memberId, clientId);
            if (existing == null)
                throw;
            return (OfflineSyncItemResult.DUPLICATE, existing);
        }
        catch
        {
            await _unitOfWork.RollbackAsync();
            throw;
        }
    }

    private async Task<List<DayRecord>> BuildDaysAsync(long companyId, long memberId, DateRangeQuery? query)
    {
        var company = await RequireCompanyAsync(companyId);
        var today = _companyClock.TodayLocal(company.TimeZone);
        var range = DateRangeResolver.Resolve(query, today);
        var member = await _memberRepository.GetByIdAsync(companyId, memberId)
            ?? throw new NotFoundException(MemberService.MEMBER_NOT_FOUND_MESSAGE);

        // Previsto só nos dias até hoje em que o membro estava ativo (R-09, atualização).
        var (days, punches) = await MemberDays.EvaluateAsync(
            _memberRepository, _scheduleRepository, _punchRepository, _scheduleResolver, memberId, range,
            MemberActivity.ExpectedCounts(member, today, company.TimeZone, _companyClock));

        var reviewed = punches.Where(p => p.Status is PunchStatus.Approved or PunchStatus.Rejected).Select(p => p.PunchId).ToList();
        IReadOnlyDictionary<long, ReviewInfo> reviews = new Dictionary<long, ReviewInfo>();
        if (reviewed.Count > 0)
        {
            var history = await _punchRepository.ListStatusHistoriesAsync(reviewed);
            reviews = PunchMapper.Reviews(history, await UserNamesAsync(history.Select(c => c.ChangedByUserId)));
        }

        return days.Select(day => PunchMapper.ToDayRecord(day, company.TimeZone, _companyClock, reviews)).ToList();
    }

    /// <summary>Período calculado (R-07) de cada marcação informada, avaliando os dias delas.</summary>
    private Task<Dictionary<long, string?>> PeriodNamesAsync(long memberId, IReadOnlyCollection<Punch> punches) =>
        MemberDays.PeriodNamesAsync(_memberRepository, _scheduleRepository, _punchRepository, _scheduleResolver, memberId, punches);

    private async Task<IReadOnlyDictionary<long, string>> UserNamesAsync(IEnumerable<long> userIds)
    {
        var ids = userIds.Distinct().ToList();
        if (ids.Count == 0)
            return new Dictionary<long, string>();
        return (await _userRepository.GetByIdsAsync(ids)).ToDictionary(u => u.UserId, u => u.Name);
    }

    private async Task<Company> RequireCompanyAsync(long companyId) =>
        await _companyRepository.GetByIdAsync(companyId)
        ?? throw new NotFoundException(AccessContext.COMPANY_NOT_FOUND_MESSAGE);
}
