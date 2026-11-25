namespace Pontua.DTO.Settings;

public class AppSettings
{
    /// <summary>URL base do frontend, sem barra final; monta o link do convite (<c>{base}/convite/{token}</c>).</summary>
    public string FrontendBaseUrl { get; set; } = string.Empty;
}
