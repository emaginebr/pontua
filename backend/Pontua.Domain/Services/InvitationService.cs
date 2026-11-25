using System.Security.Cryptography;
using FluentValidation;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Pontua.Domain.Enums;
using Pontua.Domain.Exceptions;
using Pontua.Domain.Interfaces;
using Pontua.Domain.Models;
using Pontua.Domain.Validators;
using Pontua.DTO.Common;
using Pontua.DTO.Companies;
using Pontua.DTO.Invitations;
using Pontua.DTO.Positions;
using Pontua.DTO.Settings;
using Pontua.Infra.Interfaces.Repository;

namespace Pontua.Domain.Services;

/// <summary>
/// Convites (R-13): token aleatório de 32 bytes em base64url, gravado em claro (o link pode ser recopiado),
/// reutilizável até expirar ou ser revogado.
/// </summary>
public class InvitationService : IInvitationService
{
    public const int TOKEN_BYTES = 32;
    public const string INVITATION_NOT_FOUND_MESSAGE = "Convite não encontrado.";
    public const string ALREADY_MEMBER_MESSAGE = "Você já é membro ativo desta empresa.";

    /// <summary>Aceite concorrente do mesmo usuário: o índice único <c>(company_id, user_id)</c> recusou a gravação.</summary>
    public const string CONCURRENT_MEMBER_MESSAGE = "Você já é membro desta empresa.";
    public const string EXPIRED_MESSAGE = "Este convite expirou. Peça um novo link ao responsável pela empresa.";
    public const string REVOKED_MESSAGE = "Este convite foi revogado. Peça um novo link ao responsável pela empresa.";
    public const string INVITE_PATH = "/convite/";

    private readonly IInvitationRepository<Invitation> _invitationRepository;
    private readonly ICompanyRepository<Company> _companyRepository;
    private readonly IPositionRepository<Position> _positionRepository;
    private readonly IMemberRepository<Member, MemberPosition, ManagerPosition> _memberRepository;
    private readonly IUserRepository<User> _userRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICompanyAccessPolicy _accessPolicy;
    private readonly ICompanyClock _companyClock;
    private readonly IClock _clock;
    private readonly IValidator<InvitationInsertInfo> _insertValidator;
    private readonly AppSettings _appSettings;
    private readonly ILogger<InvitationService> _logger;

    public InvitationService(
        IInvitationRepository<Invitation> invitationRepository,
        ICompanyRepository<Company> companyRepository,
        IPositionRepository<Position> positionRepository,
        IMemberRepository<Member, MemberPosition, ManagerPosition> memberRepository,
        IUserRepository<User> userRepository,
        IUnitOfWork unitOfWork,
        ICompanyAccessPolicy accessPolicy,
        ICompanyClock companyClock,
        IClock clock,
        IValidator<InvitationInsertInfo> insertValidator,
        IOptions<AppSettings> appSettings,
        ILogger<InvitationService> logger)
    {
        _invitationRepository = invitationRepository;
        _companyRepository = companyRepository;
        _positionRepository = positionRepository;
        _memberRepository = memberRepository;
        _userRepository = userRepository;
        _unitOfWork = unitOfWork;
        _accessPolicy = accessPolicy;
        _companyClock = companyClock;
        _clock = clock;
        _insertValidator = insertValidator;
        _appSettings = appSettings.Value;
        _logger = logger;
    }

    public async Task<List<InvitationInfo>> ListAsync(long companyId, long userId, DateRangeQuery? query, string? status)
    {
        await _accessPolicy.RequireOwnerAsync(companyId, userId);
        var statusFilter = ParseStatusFilter(status);

        var company = await RequireCompanyAsync(companyId);
        var range = DateRangeResolver.Resolve(query, _companyClock.TodayLocal(company.TimeZone));
        var (fromUtc, toUtc) = _companyClock.UtcBounds(range.Start, range.End, company.TimeZone);

        var invitations = await _invitationRepository.ListByCompanyAsync(companyId, fromUtc, toUtc);
        var now = _clock.UtcNow;
        if (statusFilter != null)
            invitations = invitations.Where(i => StatusOf(i, now) == statusFilter).ToList();
        if (invitations.Count == 0)
            return new List<InvitationInfo>();

        var positions = (await _positionRepository.ListByCompanyAsync(companyId)).ToDictionary(p => p.PositionId);
        var creators = (await _userRepository.GetByIdsAsync(invitations.Select(i => i.CreatedByUserId)))
            .ToDictionary(u => u.UserId, u => u.Name);

        return invitations
            .OrderByDescending(i => i.CreatedAt).ThenByDescending(i => i.InvitationId)
            .Select(i => ToInfo(i, positions.GetValueOrDefault(i.PositionId), creators.GetValueOrDefault(i.CreatedByUserId), now))
            .ToList();
    }

