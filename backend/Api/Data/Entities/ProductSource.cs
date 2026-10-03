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
