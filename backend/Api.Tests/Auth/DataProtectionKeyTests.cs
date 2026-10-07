using System.Net;
using Microsoft.EntityFrameworkCore;
using PetGest.Api.Tests.Data;

namespace PetGest.Api.Tests.Auth;

// Chaves do Data Protection no banco (design D1 da T-17): um código enviado por e-mail
// continua válido numa instância nova da API (reinício, deploy, outra instância).
[Collection(DatabaseCollection.Name)]
public class DataProtectionKeyTests(DatabaseFixture fixture)
{
    [Fact]
    public async Task Codigo_gerado_numa_instancia_vale_em_outra()
    {
        var email = AuthApi.NewEmail();
        (Guid UserId, string Code) confirmation;
        using (var first = new AuthApi(fixture))
        {
            await first.SignupAsync(email);
            confirmation = first.ConfirmationFor(email);
        }

        using var second = new AuthApi(fixture);
        var response = await second.PostAsync("/auth/confirm-email", new { userId = confirmation.UserId, code = confirmation.Code });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        await using var db = fixture.Anonymous();
        Assert.True(await db.DataProtectionKeys.AnyAsync());
    }
}