    public async Task<InvitationInfo> CreateAsync(long companyId, long userId, InvitationInsertInfo info)
    {
        await _accessPolicy.RequireOwnerAsync(companyId, userId);
        await _insertValidator.EnsureValidAsync(info);

        var position = await _positionRepository.GetByIdAsync(companyId, info.PositionId!.Value)
            ?? throw new NotFoundException(PositionService.POSITION_NOT_FOUND_MESSAGE);

        var now = _clock.UtcNow;
        var invitation = await _invitationRepository.InsertAsync(new Invitation
        {
            CompanyId = companyId,
            PositionId = position.PositionId,
            Token = GenerateToken(),
            ExpiresAt = now.AddDays(info.ExpiresInDays ?? InvitationInsertInfo.DEFAULT_EXPIRES_IN_DAYS),
            RevokedAt = null,
            AcceptedCount = 0,
            CreatedByUserId = userId,
            CreatedAt = now
        });

        var creator = await _userRepository.GetByIdAsync(userId);
        _logger.LogInformation("Convite {InvitationId} para o cargo {PositionId} criado na empresa {CompanyId} pelo usuário {UserId}.",
            invitation.InvitationId, position.PositionId, companyId, userId);
        return ToInfo(invitation, position, creator?.Name, now);
    }

    public async Task RevokeAsync(long companyId, long userId, long invitationId)
    {
        await _accessPolicy.RequireOwnerAsync(companyId, userId);
        var invitation = await _invitationRepository.GetByIdAsync(companyId, invitationId)
            ?? throw new NotFoundException(INVITATION_NOT_FOUND_MESSAGE);

        if (invitation.RevokedAt != null)
            return;

        invitation.RevokedAt = _clock.UtcNow;
        await _invitationRepository.UpdateAsync(invitation);
        _logger.LogInformation("Convite {InvitationId} revogado na empresa {CompanyId} pelo usuário {UserId}.",
            invitationId, companyId, userId);
    }

    public async Task<InvitationPublicInfo> GetPublicAsync(string token)
    {
        var invitation = await RequireByTokenAsync(token);
        var company = await RequireCompanyAsync(invitation.CompanyId);
        var position = await _positionRepository.GetByIdAsync(invitation.CompanyId, invitation.PositionId);

        return new InvitationPublicInfo
        {
            CompanyName = company.Name,
            PositionName = position?.Name ?? string.Empty,
            Status = StatusOf(invitation, _clock.UtcNow),
            ExpiresAt = invitation.ExpiresAt
        };
    }

