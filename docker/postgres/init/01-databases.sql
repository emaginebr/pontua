-- Executado pelo entrypoint do postgres apenas na primeira inicialização do volume (pontua_pgdata).
-- O banco principal de homologação ("pontua", POSTGRES_DB) já é criado pela imagem.
-- pontua_dev  -> ambiente Development (dotnet run no Windows, porta 5432 exposta no host)
-- pontua_test -> testes de integração (PONTUA_TEST_DB); descartável, as marcações não podem ser apagadas.
CREATE DATABASE pontua_dev;
CREATE DATABASE pontua_test;
