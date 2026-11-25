using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Pontua.Domain.Interfaces;
using Pontua.Domain.Models;
using Pontua.DTO.Settings;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Pontua.Domain.Services;

/// <summary>Emite o JWT HMAC-SHA256 do Pontua (R-02, Princípio VI) com <c>sub</c> = userId.</summary>
public class TokenService : ITokenService
{
    private readonly JwtSettings _settings;
    private readonly IClock _clock;

    public TokenService(IOptions<JwtSettings> settings, IClock clock)
    {
        _settings = settings.Value;
        _clock = clock;
    }

    public (string Token, DateTime ExpiresAt) Generate(User user)
    {
        var now = _clock.UtcNow;
        var expiresAt = now.AddHours(_settings.ExpirationHours);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.UserId.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new("name", user.Name)
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.Secret));
        var token = new JwtSecurityToken(
            issuer: _settings.Issuer,
            audience: _settings.Audience,
            claims: claims,
            notBefore: now,
            expires: expiresAt,
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        return (new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }
}
