namespace Pontua.Domain.Models;

public class Company
{
    public const string DEFAULT_TIME_ZONE = "America/Sao_Paulo";
    public const int DEFAULT_MANUAL_RETRO_DAYS = 30;

    public long CompanyId { get; set; }
    public string Name { get; set; } = string.Empty;

    /// <summary>CNPJ/CPF, só dígitos (opcional).</summary>
    public string? Document { get; set; }

    /// <summary>ID IANA do fuso da empresa (R-06).</summary>
    public string TimeZone { get; set; } = DEFAULT_TIME_ZONE;

    /// <summary>Limite retroativo das marcações manuais, em dias (FR-018a).</summary>
    public int ManualRetroDays { get; set; } = DEFAULT_MANUAL_RETRO_DAYS;

    /// <summary>Usuário responsável pela empresa (FR-005: exatamente um).</summary>
    public long OwnerUserId { get; set; }

    /// <summary>Último NSR emitido; incrementado na gravação de cada marcação (R-05).</summary>
    public long LastNsr { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