    public async Task<CompanySummary> AcceptAsync(string token, long userId)
    {
        var invitation = await RequireByTokenAsync(token);
        var now = _clock.UtcNow;

        // Revogado tem prioridade: é a informação mais útil para quem recebeu o link.
        switch (StatusOf(invitation, now))
        {
            case InvitationStatuses.REVOKED:
                throw new BusinessRuleException(REVOKED_MESSAGE);
            case InvitationStatuses.EXPIRED:
                throw new BusinessRuleException(EXPIRED_MESSAGE);
        }

        var company = await RequireCompanyAsync(invitation.CompanyId);
        var position = await _positionRepository.GetByIdAsync(company.CompanyId, invitation.PositionId)
            ?? throw new NotFoundException(PositionService.POSITION_NOT_FOUND_MESSAGE);

        var member = await _memberRepository.GetByCompanyAndUserAsync(company.CompanyId, userId);
        if (member is { IsActive: true })
            throw new ConflictException(ALREADY_MEMBER_MESSAGE);

        var today = _companyClock.TodayLocal(company.TimeZone);
        var reactivated = member != null;

        await _unitOfWork.BeginTransactionAsync();
        try
        {
            if (member == null)
            {
                member = await _memberRepository.InsertAsync(new Member
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
            }
            else
            {
                // Membro desativado volta com o cargo do novo convite (edge case da spec).
                member.Status = MemberStatus.Active;
                member.DeactivatedAt = null;
                member.ActiveSince = today;
                member.UpdatedAt = now;
                member = await _memberRepository.UpdateAsync(member);
            }

            await _memberRepository.UpsertPositionAsync(new MemberPosition
            {
                MemberId = member.MemberId,
                PositionId = position.PositionId,
                EffectiveFrom = today,
                CreatedByUserId = userId,
                CreatedAt = now
            });

            // Incremento atômico no banco: aceites simultâneos (de usuários diferentes) não perdem contagem.
            await _invitationRepository.IncrementAcceptedCountAsync(invitation.InvitationId);

            await _unitOfWork.CommitAsync();
        }
        catch (UniqueConstraintViolationException ex)
        {
            // Dois aceites simultâneos do mesmo usuário: o segundo esbarra no índice único de members
            // (company_id, user_id) ou de member_positions (member_id, effective_from).
            await _unitOfWork.RollbackAsync();
            _logger.LogInformation(
                "Aceite concorrente do convite {InvitationId} pelo usuário {UserId} na empresa {CompanyId} recusado ({Constraint}).",
                invitation.InvitationId, userId, company.CompanyId, ex.ConstraintName);
            throw new ConflictException(CONCURRENT_MEMBER_MESSAGE);
        }
        catch
        {
            await _unitOfWork.RollbackAsync();
            throw;
        }

        _logger.LogInformation(
            "Convite {InvitationId} aceito pelo usuário {UserId}: membro {MemberId} {Action} na empresa {CompanyId} com o cargo {PositionId}.",
            invitation.InvitationId, userId, member.MemberId, reactivated ? "reativado" : "criado", company.CompanyId, position.PositionId);

        return new CompanySummary
        {
            CompanyId = company.CompanyId,
            Name = company.Name,
            IsOwner = company.OwnerUserId == userId,
            IsManager = member.IsManager,
            MemberId = member.MemberId,
            PositionName = position.Name
        };
    }

    /// <summary>32 bytes de <see cref="RandomNumberGenerator"/> em base64url sem padding (43 caracteres).</summary>
    public static string GenerateToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(TOKEN_BYTES);
        return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    /// <summary>Situação derivada: revogado → expirado (<c>expires_at ≤ agora</c>) → ativo.</summary>
    public static string StatusOf(Invitation invitation, DateTime utcNow)
    {
        if (invitation.RevokedAt != null)
            return InvitationStatuses.REVOKED;
        return invitation.ExpiresAt <= utcNow ? InvitationStatuses.EXPIRED : InvitationStatuses.ACTIVE;
    }

    public string BuildUrl(string token) => $"{_appSettings.FrontendBaseUrl.TrimEnd('/')}{INVITE_PATH}{token}";

    private InvitationInfo ToInfo(Invitation invitation, Position? position, string? createdBy, DateTime now) => new()
    {
        InvitationId = invitation.InvitationId,
        Position = new PositionRef { PositionId = invitation.PositionId, Name = position?.Name ?? string.Empty },
        Token = invitation.Token,
        Url = BuildUrl(invitation.Token),
        Status = StatusOf(invitation, now),
        ExpiresAt = invitation.ExpiresAt,
        AcceptedCount = invitation.AcceptedCount,
        CreatedBy = createdBy ?? string.Empty,
        CreatedAt = invitation.CreatedAt
    };

    private static string? ParseStatusFilter(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
            return null;
        var normalized = status.Trim().ToLowerInvariant();
        if (!InvitationStatuses.ALL.Contains(normalized))
            throw new Exceptions.ValidationException("status", "Situação inválida. Use active, expired ou revoked.");
        return normalized;
    }

    private async Task<Invitation> RequireByTokenAsync(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
            throw new NotFoundException(INVITATION_NOT_FOUND_MESSAGE);
        return await _invitationRepository.GetByTokenAsync(token.Trim())
            ?? throw new NotFoundException(INVITATION_NOT_FOUND_MESSAGE);
    }

    private async Task<Company> RequireCompanyAsync(long companyId) =>
        await _companyRepository.GetByIdAsync(companyId)
        ?? throw new NotFoundException(AccessContext.COMPANY_NOT_FOUND_MESSAGE);
}
