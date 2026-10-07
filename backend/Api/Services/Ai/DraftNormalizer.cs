using System.Globalization;
using System.Text;
using PetGest.Api.Models;

namespace PetGest.Api.Services.Ai;

// O que a IA devolve passa por aqui antes de chegar ao formulário (design D3 da T-19): o
// rascunho só traz valores que o cadastro aceitaria. O que não passar vira null e o
// usuário preenche — a IA sugere, quem confirma é o usuário.
public static class DraftNormalizer
{
    // As sete categorias do V0 (frontend/src/features/products/categories.ts).
    public static readonly string[] Categories =
        ["Ração", "Medicamento", "Higiene", "Acessórios", "Petiscos", "Jardinagem", "Agropecuário"];

    public static string? Name(string? value)
    {
        var name = value?.Trim();
        if (string.IsNullOrEmpty(name))
        {
            return null;
        }
        return name.Length <= ProductLimits.NameMaxLength ? name : name[..ProductLimits.NameMaxLength].TrimEnd();
    }

    // Aceita a categoria sem acento ou em outra caixa ("racao", "HIGIENE"); fora da lista, null.
    public static string? Category(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }
        var key = Fold(value);
        return Categories.FirstOrDefault(c => Fold(c) == key);
    }

    public static decimal? Price(decimal? value)
    {
        if (value is not { } price || price < 0 || price > (decimal)ProductLimits.MaxPrice)
        {
            return null;
        }
        return decimal.Round(price, 2, MidpointRounding.AwayFromZero);
    }

    // Só um código que o scanner também aceitaria: 8 a 14 dígitos com dígito verificador
    // válido. Um dígito lido errado pela IA vira null, não um código errado salvo.
    public static string? Ean(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }
        var digits = new string(value.Where(char.IsAsciiDigit).ToArray());
        return digits.Length is >= 8 and <= 14 && digits.Length == value.Count(c => !char.IsWhiteSpace(c) && c != '-')
            && IsValidGtin(digits)
            ? digits
            : null;
    }

    // Dígito verificador GS1 (EAN-8, UPC-A, EAN-13, GTIN-14): pesos 3 e 1 alternados a
    // partir do dígito à esquerda do verificador.
    public static bool IsValidGtin(string digits)
    {
        if (digits.Length is not (8 or 12 or 13 or 14) || !digits.All(char.IsAsciiDigit))
        {
            return false;
        }
        var sum = 0;
        for (var i = digits.Length - 2; i >= 0; i--)
        {
            var weight = (digits.Length - 2 - i) % 2 == 0 ? 3 : 1;
            sum += (digits[i] - '0') * weight;
        }
        return (10 - sum % 10) % 10 == digits[^1] - '0';
    }

    private static string Fold(string value)
    {
        var normalized = value.Trim().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(normalized.Length);
        foreach (var c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
            {
                builder.Append(char.ToLowerInvariant(c));
            }
        }
        return builder.ToString();
    }
}
