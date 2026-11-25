using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Pontua.Domain.Enums;
using Pontua.Domain.Exceptions;
using Pontua.Domain.Interfaces;
using Pontua.Domain.Models;
using Pontua.Domain.Services;
using Pontua.Domain.Validators;
using Pontua.DTO.Invitations;
using Pontua.DTO.Settings;
using Pontua.Infra.Interfaces.Repository;

namespace Pontua.Tests.Domain;

public class InvitationServiceTests
{
    private static readonly DateTime NOW = new(2026, 11, 25, 15, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly TODAY = new(2026, 11, 25);

    private const long COMPANY = 3;
    private const long OWNER_USER = 7;
    private const long EMPLOYEE_USER = 9;
    private const long NEW_USER = 20;
    private const long FORMER_USER = 21;
    private const long ATENDENTE = 40;
    private const string BASE_URL = "https://app.pontua.com.br/";

    private readonly Mock<IInvitationRepository<Invitation>> _invitations = new();
    private readonly Mock<ICompanyRepository<Company>> _companies = new();
    private readonly Mock<IPositionRepository<Position>> _positions = new();
    private readonly Mock<IMemberRepository<Member, MemberPosition, ManagerPosition>> _members = new();
    private readonly Mock<IUserRepository<User>> _users = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<ICompanyAccessPolicy> _access = new();
    private readonly Mock<IClock> _clock = new();

    private readonly List<Invitation> _invitationStore = new();
    private readonly List<Member> _memberStore = new();
    private readonly List<MemberPosition> _memberPositionStore = new();

    private readonly InvitationService _sut;

    public InvitationServiceTests()
    {
        _clock.Setup(c => c.UtcNow).Returns(NOW);
        _companies.Setup(r => r.GetByIdAsync(COMPANY))
            .ReturnsAsync(new Company { CompanyId = COMPANY, Name = "Padaria Sol", OwnerUserId = OWNER_USER });
        _positions.Setup(r => r.GetByIdAsync(COMPANY, ATENDENTE))
            .ReturnsAsync(new Position { PositionId = ATENDENTE, CompanyId = COMPANY, Name = "Atendente" });
        _positions.Setup(r => r.ListByCompanyAsync(COMPANY))
            .ReturnsAsync(new List<Position> { new() { PositionId = ATENDENTE, CompanyId = COMPANY, Name = "Atendente" } });
        _users.Setup(r => r.GetByIdAsync(OWNER_USER)).ReturnsAsync(new User { UserId = OWNER_USER, Name = "Ana Silva" });
        _users.Setup(r => r.GetByIdsAsync(It.IsAny<IEnumerable<long>>()))
            .ReturnsAsync(new List<User> { new() { UserId = OWNER_USER, Name = "Ana Silva" } });

        var ownerContext = new AccessContext
        {
            CompanyId = COMPANY, UserId = OWNER_USER, MemberId = 12, IsActive = true, IsOwner = true
        };
        _access.Setup(a => a.RequireOwnerAsync(COMPANY, OWNER_USER)).ReturnsAsync(ownerContext);
        _access.Setup(a => a.RequireOwnerAsync(COMPANY, EMPLOYEE_USER))
            .ThrowsAsync(new ForbiddenException("Somente o responsável pela empresa pode realizar esta operação."));

        _invitations.Setup(r => r.InsertAsync(It.IsAny<Invitation>())).ReturnsAsync((Invitation i) =>
        {
            i.InvitationId = _invitationStore.Count + 1;
            _invitationStore.Add(i);
            return i;
        });
        _invitations.Setup(r => r.UpdateAsync(It.IsAny<Invitation>())).ReturnsAsync((Invitation i) => i);
        // Simula o UPDATE atômico (accepted_count = accepted_count + 1) no banco.
        _invitations.Setup(r => r.IncrementAcceptedCountAsync(It.IsAny<long>()))
            .Returns((long id) =>
            {
                _invitationStore.Single(i => i.InvitationId == id).AcceptedCount++;
                return Task.CompletedTask;
            });
        _invitations.Setup(r => r.GetByTokenAsync(It.IsAny<string>()))
            .ReturnsAsync((string token) => _invitationStore.FirstOrDefault(i => i.Token == token));
        _invitations.Setup(r => r.GetByIdAsync(COMPANY, It.IsAny<long>()))
            .ReturnsAsync((long _, long id) => _invitationStore.FirstOrDefault(i => i.InvitationId == id));
        _invitations.Setup(r => r.ListByCompanyAsync(COMPANY, It.IsAny<DateTime>(), It.IsAny<DateTime>()))
            .ReturnsAsync((long _, DateTime from, DateTime to) =>
                _invitationStore.Where(i => i.CreatedAt >= from && i.CreatedAt < to).ToList());

        _memberStore.Add(new Member { MemberId = 14, CompanyId = COMPANY, UserId = EMPLOYEE_USER, Status = MemberStatus.Active });
        _memberStore.Add(new Member
        {
            MemberId = 15, CompanyId = COMPANY, UserId = FORMER_USER, Status = MemberStatus.Inactive,
            JoinedAt = NOW.AddDays(-200), ActiveSince = TODAY.AddDays(-200), DeactivatedAt = NOW.AddDays(-30)
        });
        _members.Setup(r => r.GetByCompanyAndUserAsync(COMPANY, It.IsAny<long>()))
            .ReturnsAsync((long _, long userId) => _memberStore.FirstOrDefault(m => m.UserId == userId));
        _members.Setup(r => r.InsertAsync(It.IsAny<Member>())).ReturnsAsync((Member m) =>
        {
            m.MemberId = 100;
            _memberStore.Add(m);
            return m;
        });
        _members.Setup(r => r.UpdateAsync(It.IsAny<Member>())).ReturnsAsync((Member m) => m);
        _members.Setup(r => r.UpsertPositionAsync(It.IsAny<MemberPosition>())).ReturnsAsync((MemberPosition mp) =>
        {
            _memberPositionStore.Add(mp);
            return mp;
        });

        _sut = new InvitationService(
            _invitations.Object,
            _companies.Object,
            _positions.Object,
            _members.Object,
            _users.Object,
            _unitOfWork.Object,
            _access.Object,
            new CompanyClock(_clock.Object),
            _clock.Object,
            new InvitationInsertInfoValidator(),
            Options.Create(new AppSettings { FrontendBaseUrl = BASE_URL }),
            NullLogger<InvitationService>.Instance);
    }

    private Invitation AddInvitation(DateTime? expiresAt = null, DateTime? revokedAt = null)
    {
        var invitation = new Invitation
        {
            InvitationId = _invitationStore.Count + 1,
            CompanyId = COMPANY,
            PositionId = ATENDENTE,
            Token = InvitationService.GenerateToken(),
            ExpiresAt = expiresAt ?? NOW.AddDays(7),
            RevokedAt = revokedAt,
            CreatedByUserId = OWNER_USER,
            CreatedAt = NOW.AddDays(-1)
        };
        _invitationStore.Add(invitation);
        return invitation;
    }

    [Fact]
    public async Task CreateAsync_ShouldBuildUrlWithFrontendBaseAndDefaultSevenDays_WhenExpirationIsOmitted()
    {
        var info = await _sut.CreateAsync(COMPANY, OWNER_USER, new InvitationInsertInfo { PositionId = ATENDENTE });

        info.Url.Should().Be($"https://app.pontua.com.br/convite/{info.Token}");
        info.Token.Should().HaveLength(43).And.MatchRegex("^[A-Za-z0-9_-]+$");
        info.ExpiresAt.Should().Be(NOW.AddDays(7));
        info.Status.Should().Be(InvitationStatuses.ACTIVE);
        info.Position.Name.Should().Be("Atendente");
        info.CreatedBy.Should().Be("Ana Silva");
        info.AcceptedCount.Should().Be(0);
    }

    [Fact]
    public void GenerateToken_ShouldReturnDistinctBase64UrlTokens()
    {
        var tokens = Enumerable.Range(0, 50).Select(_ => InvitationService.GenerateToken()).ToList();

        tokens.Should().OnlyHaveUniqueItems();
        tokens.Should().AllSatisfy(t => t.Should().HaveLength(43).And.NotContainAny("+", "/", "="));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(31)]
    public async Task CreateAsync_ShouldReject_WhenExpiresInDaysIsOutOfRange(int days)
    {
        var act = () => _sut.CreateAsync(COMPANY, OWNER_USER, new InvitationInsertInfo { PositionId = ATENDENTE, ExpiresInDays = days });

        (await act.Should().ThrowAsync<ValidationException>()).Which.Errors.Should().Contain(e => e.Field == "expiresInDays");
    }

    [Fact]
    public async Task CreateAsync_ShouldReject_WhenPositionIdIsMissing()
    {
        var act = () => _sut.CreateAsync(COMPANY, OWNER_USER, new InvitationInsertInfo());

        (await act.Should().ThrowAsync<ValidationException>()).Which.Errors.Should().Contain(e => e.Field == "positionId");
    }

    [Fact]
    public async Task CreateAsync_ShouldThrowNotFound_WhenPositionIsFromAnotherCompany()
    {
        var act = () => _sut.CreateAsync(COMPANY, OWNER_USER, new InvitationInsertInfo { PositionId = 999 });

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task CreateAsync_ShouldThrowForbidden_WhenCallerIsNotOwner()
    {
        var act = () => _sut.CreateAsync(COMPANY, EMPLOYEE_USER, new InvitationInsertInfo { PositionId = ATENDENTE });

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task AcceptAsync_ShouldCreateActiveMemberWithInvitationPosition_WhenUserIsNew()
    {
        var invitation = AddInvitation();

        var summary = await _sut.AcceptAsync(invitation.Token, NEW_USER);

        summary.CompanyId.Should().Be(COMPANY);
        summary.Name.Should().Be("Padaria Sol");
        summary.MemberId.Should().Be(100);
        summary.PositionName.Should().Be("Atendente");
        summary.IsOwner.Should().BeFalse();

        var member = _memberStore.Single(m => m.UserId == NEW_USER);
        member.Status.Should().Be(MemberStatus.Active);
        member.ActiveSince.Should().Be(TODAY);
        member.JoinedAt.Should().Be(NOW);
        _memberPositionStore.Should().ContainSingle(mp =>
            mp.MemberId == 100 && mp.PositionId == ATENDENTE && mp.EffectiveFrom == TODAY);
        invitation.AcceptedCount.Should().Be(1);
        _invitations.Verify(r => r.IncrementAcceptedCountAsync(invitation.InvitationId), Times.Once);
        _invitations.Verify(r => r.UpdateAsync(It.IsAny<Invitation>()), Times.Never,
            "o contador é incrementado no banco, sem leitura-incremento-gravação");
        _unitOfWork.Verify(u => u.CommitAsync(), Times.Once);
    }

    [Fact]
    public async Task AcceptAsync_ShouldThrowConflictAndRollback_WhenConcurrentAcceptViolatesMemberUniqueIndex()
    {
        var invitation = AddInvitation();
        _members.Setup(r => r.InsertAsync(It.IsAny<Member>()))
            .ThrowsAsync(new UniqueConstraintViolationException("ix_members_company_user"));

        var act = () => _sut.AcceptAsync(invitation.Token, NEW_USER);

        await act.Should().ThrowAsync<ConflictException>().WithMessage(InvitationService.CONCURRENT_MEMBER_MESSAGE);
        _unitOfWork.Verify(u => u.RollbackAsync(), Times.Once);
        _unitOfWork.Verify(u => u.CommitAsync(), Times.Never);
        _invitations.Verify(r => r.IncrementAcceptedCountAsync(It.IsAny<long>()), Times.Never);
        invitation.AcceptedCount.Should().Be(0);
    }

    [Fact]
    public async Task AcceptAsync_ShouldThrowConflict_WhenConcurrentReactivationViolatesMemberPositionUniqueIndex()
    {
        var invitation = AddInvitation();
        _members.Setup(r => r.UpsertPositionAsync(It.IsAny<MemberPosition>()))
            .ThrowsAsync(new UniqueConstraintViolationException("ix_member_positions_member_effective_from"));

        var act = () => _sut.AcceptAsync(invitation.Token, FORMER_USER);

        await act.Should().ThrowAsync<ConflictException>().WithMessage(InvitationService.CONCURRENT_MEMBER_MESSAGE);
        _unitOfWork.Verify(u => u.RollbackAsync(), Times.Once);
    }

    [Fact]
    public async Task AcceptAsync_ShouldCountEveryAcceptance_WhenSeveralUsersAcceptTheSameInvitation()
    {
        var invitation = AddInvitation();
        var nextId = 200L;
        _members.Setup(r => r.InsertAsync(It.IsAny<Member>())).ReturnsAsync((Member m) =>
        {
            m.MemberId = nextId++;
            _memberStore.Add(m);
            return m;
        });

        await Task.WhenAll(
            _sut.AcceptAsync(invitation.Token, NEW_USER),
            _sut.AcceptAsync(invitation.Token, NEW_USER + 100),
            _sut.AcceptAsync(invitation.Token, FORMER_USER));

        invitation.AcceptedCount.Should().Be(3);
        _invitations.Verify(r => r.IncrementAcceptedCountAsync(invitation.InvitationId), Times.Exactly(3));
    }

    [Fact]
    public async Task AcceptAsync_ShouldThrowConflictWithoutChanges_WhenUserIsAlreadyActiveMember()
    {
        var invitation = AddInvitation();

        var act = () => _sut.AcceptAsync(invitation.Token, EMPLOYEE_USER);

        await act.Should().ThrowAsync<ConflictException>();
        invitation.AcceptedCount.Should().Be(0);
        _members.Verify(r => r.InsertAsync(It.IsAny<Member>()), Times.Never);
        _members.Verify(r => r.UpsertPositionAsync(It.IsAny<MemberPosition>()), Times.Never);
        _unitOfWork.Verify(u => u.BeginTransactionAsync(), Times.Never);
    }

    [Fact]
    public async Task AcceptAsync_ShouldReactivateWithNewPosition_WhenMemberIsInactive()
    {
        var invitation = AddInvitation();

        var summary = await _sut.AcceptAsync(invitation.Token, FORMER_USER);

        summary.MemberId.Should().Be(15);
        var member = _memberStore.Single(m => m.MemberId == 15);
        member.Status.Should().Be(MemberStatus.Active);
        member.DeactivatedAt.Should().BeNull();
        member.ActiveSince.Should().Be(TODAY);
        member.JoinedAt.Should().Be(NOW.AddDays(-200), "o primeiro ingresso é preservado");
        _members.Verify(r => r.InsertAsync(It.IsAny<Member>()), Times.Never);
        _memberPositionStore.Should().ContainSingle(mp => mp.MemberId == 15 && mp.PositionId == ATENDENTE && mp.EffectiveFrom == TODAY);
        invitation.AcceptedCount.Should().Be(1);
    }

    [Fact]
    public async Task AcceptAsync_ShouldThrowBusinessRule_WhenInvitationIsExpired()
    {
        var invitation = AddInvitation(expiresAt: NOW.AddMinutes(-1));

        var act = () => _sut.AcceptAsync(invitation.Token, NEW_USER);

        await act.Should().ThrowAsync<BusinessRuleException>().WithMessage(InvitationService.EXPIRED_MESSAGE);
        _members.Verify(r => r.InsertAsync(It.IsAny<Member>()), Times.Never);
    }

    [Fact]
    public async Task AcceptAsync_ShouldThrowBusinessRule_WhenInvitationIsRevoked()
    {
        var invitation = AddInvitation(revokedAt: NOW.AddHours(-1));

        var act = () => _sut.AcceptAsync(invitation.Token, NEW_USER);

        await act.Should().ThrowAsync<BusinessRuleException>().WithMessage(InvitationService.REVOKED_MESSAGE);
        _members.Verify(r => r.InsertAsync(It.IsAny<Member>()), Times.Never);
    }

    [Fact]
    public async Task AcceptAsync_ShouldThrowNotFound_WhenTokenDoesNotExist()
    {
        var act = () => _sut.AcceptAsync("inexistente", NEW_USER);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task AcceptAsync_ShouldRollback_WhenPersistenceFails()
    {
        var invitation = AddInvitation();
        _members.Setup(r => r.UpsertPositionAsync(It.IsAny<MemberPosition>())).ThrowsAsync(new InvalidOperationException("falha"));

        var act = () => _sut.AcceptAsync(invitation.Token, NEW_USER);

        await act.Should().ThrowAsync<InvalidOperationException>();
        _unitOfWork.Verify(u => u.RollbackAsync(), Times.Once);
        _unitOfWork.Verify(u => u.CommitAsync(), Times.Never);
    }

    [Fact]
    public async Task GetPublicAsync_ShouldReturnCompanyPositionAndStatus()
    {
        var invitation = AddInvitation(revokedAt: NOW.AddHours(-1));

        var info = await _sut.GetPublicAsync(invitation.Token);

        info.CompanyName.Should().Be("Padaria Sol");
        info.PositionName.Should().Be("Atendente");
        info.Status.Should().Be(InvitationStatuses.REVOKED);
        info.ExpiresAt.Should().Be(invitation.ExpiresAt);
    }

    [Fact]
    public async Task RevokeAsync_ShouldSetRevokedAt_WhenInvitationIsActive()
    {
        var invitation = AddInvitation();

        await _sut.RevokeAsync(COMPANY, OWNER_USER, invitation.InvitationId);

        invitation.RevokedAt.Should().Be(NOW);
        _invitations.Verify(r => r.UpdateAsync(invitation), Times.Once);
    }

    [Fact]
    public async Task ListAsync_ShouldFilterByDerivedStatus()
    {
        AddInvitation();
        AddInvitation(expiresAt: NOW.AddDays(-1));
        AddInvitation(revokedAt: NOW.AddHours(-2));

        var all = await _sut.ListAsync(COMPANY, OWNER_USER, null, null);
        var expired = await _sut.ListAsync(COMPANY, OWNER_USER, null, "expired");

        all.Select(i => i.Status).Should().BeEquivalentTo(new[] { "active", "expired", "revoked" });
        expired.Should().ContainSingle().Which.Status.Should().Be("expired");
        all.Should().AllSatisfy(i => i.Url.Should().StartWith("https://app.pontua.com.br/convite/"));
    }

    [Fact]
    public async Task ListAsync_ShouldReject_WhenStatusFilterIsInvalid()
    {
        var act = () => _sut.ListAsync(COMPANY, OWNER_USER, null, "pendente");

        await act.Should().ThrowAsync<ValidationException>();
    }
}
