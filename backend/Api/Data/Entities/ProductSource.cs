namespace PetGest.Api.Data.Entities;

// Origem do produto, gravada como texto (`manual`, `barcode`, `photo_ai`, `voice_ai`);
// os dois primeiros são os do V0. Manual é o valor zero de propósito: coincide com o
// default 'manual' do banco.
public enum ProductSource
{
    Manual = 0,
    Barcode = 1,
    PhotoAI = 2,
    VoiceAI = 3,
}

// Texto da origem no banco e na API — um só lugar para os dois (design D2 da T-15).
public static class ProductSourceExtensions
{
    public const string Manual = "manual";
    public const string Barcode = "barcode";
    public const string PhotoAI = "photo_ai";
    public const string VoiceAI = "voice_ai";

    public static string ToWire(this ProductSource source) => source switch
    {
        ProductSource.Manual => Manual,
        ProductSource.Barcode => Barcode,
        ProductSource.PhotoAI => PhotoAI,
        ProductSource.VoiceAI => VoiceAI,
        _ => throw new ArgumentOutOfRangeException(nameof(source), source, "Origem de produto desconhecida."),
    };

    public static ProductSource FromWire(string value) => value switch
    {
        Manual => ProductSource.Manual,
        Barcode => ProductSource.Barcode,
        PhotoAI => ProductSource.PhotoAI,
        VoiceAI => ProductSource.VoiceAI,
        _ => throw new InvalidOperationException($"Origem de produto desconhecida: '{value}'."),
    };
}
