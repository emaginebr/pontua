namespace Pontua.DTO.Settings;

public class JwtSettings
{
    public string Secret { get; set; } = string.Empty;
    public int ExpirationHours { get; set; } = 12;
    public string Issuer { get; set; } = "pontua";
    public string Audience { get; set; } = "pontua";
}
