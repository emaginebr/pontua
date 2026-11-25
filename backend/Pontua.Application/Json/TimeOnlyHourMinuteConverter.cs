using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Pontua.Application.Json;

/// <summary>Horários no formato <c>HH:mm</c> (contracts/api.md); na leitura aceita também <c>HH:mm:ss</c>.</summary>
public class TimeOnlyHourMinuteConverter : JsonConverter<TimeOnly>
{
    private static readonly string[] _formats = { "HH:mm", "HH:mm:ss" };

    public override TimeOnly Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var value = reader.GetString();
        if (value != null
            && TimeOnly.TryParseExact(value, _formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var time))
            return time;
        throw new JsonException($"Horário inválido: '{value}'. Use o formato HH:mm.");
    }

    public override void Write(Utf8JsonWriter writer, TimeOnly value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value.ToString("HH:mm", CultureInfo.InvariantCulture));
}
