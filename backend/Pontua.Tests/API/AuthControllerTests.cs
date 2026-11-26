using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Pontua.API.Controllers;
using Pontua.Domain.Exceptions;
using Pontua.Domain.Interfaces;
using Pontua.Domain.Services;
using Pontua.DTO;
using Pontua.DTO.Auth;

namespace Pontua.Tests.API;

public class AuthControllerTests
{
    [Fact]
    public async Task Google_ShouldReturn404WithStandardEnvelope_WhenGoogleLoginIsDisabled()
    {
        var authService = new Mock<IAuthService>();
        authService.Setup(s => s.GoogleLoginAsync(It.IsAny<GoogleLoginInfo>()))
            .ThrowsAsync(new NotFoundException(AuthService.GOOGLE_LOGIN_DISABLED_MESSAGE));
        var controller = new AuthController(authService.Object);

        var result = await controller.Google(new GoogleLoginInfo { IdToken = "x" });

        var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(404);
        var body = objectResult.Value.Should().BeOfType<ErrorResult>().Subject;
        body.Sucesso.Should().BeFalse();
        body.Mensagem.Should().Be("Login com Google não está habilitado neste ambiente.");
        body.Erros.Should().BeEmpty();
    }
}
