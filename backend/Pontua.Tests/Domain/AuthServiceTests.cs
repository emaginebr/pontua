using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Pontua.Domain.Exceptions;
using Pontua.Domain.Interfaces;
using Pontua.Domain.Models;
using Pontua.Domain.Services;
using Pontua.Domain.Validators;
using Pontua.DTO.Auth;
using Pontua.Infra.Interfaces.AppServices;
using Pontua.Infra.Interfaces.Repository;

namespace Pontua.Tests.Domain;

public class AuthServiceTests
{
    private static readonly DateTime NOW = new(2026, 11, 25, 15, 0, 0, DateTimeKind.Utc);
    private const string PASSWORD = "senha-forte-123";

    private readonly Mock<IUserRepository<User>> _users = new();
    private readonly Mock<ITokenService> _tokens = new();
    private readonly Mock<IGoogleTokenAppService> _google = new();
    private readonly Mock<IClock> _clock = new();
    private readonly PasswordHasher<User> _hasher = new();
    private readonly List<User> _store = new();
    private readonly AuthService _sut;

    public AuthServiceTests()
    {
        _clock.Setup(c => c.UtcNow).Returns(NOW);
        _tokens.Setup(t => t.Generate(It.IsAny<User>())).Returns(("jwt", NOW.AddHours(12)));

        // Repositório em memória sobre a lista _store.
        _users.Setup(r => r.ExistsEmailAsync(It.IsAny<string>(), It.IsAny<long?>()))
            .ReturnsAsync((string email, long? except) => _store.Any(u => u.Email == email && u.UserId != except));
        _users.Setup(r => r.GetByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync((string email) => _store.FirstOrDefault(u => u.Email == User.NormalizeEmail(email)));
        _users.Setup(r => r.GetByGoogleSubjectAsync(It.IsAny<string>()))
            .ReturnsAsync((string subject) => _store.FirstOrDefault(u => u.GoogleSubject == subject));
        _users.Setup(r => r.GetByIdAsync(It.IsAny<long>()))
            .ReturnsAsync((long id) => _store.FirstOrDefault(u => u.UserId == id));
        _users.Setup(r => r.InsertAsync(It.IsAny<User>()))
            .ReturnsAsync((User user) =>
            {
                user.UserId = _store.Count + 1;
                _store.Add(user);
                return user;
            });
        _users.Setup(r => r.UpdateAsync(It.IsAny<User>())).ReturnsAsync((User user) => user);

        _sut = new AuthService(
            _users.Object,
            _hasher,
            _tokens.Object,
            _google.Object,
            _clock.Object,
            new RegisterInfoValidator(),
            new LoginInfoValidator(),
            new GoogleLoginInfoValidator(),
            new UserUpdateInfoValidator(),
            new PasswordUpdateInfoValidator(),
            NullLogger<AuthService>.Instance);
    }

    private User AddUser(string email, string? password = PASSWORD, string? googleSubject = null)
    {
        var user = new User
        {
            UserId = _store.Count + 1,
            Name = "Ana Silva",
            Email = email,
            GoogleSubject = googleSubject,
            CreatedAt = NOW,
            UpdatedAt = NOW
        };
        if (password != null)
            user.PasswordHash = _hasher.HashPassword(user, password);
        _store.Add(user);
        return user;
    }

    [Fact]
    public async Task RegisterAsync_ShouldCreateUserWithLowercaseEmailAndHashedPassword_WhenDataIsValid()
    {
        var result = await _sut.RegisterAsync(new RegisterInfo { Name = " Ana Silva ", Email = "Ana@Ex.COM", Password = PASSWORD });

        result.Token.Should().Be("jwt");
        result.IsNewUser.Should().BeTrue();
        result.User.Email.Should().Be("ana@ex.com");
        result.User.Name.Should().Be("Ana Silva");
        result.User.HasPassword.Should().BeTrue();
        result.User.HasGoogle.Should().BeFalse();

        var stored = _store.Single();
        stored.PasswordHash.Should().NotBeNullOrEmpty().And.NotBe(PASSWORD);
        _hasher.VerifyHashedPassword(stored, stored.PasswordHash!, PASSWORD).Should().NotBe(PasswordVerificationResult.Failed);
    }

    [Fact]
    public async Task RegisterAsync_ShouldThrowConflict_WhenEmailIsAlreadyInUseWithDifferentCase()
    {
        AddUser("ana@ex.com");

        var act = () => _sut.RegisterAsync(new RegisterInfo { Name = "Outra Ana", Email = "ANA@ex.com", Password = PASSWORD });

        await act.Should().ThrowAsync<ConflictException>();
        _users.Verify(r => r.InsertAsync(It.IsAny<User>()), Times.Never);
    }

    [Fact]
    public async Task RegisterAsync_ShouldThrowValidation_WhenPasswordHasLessThan8Characters()
    {
        var act = () => _sut.RegisterAsync(new RegisterInfo { Name = "Ana", Email = "ana@ex.com", Password = "1234567" });

        var ex = await act.Should().ThrowAsync<ValidationException>();
        ex.Which.Errors.Should().ContainSingle(e => e.Field == "password");
    }

    [Fact]
    public async Task LoginAsync_ShouldReturnToken_WhenCredentialsAreValidAndEmailHasDifferentCase()
    {
        AddUser("ana@ex.com");

        var result = await _sut.LoginAsync(new LoginInfo { Email = " ANA@EX.com ", Password = PASSWORD });

        result.Token.Should().Be("jwt");
        result.IsNewUser.Should().BeFalse();
        result.User.Email.Should().Be("ana@ex.com");
    }

    [Fact]
    public async Task LoginAsync_ShouldThrowUnauthorizedWithGenericMessage_WhenPasswordIsWrong()
    {
        AddUser("ana@ex.com");

        var act = () => _sut.LoginAsync(new LoginInfo { Email = "ana@ex.com", Password = "senha-errada" });

        (await act.Should().ThrowAsync<UnauthorizedException>())
            .WithMessage(AuthService.INVALID_CREDENTIALS_MESSAGE);
    }

    [Fact]
    public async Task LoginAsync_ShouldThrowUnauthorizedWithGenericMessage_WhenEmailDoesNotExist()
    {
        var act = () => _sut.LoginAsync(new LoginInfo { Email = "ninguem@ex.com", Password = PASSWORD });

        (await act.Should().ThrowAsync<UnauthorizedException>())
            .WithMessage(AuthService.INVALID_CREDENTIALS_MESSAGE);
    }

    [Fact]
    public async Task LoginAsync_ShouldThrowUnauthorizedWithGenericMessage_WhenAccountUsesOnlyGoogle()
    {
        AddUser("ana@ex.com", password: null, googleSubject: "google-123");

        var act = () => _sut.LoginAsync(new LoginInfo { Email = "ana@ex.com", Password = PASSWORD });

        (await act.Should().ThrowAsync<UnauthorizedException>())
            .WithMessage(AuthService.INVALID_CREDENTIALS_MESSAGE);
    }

    [Fact]
    public async Task GoogleLoginAsync_ShouldThrowUnauthorized_WhenTokenIsInvalid()
    {
        _google.Setup(g => g.ValidateAsync("ruim")).ReturnsAsync((GoogleUserInfo?)null);

        var act = () => _sut.GoogleLoginAsync(new GoogleLoginInfo { IdToken = "ruim" });

        await act.Should().ThrowAsync<UnauthorizedException>();
    }

    [Fact]
    public async Task GoogleLoginAsync_ShouldReturnExistingUser_WhenGoogleSubjectIsAlreadyLinked()
    {
        var user = AddUser("ana@ex.com", password: null, googleSubject: "google-123");
        _google.Setup(g => g.ValidateAsync("ok"))
            .ReturnsAsync(new GoogleUserInfo { Subject = "google-123", Email = "ana@ex.com", Name = "Ana" });

        var result = await _sut.GoogleLoginAsync(new GoogleLoginInfo { IdToken = "ok" });

        result.IsNewUser.Should().BeFalse();
        result.User.UserId.Should().Be(user.UserId);
        _users.Verify(r => r.InsertAsync(It.IsAny<User>()), Times.Never);
    }

    [Fact]
    public async Task GoogleLoginAsync_ShouldLinkGoogleToExistingAccount_WhenEmailAlreadyExists()
    {
        var user = AddUser("ana@ex.com");
        _google.Setup(g => g.ValidateAsync("ok"))
            .ReturnsAsync(new GoogleUserInfo { Subject = "google-123", Email = "Ana@Ex.com", Name = "Ana G." });

        var result = await _sut.GoogleLoginAsync(new GoogleLoginInfo { IdToken = "ok" });

        result.IsNewUser.Should().BeFalse();
        result.User.UserId.Should().Be(user.UserId);
        result.User.HasPassword.Should().BeTrue();
        result.User.HasGoogle.Should().BeTrue();
        user.GoogleSubject.Should().Be("google-123");
        _users.Verify(r => r.UpdateAsync(user), Times.Once);
        _users.Verify(r => r.InsertAsync(It.IsAny<User>()), Times.Never);
    }

    [Fact]
    public async Task GoogleLoginAsync_ShouldCreateAccountWithoutPassword_WhenEmailIsNew()
    {
        _google.Setup(g => g.ValidateAsync("ok"))
            .ReturnsAsync(new GoogleUserInfo { Subject = "google-123", Email = "Joao@Ex.com", Name = "João Lima" });

        var result = await _sut.GoogleLoginAsync(new GoogleLoginInfo { IdToken = "ok" });

        result.IsNewUser.Should().BeTrue();
        result.User.Email.Should().Be("joao@ex.com");
        result.User.Name.Should().Be("João Lima");
        result.User.HasPassword.Should().BeFalse();
        result.User.HasGoogle.Should().BeTrue();
    }

    [Fact]
    public async Task ChangePasswordAsync_ShouldThrowValidation_WhenCurrentPasswordIsWrong()
    {
        var user = AddUser("ana@ex.com");

        var act = () => _sut.ChangePasswordAsync(user.UserId,
            new PasswordUpdateInfo { CurrentPassword = "senha-errada", NewPassword = "nova-senha-123" });

        var ex = await act.Should().ThrowAsync<ValidationException>();
        ex.Which.Errors.Should().ContainSingle(e => e.Field == "currentPassword");
    }

    [Fact]
    public async Task ChangePasswordAsync_ShouldSetFirstPassword_WhenAccountUsesOnlyGoogle()
    {
        var user = AddUser("ana@ex.com", password: null, googleSubject: "google-123");

        await _sut.ChangePasswordAsync(user.UserId, new PasswordUpdateInfo { NewPassword = "nova-senha-123" });

        user.HasPassword.Should().BeTrue();
        var login = await _sut.LoginAsync(new LoginInfo { Email = "ana@ex.com", Password = "nova-senha-123" });
        login.User.UserId.Should().Be(user.UserId);
    }

    [Fact]
    public async Task GetMeAsync_ShouldThrowUnauthorized_WhenUserNoLongerExists()
    {
        var act = () => _sut.GetMeAsync(999);

        await act.Should().ThrowAsync<UnauthorizedException>();
    }
}
