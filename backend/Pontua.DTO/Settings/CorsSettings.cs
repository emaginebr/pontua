namespace Pontua.DTO.Settings;

public class CorsSettings
{
    /// <summary>Origens permitidas fora de Development.</summary>
    public string[] AllowedOrigins { get; set; } = Array.Empty<string>();
}
