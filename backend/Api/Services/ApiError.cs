namespace PetGest.Api.Services;

// Erro esperado da API em ProblemDetails com a extensão `code` (design D5 da T-14,
// generalizado na T-15 — D1): o `code` é o que o frontend mapeia para a mensagem.
// `Errors` vira um ValidationProblem por campo; `Extensions` acrescenta dados (ex.: o
// produto dono de um código de barras repetido).
public record ApiError(
    int Status,
    string Code,
    string Title,
    IDictionary<string, string[]>? Errors = null,
    IReadOnlyDictionary<string, object?>? Extensions = null)
{
    public IResult ToResult()
    {
        var extensions = new Dictionary<string, object?> { ["code"] = Code };
        foreach (var (key, value) in Extensions ?? new Dictionary<string, object?>())
        {
            extensions[key] = value;
        }

        return Errors is null
            ? Results.Problem(statusCode: Status, title: Title, extensions: extensions)
            : Results.ValidationProblem(Errors, statusCode: Status, title: Title, extensions: extensions);
    }

    public static ApiError Validation(string code, string title, string field, string message) =>
        new(StatusCodes.Status400BadRequest, code, title, new Dictionary<string, string[]> { [field] = [message] });
}

// Sucesso com valor ou erro esperado, sem exceção para fluxo normal.
public readonly record struct ApiResult<T>(T? Value, ApiError? Error)
{
    public static implicit operator ApiResult<T>(T value) => new(value, null);
    public static implicit operator ApiResult<T>(ApiError error) => new(default, error);

    public IResult ToResult(Func<T, IResult> onSuccess) => Error?.ToResult() ?? onSuccess(Value!);
}
