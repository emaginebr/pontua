# syntax=docker/dockerfile:1
# Imagem da API Pontua (homologação via docker compose; base para o deploy em Kubernetes).
# Contexto de build: backend/

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_HTTP_PORTS=8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src

# 1) Restore com cache de camada: só os .csproj necessários para a API (Pontua.Tests fica de fora).
COPY Pontua.DTO/Pontua.DTO.csproj Pontua.DTO/
COPY Pontua.Domain/Pontua.Domain.csproj Pontua.Domain/
COPY Pontua.Infra.Interfaces/Pontua.Infra.Interfaces.csproj Pontua.Infra.Interfaces/
COPY Pontua.Infra/Pontua.Infra.csproj Pontua.Infra/
COPY Pontua.Application/Pontua.Application.csproj Pontua.Application/
COPY Pontua.API/Pontua.API.csproj Pontua.API/
RUN dotnet restore Pontua.API/Pontua.API.csproj

# 2) Código-fonte e publish.
COPY Pontua.DTO/ Pontua.DTO/
COPY Pontua.Domain/ Pontua.Domain/
COPY Pontua.Infra.Interfaces/ Pontua.Infra.Interfaces/
COPY Pontua.Infra/ Pontua.Infra/
COPY Pontua.Application/ Pontua.Application/
COPY Pontua.API/ Pontua.API/
RUN dotnet publish Pontua.API/Pontua.API.csproj -c $BUILD_CONFIGURATION -o /app/publish --no-restore /p:UseAppHost=false

FROM base AS final
WORKDIR /app
# curl para o healthcheck do compose/Kubernetes.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/publish .
USER $APP_UID
ENTRYPOINT ["dotnet", "Pontua.API.dll"]
