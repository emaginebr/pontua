using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Pontua.Domain.Enums;
using Pontua.Domain.Exceptions;
using Pontua.Domain.Interfaces;
using Pontua.Domain.Models;
using Pontua.Domain.Services;
using Pontua.Domain.Validators;
using Pontua.DTO.Companies;
using Pontua.Infra.Interfaces.Repository;

namespace Pontua.Tests.Domain;

public class CompanyServiceTests
{
    // 15:00 UTC = 12:00 em São Paulo; 01:00 UTC do dia seguinte ainda é 25/11 em São Paulo.
    private static readonly DateTime NOW = new(2026, 11, 25, 15, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly TODAY = new(2026, 11, 25);

    private const long ANA = 7;
    private const long JOAO = 8;

    private readonly Mock<ICompanyRepository<Company>> _companies = new();
    private readonly Mock<IMemberRepository<Member, MemberPosition, ManagerPosition>> _members = new();
    private readonly Mock<IPositionRepository<Position>> _positions = new();
    private readonly Mock<IScheduleRepository<Schedule>> _schedules = new();
    private readonly Mock<IUserRepository<User>> _users = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IClock> _clock = new();

    private readonly List<Company> _companyStore = new();
    private readonly List<Member> _memberStore = new();
    private readonly List<Position> _positionStore = new();
    private readonly List<Schedule> _scheduleStore = new();
    private readonly List<MemberPosition> _memberPositionStore = new();

    private readonly CompanyService _sut;

    public CompanyServiceTests()
    {
        _clock.Setup(c => c.UtcNow).Returns(NOW);
        var companyClock = new CompanyClock(_clock.Object);

        var users = new Dictionary<long, User>
        {
            [ANA] = new() { UserId = ANA, Name = "Ana Silva", Email = "ana@ex.com" },
            [JOAO] = new() { UserId = JOAO, Name = "João Lima", Email = "joao@ex.com" }
        };
        _users.Setup(r => r.GetByIdAsync(It.IsAny<long>())).ReturnsAsync((long id) => users.GetValueOrDefault(id));

        _companies.Setup(r => r.InsertAsync(It.IsAny<Company>())).ReturnsAsync((Company c) =>
        {
            c.CompanyId = 100 + _companyStore.Count;
            _companyStore.Add(c);
            return c;
        });
        _companies.Setup(r => r.GetByIdAsync(It.IsAny<long>()))
            .ReturnsAsync((long id) => _companyStore.FirstOrDefault(c => c.CompanyId == id));
        _companies.Setup(r => r.GetByIdsAsync(It.IsAny<IEnumerable<long>>()))
            .ReturnsAsync((IEnumerable<long> ids) => _companyStore.Where(c => ids.Contains(c.CompanyId)).ToList());
        _companies.Setup(r => r.UpdateAsync(It.IsAny<Company>())).ReturnsAsync((Company c) => c);

        _members.Setup(r => r.InsertAsync(It.IsAny<Member>())).ReturnsAsync((Member m) =>
        {
            m.MemberId = 200 + _memberStore.Count;
            m.User = users[m.UserId];
            _memberStore.Add(m);
            return m;
        });
        _members.Setup(r => r.GetByCompanyAndUserAsync(It.IsAny<long>(), It.IsAny<long>()))
            .ReturnsAsync((long companyId, long userId) =>
                _memberStore.FirstOrDefault(m => m.CompanyId == companyId && m.UserId == userId));
        _members.Setup(r => r.ListByUserAsync(It.IsAny<long>()))
            .ReturnsAsync((long userId) => _memberStore.Where(m => m.UserId == userId).ToList());
        _members.Setup(r => r.ListManagedPositionIdsAsync(It.IsAny<long>())).ReturnsAsync(new List<long>());
        _members.Setup(r => r.UpsertPositionAsync(It.IsAny<MemberPosition>())).ReturnsAsync((MemberPosition mp) =>
        {
            mp.MemberPositionId = 400 + _memberPositionStore.Count;
            mp.Position = _positionStore.First(p => p.PositionId == mp.PositionId);
            _memberPositionStore.Add(mp);
            return mp;
        });
        _members.Setup(r => r.ListPositionHistoryAsync(It.IsAny<IEnumerable<long>>()))
            .ReturnsAsync((IEnumerable<long> ids) => _memberPositionStore.Where(mp => ids.Contains(mp.MemberId)).ToList());

        _positions.Setup(r => r.InsertAsync(It.IsAny<Position>())).ReturnsAsync((Position p) =>
        {
            p.PositionId = 300 + _positionStore.Count;
            _positionStore.Add(p);
            return p;
        });
        _schedules.Setup(r => r.InsertAsync(It.IsAny<Schedule>())).ReturnsAsync((Schedule s) =>
        {
            s.ScheduleId = 500 + _scheduleStore.Count;
            _scheduleStore.Add(s);
            return s;
        });

        // Política real sobre os mesmos repositórios: o isolamento entre empresas é testado de ponta a ponta.
        var accessPolicy = new CompanyAccessPolicy(_companies.Object, _members.Object);

        _sut = new CompanyService(
            _companies.Object,
            _members.Object,
            _positions.Object,
            _schedules.Object,
            _users.Object,
            _unitOfWork.Object,
            accessPolicy,
            companyClock,
            _clock.Object,
            new CompanyInsertInfoValidator(),
            new CompanyUpdateInfoValidator(),
            new TransferOwnershipInfoValidator(),
            NullLogger<CompanyService>.Instance);
    }

    [Fact]
    public async Task CreateAsync_ShouldMakeCreatorOwnerAndActiveMember_WhenDataIsValid()
    {
        var info = await _sut.CreateAsync(ANA, new CompanyInsertInfo { Name = " Padaria Sol ", Document = "12345678000190" });

        var company = _companyStore.Single();
        company.Name.Should().Be("Padaria Sol");
        company.OwnerUserId.Should().Be(ANA);
        company.TimeZone.Should().Be(Company.DEFAULT_TIME_ZONE);
        company.ManualRetroDays.Should().Be(Company.DEFAULT_MANUAL_RETRO_DAYS);

        var member = _memberStore.Single();
        member.CompanyId.Should().Be(company.CompanyId);
        member.UserId.Should().Be(ANA);
        member.Status.Should().Be(MemberStatus.Active);
        member.ActiveSince.Should().Be(TODAY);

        info.Owner.UserId.Should().Be(ANA);
        info.Owner.MemberId.Should().Be(member.MemberId);
        info.Owner.Name.Should().Be("Ana Silva");
        info.MyAccess.IsOwner.Should().BeTrue();
        info.MyAccess.MemberId.Should().Be(member.MemberId);

        _unitOfWork.Verify(u => u.BeginTransactionAsync(), Times.Once);
        _unitOfWork.Verify(u => u.CommitAsync(), Times.Once);
        _unitOfWork.Verify(u => u.RollbackAsync(), Times.Never);
    }

    [Fact]
    public async Task CreateAsync_ShouldCreateResponsavelPositionWithDefaultWeeklySchedule_WhenCompanyIsCreated()
    {
        await _sut.CreateAsync(ANA, new CompanyInsertInfo { Name = "Padaria Sol" });

        var position = _positionStore.Single();
        position.Name.Should().Be(CompanyService.OWNER_POSITION_NAME);

        var schedule = _scheduleStore.Single();
        schedule.PositionId.Should().Be(position.PositionId);
        schedule.MemberId.Should().BeNull();
        schedule.Mode.Should().Be(ScheduleMode.Weekly);
        schedule.EffectiveFrom.Should().Be(TODAY);
        schedule.WeeklyMinutes.Should().Be(2400);
        schedule.Days.Select(d => d.DayOfWeek).Should().Equal(
            DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday);
        schedule.Days.Should().OnlyContain(d => d.DailyMinutes == 480);
        schedule.Periods.Select(p => (p.Sequence, p.Name, p.ExpectedTime, p.DayOfWeek)).Should().Equal(
            (1, "Entrada", new TimeOnly(8, 0), (DayOfWeek?)null),
            (2, "Pausa", new TimeOnly(12, 0), (DayOfWeek?)null),
            (3, "Retorno", new TimeOnly(13, 0), (DayOfWeek?)null),
            (4, "Saída", new TimeOnly(17, 0), (DayOfWeek?)null));

        var memberPosition = _memberPositionStore.Single();
        memberPosition.MemberId.Should().Be(_memberStore.Single().MemberId);
        memberPosition.PositionId.Should().Be(position.PositionId);
        memberPosition.EffectiveFrom.Should().Be(TODAY);
    }

    [Fact]
    public async Task CreateAsync_ShouldUseCompanyTimeZoneForActiveSince_WhenUtcDateDiffersFromLocalDate()
    {
        // 01:30 UTC de 26/11 = 22:30 de 25/11 em São Paulo.
        _clock.Setup(c => c.UtcNow).Returns(new DateTime(2026, 11, 26, 1, 30, 0, DateTimeKind.Utc));

        await _sut.CreateAsync(ANA, new CompanyInsertInfo { Name = "Padaria Sol", TimeZone = "America/Sao_Paulo" });

        _memberStore.Single().ActiveSince.Should().Be(TODAY);
        _scheduleStore.Single().EffectiveFrom.Should().Be(TODAY);
    }

    [Theory]
    [InlineData("", "name", null, null)]
    [InlineData("Padaria", "timeZone", "Lua/Crescente", null)]
    [InlineData("Padaria", "document", null, "12.345.678/0001-90")]
    public async Task CreateAsync_ShouldThrowValidation_WhenInputIsInvalid(string name, string field, string? timeZone, string? document)
    {
        var act = () => _sut.CreateAsync(ANA, new CompanyInsertInfo { Name = name, TimeZone = timeZone, Document = document });

        var ex = await act.Should().ThrowAsync<ValidationException>();
        ex.Which.Errors.Should().Contain(e => e.Field == field);
        _unitOfWork.Verify(u => u.BeginTransactionAsync(), Times.Never);
    }

    [Fact]
    public async Task CreateAsync_ShouldRollback_WhenAnyInsertFails()
    {
        _positions.Setup(r => r.InsertAsync(It.IsAny<Position>())).ThrowsAsync(new InvalidOperationException("falha"));

        var act = () => _sut.CreateAsync(ANA, new CompanyInsertInfo { Name = "Padaria Sol" });

        await act.Should().ThrowAsync<InvalidOperationException>();
        _unitOfWork.Verify(u => u.RollbackAsync(), Times.Once);
        _unitOfWork.Verify(u => u.CommitAsync(), Times.Never);
    }

    [Fact]
    public async Task ListAsync_ShouldReturnBothCompaniesAsOwnerWithResponsavelPosition_WhenUserCreatedTwoCompanies()
    {
        await _sut.CreateAsync(ANA, new CompanyInsertInfo { Name = "Padaria Sol" });
        await _sut.CreateAsync(ANA, new CompanyInsertInfo { Name = "Café Lua" });

        var list = await _sut.ListAsync(ANA);

        list.Select(c => c.Name).Should().Equal("Café Lua", "Padaria Sol");
        list.Should().OnlyContain(c => c.IsOwner && !c.IsManager && c.PositionName == CompanyService.OWNER_POSITION_NAME);
        list.Select(c => c.CompanyId).Should().OnlyHaveUniqueItems();
        list.Select(c => c.MemberId).Should().OnlyHaveUniqueItems();
    }

    [Fact]
    public async Task ListAsync_ShouldIgnoreInactiveMemberships_WhenUserWasDeactivated()
    {
        var created = await _sut.CreateAsync(ANA, new CompanyInsertInfo { Name = "Padaria Sol" });
        _memberStore.Add(new Member
        {
            MemberId = 999, CompanyId = created.CompanyId, UserId = JOAO, Status = MemberStatus.Inactive, ActiveSince = TODAY
        });

        var list = await _sut.ListAsync(JOAO);

        list.Should().BeEmpty();
    }

    [Fact]
    public async Task GetAsync_ShouldThrowNotFound_WhenUserHasNoLinkWithCompany()
    {
        var created = await _sut.CreateAsync(ANA, new CompanyInsertInfo { Name = "Padaria Sol" });

        var act = () => _sut.GetAsync(created.CompanyId, JOAO);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task GetAsync_ShouldReturnOnlyRequestedCompany_WhenOwnerHasTwoCompanies()
    {
        var first = await _sut.CreateAsync(ANA, new CompanyInsertInfo { Name = "Padaria Sol" });
        var second = await _sut.CreateAsync(ANA, new CompanyInsertInfo { Name = "Café Lua" });

        var info = await _sut.GetAsync(second.CompanyId, ANA);

        info.CompanyId.Should().Be(second.CompanyId);
        info.Name.Should().Be("Café Lua");
        info.MyAccess.MemberId.Should().NotBe(first.MyAccess.MemberId);
    }

    [Fact]
    public async Task UpdateAsync_ShouldThrowForbidden_WhenUserIsMemberButNotOwner()
    {
        var created = await _sut.CreateAsync(ANA, new CompanyInsertInfo { Name = "Padaria Sol" });
        _memberStore.Add(new Member
        {
            MemberId = 999, CompanyId = created.CompanyId, UserId = JOAO, Status = MemberStatus.Active, ActiveSince = TODAY
        });

        var act = () => _sut.UpdateAsync(created.CompanyId, JOAO,
            new CompanyUpdateInfo { Name = "Outra", TimeZone = "America/Sao_Paulo", ManualRetroDays = 30 });

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task UpdateAsync_ShouldPersistChanges_WhenUserIsOwner()
    {
        var created = await _sut.CreateAsync(ANA, new CompanyInsertInfo { Name = "Padaria Sol" });

        var info = await _sut.UpdateAsync(created.CompanyId, ANA, new CompanyUpdateInfo
        {
            Name = "Padaria Sol Nascente",
            Document = "",
            TimeZone = "America/Manaus",
            ManualRetroDays = 10
        });

        info.Name.Should().Be("Padaria Sol Nascente");
        info.Document.Should().BeNull();
        info.TimeZone.Should().Be("America/Manaus");
        info.ManualRetroDays.Should().Be(10);
        _companies.Verify(r => r.UpdateAsync(It.IsAny<Company>()), Times.Once);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(366)]
    public async Task UpdateAsync_ShouldThrowValidation_WhenManualRetroDaysIsOutOfRange(int days)
    {
        var created = await _sut.CreateAsync(ANA, new CompanyInsertInfo { Name = "Padaria Sol" });

        var act = () => _sut.UpdateAsync(created.CompanyId, ANA,
            new CompanyUpdateInfo { Name = "Padaria Sol", TimeZone = "America/Sao_Paulo", ManualRetroDays = days });

        var ex = await act.Should().ThrowAsync<ValidationException>();
        ex.Which.Errors.Should().Contain(e => e.Field == "manualRetroDays");
    }
}
