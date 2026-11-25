using FluentAssertions;
using Moq;
using Pontua.Domain.Enums;
using Pontua.Domain.Exceptions;
using Pontua.Domain.Models;
using Pontua.Domain.Services;
using Pontua.Infra.Interfaces.Repository;

namespace Pontua.Tests.Domain;

public class CompanyAccessPolicyTests
{
    private const long COMPANY = 3;
    private const long OTHER_COMPANY = 4;

    private const long OWNER_USER = 7;
    private const long MANAGER_USER = 8;
    private const long EMPLOYEE_USER = 9;
    private const long INACTIVE_USER = 10;
    private const long OUTSIDER_USER = 11;

    private const long OWNER_MEMBER = 12;
    private const long MANAGER_MEMBER = 13;
    private const long EMPLOYEE_MEMBER = 14;
    private const long INACTIVE_MEMBER = 15;
    private const long CASHIER_MEMBER = 16;

    private const long ATENDENTE = 40;
    private const long CAIXA = 41;

    private static readonly DateOnly TODAY = new(2026, 11, 25);

    private readonly Mock<ICompanyRepository<Company>> _companies = new();
    private readonly Mock<IMemberRepository<Member, MemberPosition, ManagerPosition>> _members = new();
    private readonly CompanyAccessPolicy _sut;

    public CompanyAccessPolicyTests()
    {
        _companies.Setup(r => r.GetByIdAsync(COMPANY))
            .ReturnsAsync(new Company { CompanyId = COMPANY, Name = "Padaria Sol", OwnerUserId = OWNER_USER });

        SetupMember(OWNER_MEMBER, OWNER_USER);
        SetupMember(MANAGER_MEMBER, MANAGER_USER, isManager: true);
        SetupMember(EMPLOYEE_MEMBER, EMPLOYEE_USER);
        SetupMember(INACTIVE_MEMBER, INACTIVE_USER, status: MemberStatus.Inactive);
        SetupMember(CASHIER_MEMBER, 99);

        _members.Setup(r => r.ListManagedPositionIdsAsync(MANAGER_MEMBER)).ReturnsAsync(new List<long> { ATENDENTE });
        _members.Setup(r => r.GetPositionIdOnAsync(EMPLOYEE_MEMBER, It.IsAny<DateOnly>())).ReturnsAsync(ATENDENTE);
        _members.Setup(r => r.GetPositionIdOnAsync(CASHIER_MEMBER, It.IsAny<DateOnly>())).ReturnsAsync(CAIXA);

        _sut = new CompanyAccessPolicy(_companies.Object, _members.Object);
    }

    private void SetupMember(long memberId, long userId, bool isManager = false, MemberStatus status = MemberStatus.Active)
    {
        var member = new Member
        {
            MemberId = memberId,
            CompanyId = COMPANY,
            UserId = userId,
            IsManager = isManager,
            Status = status
        };
        _members.Setup(r => r.GetByCompanyAndUserAsync(COMPANY, userId)).ReturnsAsync(member);
        _members.Setup(r => r.GetByIdAsync(COMPANY, memberId)).ReturnsAsync(member);
    }

