using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using PetGest.Api.Data;

namespace PetGest.Api.Tests.Catalog;

// Design D6 da T-15: TenantViolationException vira 403 em ProblemDetails, não 500.
public class TenantViolationHandlerTests
{
    private static async Task<(bool Handled, HttpContext Context)> HandleAsync(Exception exception)
    {
        using var factory = new ApiFactory();
        using var scope = factory.Services.CreateScope();
        var context = new DefaultHttpContext { RequestServices = scope.ServiceProvider };
        context.Response.Body = new MemoryStream();

        var handler = scope.ServiceProvider.GetServices<IExceptionHandler>().OfType<TenantViolationHandler>().Single();
        var handled = await handler.TryHandleAsync(context, exception, CancellationToken.None);
        return (handled, context);
    }

    [Fact]
    public async Task Violacao_de_isolamento_vira_403_com_code()
    {
        var (handled, context) = await HandleAsync(new TenantViolationException("Não é permitido gravar produto em outro petshop."));

        Assert.True(handled);
        Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
        context.Response.Body.Position = 0;
        using var body = await JsonDocument.ParseAsync(context.Response.Body);
        Assert.Equal("tenant_violation", body.RootElement.GetProperty("code").GetString());
        Assert.Equal(403, body.RootElement.GetProperty("status").GetInt32());
    }

    [Fact]
    public async Task Outras_excecoes_seguem_para_o_tratamento_padrao()
    {
        var (handled, _) = await HandleAsync(new InvalidOperationException("qualquer"));

        Assert.False(handled);
    }
}
