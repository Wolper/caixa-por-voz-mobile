# Teste piloto Android com EAS Build

Este documento descreve como gerar e distribuir uma versão Android de teste piloto do app **Caixa por Voz** usando EAS Build com distribuição interna.

A versão gerada por este fluxo é uma versão **MVP de validação** para usuários pilotos remotos. Ela serve para validar o uso real do aplicativo fora da rede local, sem depender do Expo Go em LAN ou de tunnel/ngrok.

## Escopo da versão piloto

- Build Android instalável em formato APK.
- Distribuição interna pelo link gerado pelo EAS Build.
- Mesmas telas, regras de negócio, autenticação e integração Supabase já existentes no app.
- Nenhuma alteração em banco de dados, políticas RLS ou credenciais versionadas.

## Variáveis de ambiente necessárias

O app continua usando as variáveis públicas do Expo já previstas no projeto:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Não coloque valores reais em arquivos versionados. Para builds locais ou no EAS, configure esses valores no ambiente seguro usado pela equipe.

Exemplo de configuração via EAS Secrets/Environment Variables, sem valores reais:

```bash
npx eas-cli@latest secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "SUA_URL_SUPABASE"
npx eas-cli@latest secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "SUA_CHAVE_ANONIMA_SUPABASE"
```

Se a equipe preferir usar outro método de variáveis do EAS, mantenha os mesmos nomes das variáveis e nunca registre os valores reais no Git.

## Como gerar o build Android de teste

Execute os comandos abaixo na raiz do projeto.

1. Autenticar no EAS:

```bash
npx eas-cli@latest login
```

2. Configurar o projeto para EAS, caso ainda não esteja configurado no ambiente da conta Expo/EAS:

```bash
npx eas-cli@latest build:configure
```

3. Gerar o APK Android com o perfil `preview`:

```bash
npx eas-cli@latest build -p android --profile preview
```

O perfil `preview` está configurado em `eas.json` para:

- usar distribuição interna;
- gerar APK instalável no Android.

## Como enviar o link para pilotos

Ao final do build, o EAS exibirá um link da página do build. Envie esse link aos usuários pilotos pelos canais combinados pela equipe, por exemplo e-mail, WhatsApp ou ferramenta interna.

Recomendações para o envio:

- informe que é uma versão piloto/MVP de validação;
- envie apenas para usuários autorizados;
- não publique o link em canais abertos;
- inclua instruções básicas de instalação e contato para suporte.

## Como instalar no Android

1. Abrir o link do build recebido no celular Android.
2. Baixar o arquivo APK.
3. Confirmar a instalação quando o Android solicitar permissão.
4. Se o aparelho bloquear a instalação, permitir instalação de apps de fonte desconhecida apenas para o navegador ou aplicativo usado para baixar o APK.
5. Abrir o app **Caixa por Voz** após a instalação.

A mensagem exata pode variar conforme fabricante, versão do Android e aplicativo usado para baixar o arquivo.

## Limitações do teste

- Esta é uma versão MVP de validação, não uma versão final de produção.
- O APK é destinado apenas a usuários pilotos autorizados.
- O app usa as mesmas regras de autenticação e acesso já existentes no projeto.
- A experiência pode variar conforme modelo do aparelho, versão do Android, conectividade e permissões locais.
- Atualizações futuras exigirão novo build e novo envio de link/arquivo aos pilotos.
- Não use esta versão para divulgar publicamente o aplicativo.

## Observações de segurança

- Não commitar `.env` nem arquivos com credenciais reais.
- Não incluir `SUPABASE_SERVICE_ROLE_KEY` no app mobile.
- Manter apenas `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` como variáveis públicas necessárias para o app.
- Configurar valores reais somente em ambiente seguro da equipe ou no EAS.
