using Pontua.Domain.Enums;
using Pontua.Domain.Exceptions;
using Pontua.Domain.Interfaces;
using Pontua.Domain.Models;
using Pontua.DTO.Common;
using Pontua.DTO.Summary;
using Pontua.Infra.Interfaces.Repository;

namespace Pontua.Domain.Services;

/// <summary>
/// Resumo de horas (R-09): dias pelo <see cref="DayEvaluator"/>, semanas de segunda a domingo pelo
/// <see cref="WorkHoursCalculator"/> e totais do período (previsto total = soma do previsto das semanas). O previsto
/// é 0 nos dias posteriores a hoje e nos dias em que o membro não estava ativo.
/// </summary>
public class SummaryService : ISummaryService
{
    private readonly IPunchRepository<Punch, PunchStatusChange> _punchRepository;
    private readonly IMemberRepository<Member, MemberPosition, ManagerPosition> _memberRepository;
    private readonly IScheduleRepository<Schedule> _scheduleRepository;
    private readonly ICompanyRepository<Company> _companyRepository;
    private readonly ICompanyAccessPolicy _accessPolicy;
    private readonly IScheduleResolver _scheduleResolver;
    private readonly ICompanyClock _companyClock;

    public SummaryService(
        IPunchRepository<Punch, PunchStatusChange> punchRepository,
        IMemberRepository<Member, MemberPosition, ManagerPosition> memberRepository,
        IScheduleRepository<Schedule> scheduleRepository,
        ICompanyRepository<Company> companyRepository,
        ICompanyAccessPolicy accessPolicy,
        IScheduleResolver scheduleResolver,
        ICompanyClock companyClock)
    {
        _punchRepository = punchRepository;
        _memberRepository = memberRepository;
        _scheduleRepository = scheduleRepository;
        _companyRepository = companyRepository;
        _accessPolicy = accessPolicy;
        _scheduleResolver = scheduleResolver;
        _companyClock = companyClock;
    }

    public async Task<HoursSummary> GetMySummaryAsync(long companyId, long userId, DateRangeQuery? query)
    {
        var access = await _accessPolicy.RequireMemberAsync(companyId, userId);
        var company = await RequireCompanyAsync(companyId);
        return await BuildAsync(company, access.MemberId!.Value, query);
    }

    public async Task<HoursSummary> GetSummaryAsync(long companyId, long userId, long memberId, DateRangeQuery? query)
    {
        var access = await _accessPolicy.RequireMemberAsync(companyId, userId);
        var company = await RequireCompanyAsync(companyId);
        await _accessPolicy.RequireSelfOrSuperviseAsync(access, memberId, _companyClock.TodayLocal(company.TimeZone));
        return await BuildAsync(company, memberId, query);
    }

    private async Task<HoursSummary> BuildAsync(Company company, long memberId, DateRangeQuery? query)
    {
        var today = _companyClock.TodayLocal(company.TimeZone);
        var range = DateRangeResolver.Resolve(query, today);
        var member = await _memberRepository.GetByIdAsync(company.CompanyId, memberId)
            ?? throw new NotFoundException(MemberService.MEMBER_NOT_FOUND_MESSAGE);

        // Previsto só nos dias até hoje em que o membro estava ativo (R-09, atualização).
        var (days, punches) = await MemberDays.EvaluateAsync(
            _memberRepository, _scheduleRepository, _punchRepository, _scheduleResolver, memberId, range,
            MemberActivity.ExpectedCounts(member, today, company.TimeZone, _companyClock));
        return Summarize(range, days, punches);
    }

    /// <summary>Monta o resumo a partir dos dias avaliados (puro).</summary>
    public static HoursSummary Summarize(DateRange range, IReadOnlyList<DayEvaluation> days, IEnumerable<Punch> punches)
    {
        var weeks = WorkHoursCalculator.SummarizeWeeks(days, range.Start, range.End);
        var worked = days.Sum(d => d.WorkedMinutes);
        var expected = weeks.Sum(w => w.ExpectedMinutes);

        return new HoursSummary
        {
            Start = range.Start,
            End = range.End,
            Totals = new SummaryTotalsInfo
            {
                WorkedMinutes = worked,
                ExpectedMinutes = expected,
                BalanceMinutes = worked - expected,
                PendingPunches = punches.Count(p => p.Status == PunchStatus.Pending && range.Contains(p.WorkDate))
            },
            Weeks = weeks.Select(w => new WeekSummaryInfo
            {
                WeekStart = w.WeekStart,
                From = w.From,
                To = w.To,
                Partial = w.Partial,
                WorkedMinutes = w.WorkedMinutes,
                ExpectedMinutes = w.ExpectedMinutes,
                BalanceMinutes = w.BalanceMinutes
            }).ToList(),
            Days = days.Select(d => new DaySummaryInfo
            {
                Date = d.Date,
                IsWorkDay = d.IsWorkDay,
                WorkedMinutes = d.WorkedMinutes,
                ExpectedMinutes = d.ExpectedMinutes,
                BalanceMinutes = d.BalanceMinutes,
                Incomplete = d.Incomplete
            }).ToList()
        };
    }

    private async Task<Company> RequireCompanyAsync(long companyId) =>
        await _companyRepository.GetByIdAsync(companyId)
        ?? throw new NotFoundException(AccessContext.COMPANY_NOT_FOUND_MESSAGE);
}
