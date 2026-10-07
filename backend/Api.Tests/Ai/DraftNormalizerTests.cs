using PetGest.Api.Services.Ai;

namespace PetGest.Api.Tests.Ai;

// O rascunho da IA só traz valores que o cadastro aceitaria (design D3 da T-19).
public class DraftNormalizerTests
{
    [Theory]
    [InlineData("Ração", "Ração")]
    [InlineData("racao", "Ração")]
    [InlineData(" HIGIENE ", "Higiene")]
    [InlineData("acessorios", "Acessórios")]
    [InlineData("agropecuario", "Agropecuário")]
    [InlineData("Brinquedos", null)]
    [InlineData("", null)]
    [InlineData(null, null)]
    public void Categoria_vira_uma_das_sete_ou_nada(string? input, string? expected) =>
        Assert.Equal(expected, DraftNormalizer.Category(input));

    [Theory]
    [InlineData("7891000315507", "7891000315507")] // EAN-13 válido
    [InlineData("78924383", "78924383")]           // EAN-8 válido (o do teste de campo)
    [InlineData("7891000315508", null)]            // dígito verificador errado
    [InlineData("789 1000 315507", "7891000315507")]
    [InlineData("7891000-315507", "7891000315507")]
    [InlineData("78910A0315507", null)]
    [InlineData("12345", null)]
    [InlineData(null, null)]
    public void Codigo_so_passa_com_digito_verificador_valido(string? input, string? expected) =>
        Assert.Equal(expected, DraftNormalizer.Ean(input));

    [Theory]
    [InlineData("189.90", "189.90")]
    [InlineData("12.5", "12.50")]
    [InlineData("12.345", "12.35")]
    [InlineData("-1", null)]
    [InlineData("100000000", null)]
    public void Preco_negativo_ou_absurdo_vira_nada(string input, string? expected) =>
        Assert.Equal(expected is null ? null : decimal.Parse(expected, System.Globalization.CultureInfo.InvariantCulture),
            DraftNormalizer.Price(decimal.Parse(input, System.Globalization.CultureInfo.InvariantCulture)));

    [Fact]
    public void Nome_e_aparado_e_cortado_no_limite()
    {
        Assert.Equal("Coleira Nylon M", DraftNormalizer.Name("  Coleira Nylon M  "));
        Assert.Null(DraftNormalizer.Name("   "));
        Assert.Equal(200, DraftNormalizer.Name(new string('a', 250))!.Length);
    }
}
