using Google.Apis.Auth;
using Microsoft.Extensions.Options;
using Pontua.DTO.Auth;
using Pontua.DTO.Settings;
using Pontua.Infra.Interfaces.AppServices;

namespace Pontua.Infra.AppServices;

/// <summary>Valida o ID token com <see cref="GoogleJsonWebSignature"/> (R-02).</summary>
public class GoogleTokenAppService : IGoogleTokenAppService
{
    private readonly GoogleSettings _settings;

    public GoogleTokenAppService(IOptions<GoogleSettings> settings)
    {
        _settings = settings.Value;
    }

    public async Task<GoogleUserInfo?> ValidateAsync(string idToken)
    {
        // Salvaguarda: o AuthService já responde 404 quando o login Google está desabilitado e não chega aqui.
        if (!_settings.IsEnabled)
            throw new InvalidOperationException("Google:ClientId não configurado: login Google indisponível.");
        if (string.IsNullOrWhiteSpace(idToken))
            return null;

        GoogleJsonWebSignature.Payload payload;
        try
        {
            payload = await GoogleJsonWebSignature.ValidateAsync(idToken, new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = new[] { _settings.ClientId }
            });
        }
        catch (InvalidJwtException)
        {
            return null;
        }

        if (!payload.EmailVerified || string.IsNullOrWhiteSpace(payload.Email) || string.IsNullOrWhiteSpace(payload.Subject))
            return null;

        return new GoogleUserInfo
        {
            Subject = payload.Subject,
            Email = payload.Email,
            Name = payload.Name
        };
    }
}
