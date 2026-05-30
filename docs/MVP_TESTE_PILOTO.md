# MVP teste piloto — Caixa por Voz Mobile

## Objetivo do teste piloto

Validar com usuários reais se o fluxo principal do app mobile ajuda pequenos empresários a registrar, consultar e revisar o caixa de forma simples. Esta é uma versão de validação do MVP: o foco é observar clareza, confiança e facilidade de uso, sem prometer automações finais de IA ou voz real.

## Roteiro sugerido de teste

1. Entrar no app com uma conta autorizada para o piloto.
2. Selecionar um item em **Meus controles** e abrir o **Dashboard/Início**.
3. Conferir o resumo do mês, contas pendentes e atalhos disponíveis.
4. Criar um lançamento manual com tipo, valor, data, categoria e status.
5. Registrar uma frase em **Texto**, revisar a prévia interpretada e salvar apenas após conferência.
6. Testar **Voz simulada** digitando uma transcrição, revisar os campos e salvar.
7. Abrir **Movimentações**, aplicar filtros, editar um lançamento, excluir um lançamento de teste e exportar CSV quando houver dados.
8. Abrir **Contas** e marcar uma conta pendente como paga ou recebida.
9. Preencher o **Checklist do MVP** com o usuário piloto e compartilhar o feedback.

## Funcionalidades incluídas

- Autenticação existente do app.
- Seleção de **Meus controles**.
- **Dashboard/Início** com resumo mensal e atalhos.
- **Novo lançamento** manual.
- **Texto** com interpretação local simples e revisão antes de salvar.
- **Voz simulada** com transcrição digitada, sem gravação de áudio.
- **Movimentações** com filtros, edição, exclusão e exportação CSV.
- **Contas** a pagar e a receber com vencimentos pendentes.
- **Checklist do MVP** para registrar observações do piloto.

## Limitações conhecidas

- Não há IA real neste MVP; a interpretação por texto é local, simples e deve ser revisada pelo usuário.
- Não há voz real; a tela de voz usa uma transcrição digitada para simular a experiência.
- A qualidade dos resumos depende dos lançamentos, datas, categorias e status informados.
- O fluxo não altera regras de banco, RLS ou autenticação existentes.
- Mensagens de erro para usuários são genéricas de propósito; detalhes técnicos ficam no console durante o desenvolvimento.
- O app segue compatível com Expo Go e não adiciona dependências nesta preparação.

## O que observar no uso com empresários

- Se o usuário entende que está em uma versão de teste piloto antes de registrar dados.
- Se os termos **Meus controles**, **Dashboard/Início**, **Movimentações** e **Contas** fazem sentido para a rotina do negócio.
- Se os botões principais indicam claramente a próxima ação.
- Se o usuário confia na prévia de texto/voz simulada depois de revisar valor, tipo, data e categoria.
- Se os estados vazios orientam bem o primeiro lançamento.
- Se mensagens de erro ou validação ajudam a continuar sem assustar.
- Se o empresário consegue explicar, ao final, como acompanharia receitas, despesas e contas pendentes usando o app.
