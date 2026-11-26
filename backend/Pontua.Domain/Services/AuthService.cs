using FluentValidation;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Pontua.Domain.Exceptions;
using Pontua.Domain.Interfaces;
using Pontua.Domain.Models;
using Pontua.Domain.Validators;
using Pontua.DTO.Auth;
using Pontua.DTO.Settings;
using Pontua.Infra.Interfaces.AppServices;
using Pontua.Infra.Interfaces.Repository;

namespace Pontua.Domain.Services;

/// <summary>
/// Cadastro, entrada (e-mail+senha e Google) e dados da própria conta (R-02). O e-mail é sempre gravado e
/// comparado em minúsculas; falhas de login devolvem a mesma mensagem genérica, sem revelar se o e-mail existe.
/// </summary>
public class AuthService : IAuthService
{
    public const string INVALID_CREDENTIALS_MESSAGE = "E-mail ou senha inválidos.";
    public const string INVALID_GOOGLE_TOKEN_MESSAGE = "Token do Google inválido.";
    public const string EMAIL_IN_USE_MESSAGE = "Este e-mail já está em uso.";
    public const string GOOGLE_LOGIN_DISABLED_MESSAGE = "Login com Google não está habilitado neste ambiente.";

    private readonly IUserRepository<User> _userRepository;
    private readonly IPasswordHasher<User> _passwordHasher;
    private readonly ITokenService _tokenService;
    private readonly IGoogleTokenAppService _googleTokenAppService;
    private readonly GoogleSettings _googleSettings;
    private readonly IClock _clock;
    private readonly IValidator<RegisterInfo> _registerValidator;
    private readonly IValidator<LoginInfo> _loginValidator;
    private readonly IValidator<GoogleLoginInfo> _googleLoginValidator;
    private readonly IValidator<UserUpdateInfo> _userUpdateValidator;
    private readonly IValidator<PasswordUpdateInfo> _passwordUpdateValidator;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        IUserRepository<User> userRepository,
        IPasswordHasher<User> passwordHasher,
        ITokenService tokenService,
        IGoogleTokenAppService googleTokenAppService,
        IOptions<GoogleSettings> googleSettings,
        IClock clock,
        IValidator<RegisterInfo> registerValidator,
        IValidator<LoginInfo> loginValidator,
        IValidator<GoogleLoginInfo> googleLoginValidator,
        IValidator<UserUpdateInfo> userUpdateValidator,
        IValidator<PasswordUpdateInfo> passwordUpdateValidator,
        ILogger<AuthService> logger)
    {
        _userRepository = userRepository;
        _passwordHasher = passwordHasher;
        _tokenService = tokenService;
        _googleTokenAppService = googleTokenAppService;
        _googleSettings = googleSettings.Value;
        _clock = clock;
        _registerValidator = registerValidator;
        _loginValidator = loginValidator;
        _googleLoginValidator = googleLoginValidator;
        _userUpdateValidator = userUpdateValidator;
        _passwordUpdateValidator = passwordUpdateValidator;
        _logger = logger;
    }

    public async Task<AuthResult> RegisterAsync(RegisterInfo info)
    {
        await _registerValidator.EnsureValidAsync(info);

        var email = User.NormalizeEmail(info.Email);
        if (await _userRepository.ExistsEmailAsync(email))
            throw new ConflictException(EMAIL_IN_USE_MESSAGE);

        var now = _clock.UtcNow;
        var user = new User
        {
            Name = info.Name.Trim(),
            Email = email,
            CreatedAt = now,
            UpdatedAt = now
        };
        user.PasswordHash = _passwordHasher.HashPassword(user, info.Password);
        user = await _userRepository.InsertAsync(user);

        _logger.LogInformation("Conta criada por e-mail: usuário {UserId}.", user.UserId);
        return BuildResult(user, isNewUser: true);
    }

    public async Task<AuthResult> LoginAsync(LoginInfo info)
    {
        await _loginValidator.EnsureValidAsync(info);

        var user = await _userRepository.GetByEmailAsync(User.NormalizeEmail(info.Email));
        // Conta inexistente ou só-Google: mesma resposta de senha errada.
        if (user == null || !user.HasPassword)
            throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);

        var verification = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash!, info.Password);
        if (verification == PasswordVerificationResult.Failed)
            throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);

        if (verification == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = _passwordHasher.HashPassword(user, info.Password);
            user.UpdatedAt = _clock.UtcNow;
            await _userRepository.UpdateAsync(user);
        }

        return BuildResult(user, isNewUser: false);
    }

    public async Task<AuthResult> GoogleLoginAsync(GoogleLoginInfo info)
    {
        // Login com Google é opcional: sem Google:ClientId o recurso não existe neste ambiente (404), sem chamar o Google.
        if (!_googleSettings.IsEnabled)
        {
            _logger.LogInformation("POST /api/auth/google recusado: Google:ClientId não configurado (login com Google desabilitado).");
            throw new NotFoundException(GOOGLE_LOGIN_DISABLED_MESSAGE);
        }

        await _googleLoginValidator.EnsureValidAsync(info);

        var google = await _googleTokenAppService.ValidateAsync(info.IdToken)
            ?? throw new UnauthorizedException(INVALID_GOOGLE_TOKEN_MESSAGE);

        var user = await _userRepository.GetByGoogleSubjectAsync(google.Subject);
        if (user != null)
            return BuildResult(user, isNewUser: false);

        var email = User.NormalizeEmail(google.Email);
        var now = _clock.UtcNow;

        user = await _userRepository.GetByEmailAsync(email);
        if (user != null)
        {
            // Vincula a conta Google à conta existente com o mesmo e-mail (R-02; o Google garante e-mail verificado).
            if (user.HasGoogle)
                throw new ConflictException("Este e-mail já está vinculado a outra conta Google.");
            user.GoogleSubject = google.Subject;
            user.UpdatedAt = now;
            user = await _userRepository.UpdateAsync(user);
            _logger.LogInformation("Conta Google vinculada ao usuário {UserId}.", user.UserId);
            return BuildResult(user, isNewUser: false);
        }

        user = new User
        {
            Name = DisplayName(google.Name, email),
            Email = email,
            GoogleSubject = google.Subject,
            CreatedAt = now,
            UpdatedAt = now
        };
        user = await _userRepository.InsertAsync(user);
        _logger.LogInformation("Conta criada pelo Google: usuário {UserId}.", user.UserId);
        return BuildResult(user, isNewUser: true);
    }

    public async Task<UserInfo> GetMeAsync(long userId) => ToInfo(await RequireUserAsync(userId));

    public async Task<UserInfo> UpdateMeAsync(long userId, UserUpdateInfo info)
    {
        await _userUpdateValidator.EnsureValidAsync(info);

        var user = await RequireUserAsync(userId);
        user.Name = info.Name.Trim();
        user.UpdatedAt = _clock.UtcNow;
        user = await _userRepository.UpdateAsync(user);
        return ToInfo(user);
    }

    public async Task ChangePasswordAsync(long userId, PasswordUpdateInfo info)
    {
        await _passwordUpdateValidator.EnsureValidAsync(info);

        var user = await RequireUserAsync(userId);
        if (user.HasPassword)
        {
            if (string.IsNullOrEmpty(info.CurrentPassword))
                throw new Exceptions.ValidationException("currentPassword", "Informe a senha atual.");
            // 400 (não 401): o token é válido, só a senha atual está errada — o frontend não deve deslogar.
            if (_passwordHasher.VerifyHashedPassword(user, user.PasswordHash!, info.CurrentPassword) == PasswordVerificationResult.Failed)
                throw new Exceptions.ValidationException("currentPassword", "A senha atual está incorreta.");
        }

        user.PasswordHash = _passwordHasher.HashPassword(user, info.NewPassword);
        user.UpdatedAt = _clock.UtcNow;
        await _userRepository.UpdateAsync(user);
    }

    /// <summary>Token de um usuário que não existe mais → 401.</summary>
    private async Task<User> RequireUserAsync(long userId) =>
        await _userRepository.GetByIdAsync(userId) ?? throw new UnauthorizedException();

    private AuthResult BuildResult(User user, bool isNewUser)
    {
        var (token, expiresAt) = _tokenService.Generate(user);
        return new AuthResult
        {
            Token = token,
            ExpiresAt = expiresAt,
            IsNewUser = isNewUser,
            User = ToInfo(user)
        };
    }

    public static UserInfo ToInfo(User user) => new()
    {
        UserId = user.UserId,
        Name = user.Name,
        Email = user.Email,
        HasPassword = user.HasPassword,
        HasGoogle = user.HasGoogle
    };

    /// <summary>Nome do perfil Google; sem nome, a parte local do e-mail. Truncado ao limite da coluna.</summary>
    private static string DisplayName(string? googleName, string email)
    {
        var name = string.IsNullOrWhiteSpace(googleName) ? email.Split('@')[0] : googleName.Trim();
        return name.Length > UserRules.NAME_MAX_LENGTH ? name[..UserRules.NAME_MAX_LENGTH] : name;
    }
}