    [Fact]
    public async Task RequireMemberAsync_ShouldThrowNotFound_WhenUserHasNoLinkWithCompany()
    {
        var act = () => _sut.RequireMemberAsync(COMPANY, OUTSIDER_USER);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task RequireMemberAsync_ShouldThrowNotFound_WhenMemberIsInactive()
    {
        var act = () => _sut.RequireMemberAsync(COMPANY, INACTIVE_USER);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task RequireMemberAsync_ShouldThrowNotFound_WhenCompanyDoesNotExist()
    {
        var act = () => _sut.RequireMemberAsync(OTHER_COMPANY, OWNER_USER);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task GetContextAsync_ShouldReturnInactiveContext_WhenUserHasNoLink()
    {
        var context = await _sut.GetContextAsync(COMPANY, OUTSIDER_USER);

        context.IsActive.Should().BeFalse();
        context.MemberId.Should().BeNull();
        context.IsOwner.Should().BeFalse();
    }

    [Fact]
    public async Task GetContextAsync_ShouldFillOwnerFlags_WhenUserIsTheOwner()
    {
        var context = await _sut.GetContextAsync(COMPANY, OWNER_USER);

        context.IsActive.Should().BeTrue();
        context.IsOwner.Should().BeTrue();
        context.IsManager.Should().BeFalse();
        context.MemberId.Should().Be(OWNER_MEMBER);
        context.ManagedPositionIds.Should().BeEmpty();
    }

    [Fact]
    public async Task GetContextAsync_ShouldLoadManagedPositions_WhenMemberIsManager()
    {
        var context = await _sut.GetContextAsync(COMPANY, MANAGER_USER);

        context.IsManager.Should().BeTrue();
        context.IsOwner.Should().BeFalse();
        context.ManagedPositionIds.Should().Equal(ATENDENTE);
    }

    [Fact]
    public async Task RequireOwnerAsync_ShouldThrowForbidden_WhenMemberIsNotTheOwner()
    {
        var act = () => _sut.RequireOwnerAsync(COMPANY, EMPLOYEE_USER);

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task RequireOwnerAsync_ShouldThrowForbidden_WhenMemberIsOnlyAManager()
    {
        var act = () => _sut.RequireOwnerAsync(COMPANY, MANAGER_USER);

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task RequireOwnerAsync_ShouldThrowNotFound_WhenUserHasNoLink()
    {
        var act = () => _sut.RequireOwnerAsync(COMPANY, OUTSIDER_USER);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task RequireOwnerAsync_ShouldReturnContext_WhenUserIsTheOwner()
    {
        var context = await _sut.RequireOwnerAsync(COMPANY, OWNER_USER);

        context.RequireOwner().Should().Be(OWNER_MEMBER);
    }

    [Theory]
    [InlineData(EMPLOYEE_MEMBER)]
    [InlineData(CASHIER_MEMBER)]
    [InlineData(MANAGER_MEMBER)]
    [InlineData(OWNER_MEMBER)]
    public async Task RequireCanSuperviseAsync_ShouldAllow_WhenCallerIsTheOwner(long target)
    {
        var context = await _sut.RequireOwnerAsync(COMPANY, OWNER_USER);

        var act = () => _sut.RequireCanSuperviseAsync(context, target, TODAY);

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task RequireCanSuperviseAsync_ShouldAllow_WhenTargetPositionIsManagedByTheManager()
    {
        var context = await _sut.RequireMemberAsync(COMPANY, MANAGER_USER);

        var act = () => _sut.RequireCanSuperviseAsync(context, EMPLOYEE_MEMBER, TODAY);

        await act.Should().NotThrowAsync();
        _members.Verify(r => r.GetPositionIdOnAsync(EMPLOYEE_MEMBER, TODAY), Times.Once);
    }

    [Fact]
    public async Task RequireCanSuperviseAsync_ShouldThrowForbidden_WhenTargetPositionIsOutsideManagerScope()
    {
        var context = await _sut.RequireMemberAsync(COMPANY, MANAGER_USER);

        var act = () => _sut.RequireCanSuperviseAsync(context, CASHIER_MEMBER, TODAY);

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task RequireCanSuperviseAsync_ShouldUsePositionOnTheGivenDate_WhenTargetChangedPosition()
    {
        var lastWeek = TODAY.AddDays(-7);
        _members.Setup(r => r.GetPositionIdOnAsync(CASHIER_MEMBER, lastWeek)).ReturnsAsync(ATENDENTE);
        var context = await _sut.RequireMemberAsync(COMPANY, MANAGER_USER);

        (await _sut.CanSuperviseAsync(context, CASHIER_MEMBER, lastWeek)).Should().BeTrue();
        (await _sut.CanSuperviseAsync(context, CASHIER_MEMBER, TODAY)).Should().BeFalse();
    }

    [Fact]
    public async Task RequireCanSuperviseAsync_ShouldThrowForbidden_WhenCallerIsCommonMember()
    {
        var context = await _sut.RequireMemberAsync(COMPANY, EMPLOYEE_USER);

        var act = () => _sut.RequireCanSuperviseAsync(context, CASHIER_MEMBER, TODAY);

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task RequireCanSuperviseAsync_ShouldThrowNotFound_WhenTargetIsNotInTheCompany()
    {
        var context = await _sut.RequireOwnerAsync(COMPANY, OWNER_USER);

        var act = () => _sut.RequireCanSuperviseAsync(context, 999, TODAY);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task RequireCanSuperviseAsync_ShouldThrowNotFound_WhenCallerHasNoActiveLink()
    {
        var context = await _sut.GetContextAsync(COMPANY, OUTSIDER_USER);

        var act = () => _sut.RequireCanSuperviseAsync(context, EMPLOYEE_MEMBER, TODAY);

        await act.Should().ThrowAsync<NotFoundException>();
    }
}
