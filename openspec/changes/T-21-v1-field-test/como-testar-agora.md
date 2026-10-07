# Como testar o V1 no celular agora (rede local)

Antes de o V1 estar publicado (T-17), dá para testar tudo pelo celular rodando a
API e o frontend no seu computador, com o celular no **mesmo Wi-Fi**. Nada disso
toca a produção: a API usa um Postgres local.

Tempo: ~15 minutos na primeira vez.

## 1. Banco local (Postgres 17 na porta 5450)

### Opção A — Docker (o normal)

```powershell
cd backend
docker compose up -d --wait
```

Se o Docker Desktop abrir com "An unexpected error occurred" (o erro de
2026-10-06, sobre `dockerInference` ou `engine.sock`), **reinicie o Windows** e
tente de novo. Se continuar, use a opção B.

### Opção B — sem Docker (Postgres portátil pelo npm)

Foi o que eu usei nesta madrugada. No PowerShell, **fora** da pasta do projeto:

```powershell
mkdir $env:TEMP\petgest-pg; cd $env:TEMP\petgest-pg
npm init -y
npm install @embedded-postgres/windows-x64@17.10.0-beta.17 pg
"petgest_dev" | Out-File pw.txt -Encoding ascii
$B = ".\node_modules\@embedded-postgres\windows-x64\native\bin"
& "$B\initdb.exe" -D data -U petgest --pwfile=pw.txt -A scram-sha-256 -E UTF8 --locale=C
& "$B\pg_ctl.exe" -D data -o "-p 5450" -l pg.log start
node -e "const {Client}=require('pg');const c=new Client({host:'localhost',port:5450,user:'petgest',password:'petgest_dev',database:'postgres'});c.connect().then(()=>c.query('create database petgest')).then(()=>c.end())"
```

Nas próximas vezes, basta o `pg_ctl ... start` (e `pg_ctl -D data stop` para
parar).

## 2. API

Na pasta `backend/`:

```powershell
dotnet tool restore
dotnet ef database update --project Api
```

**Chave da IA (para foto e voz).** É opcional: sem ela, o app funciona, mas o
bloco "Preencher com IA" não aparece. Crie uma chave em
platform.openai.com, defina um limite de gasto mensal na conta e grave a chave
**fora do repositório**:

```powershell
dotnet user-secrets set "Ai:OpenAI:ApiKey" "sk-..." --project Api
```

Descubra o IP do computador no Wi-Fi (`ipconfig`, linha "Endereço IPv4" do
adaptador Wi-Fi; ex.: `192.168.0.15`) e suba a API com os links dos e-mails
apontando para esse endereço:

```powershell
dotnet run --project Api -- --Auth:FrontendBaseUrl=https://192.168.0.15:5183
```

Deixe essa janela aberta: **os e-mails (confirmação, redefinição de senha)
aparecem nela** (`E-mail (envio de desenvolvimento, não enviado)…`), com o link.

## 3. Frontend

Em outro terminal, na pasta `frontend/` (o `.env.lan.local` já está pronto,
no modo `api`):

```powershell
npm install
npm run dev:lan
```

Se o Windows perguntar, permita o Node.js no firewall em **redes privadas**.

## 4. No celular

1. No mesmo Wi-Fi, abra `https://192.168.0.15:5183` (o seu IP).
2. Aceite o aviso de certificado uma vez (Chrome: *Avançado → Continuar*;
   Safari: *Mostrar detalhes → visitar este site*).
3. Siga o [`roteiro-v1.md`](roteiro-v1.md): bloco 1 (o roteiro da T-10 no modo
   `api`, que é a tarefa 4.4 da T-16), bloco 2 (e-mails) e, com a chave da IA,
   blocos 3 (foto) e 4 (voz). Anote no [`relatorio-v1.md`](relatorio-v1.md).

**Links de e-mail:** copie o link da janela da API e abra no celular. Um jeito
prático é mandar para você mesmo pelo WhatsApp Web. Também dá para abrir no
navegador do computador, no mesmo endereço.

## Limitações da rede local

- **iPhone:** o Safari pode recusar a câmera ou o microfone com o certificado
  local, mesmo depois de aceitar o aviso. Se acontecer, anote como pendente para
  o ambiente de teste publicado (T-17), como a T-16 já previa.
- **E-mail:** não é enviado de verdade (vai para a janela da API). O envio real
  só existe no ambiente publicado com o ACS (T-22, tarefa 3.1).
- **Rede do celular:** é o Wi-Fi, não 4G; as medições de tempo valem só como
  referência.

## Para parar

`Ctrl+C` nas janelas da API e do frontend; na opção B, também
`& "$B\pg_ctl.exe" -D data stop`.
