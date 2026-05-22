# Mobile 000 — Especificação inicial do app mobile Caixa por Voz

## 1. Visão geral do app mobile
O **Caixa por Voz Mobile** será a extensão oficial da plataforma já existente na web, com foco em uso rápido no dia a dia, principalmente para registrar e consultar movimentações financeiras em qualquer lugar.

A proposta do app é manter alinhamento com as regras e estruturas já consolidadas no backend (Supabase), priorizando uma experiência simples, confiável e evolutiva.

---

## 2. Objetivo da primeira versão mobile
Entregar uma primeira versão funcional e testável do app com foco em:
- autenticação;
- seleção de controle financeiro;
- visualização resumida de dados;
- criação manual de lançamentos;
- listagem de lançamentos recentes.

A primeira versão **não busca paridade completa** com a web, mas sim validar a base técnica e o fluxo principal de uso no celular.

---

## 3. Público-alvo

### Pessoa física
Usuários que querem controlar receitas e despesas pessoais de forma prática, com visão rápida do saldo e das movimentações.

### MEI/autônomo
Profissionais que precisam registrar entradas e saídas do negócio no dia a dia, mantendo organização mínima para tomada de decisão e rotina financeira.

### Pequeno empresário
Empreendedores que administram um ou mais controles (pessoais e empresariais) e precisam acompanhar o caixa com agilidade pelo celular.

---

## 4. Stack recomendada
- **Expo**: acelera setup, build e distribuição inicial.
- **React Native**: base multiplataforma (iOS e Android).
- **TypeScript**: tipagem e manutenção mais segura.
- **Supabase**: autenticação, banco e integração com a estrutura já existente.

---

## 5. Estratégia de repositório
Manter o app mobile em **repositório separado**:
- `caixa-por-voz-mobile`

Vantagens:
- ciclo de entrega independente da web;
- organização de código focada em mobile;
- menor risco de acoplamento indevido entre plataformas.

---

## 6. Integração com Supabase
A integração mobile deve reaproveitar a modelagem já em uso, sem mudanças estruturais:

- **Autenticação**: login, cadastro e confirmação de e-mail.
- **Controles pessoais/empresariais**: listagem e seleção do contexto ativo.
- **Categorias**: leitura para apoiar cadastro de lançamentos.
- **Lançamentos**: criação manual e listagem.

Diretriz: o app mobile deve consumir APIs/tabelas já existentes, preservando as mesmas regras de negócio válidas na web.

---

## 7. Cuidados com segurança
- **Não colocar `OPENAI_API_KEY` no app mobile**.
- **Não colocar `SUPABASE_SERVICE_ROLE_KEY` no app mobile**.
- Usar no cliente **apenas chaves públicas permitidas** (ex.: anon key do Supabase).
- Qualquer operação sensível que exija segredo deve ocorrer em backend seguro (server-side).

---

## 8. Escopo da primeira versão mobile
A primeira versão (MVP inicial) inclui:
- login;
- cadastro;
- confirmação de e-mail;
- lista de controles;
- seleção de controle atual;
- dashboard simples;
- novo lançamento manual;
- listagem de lançamentos.

---

## 9. Fora do escopo da primeira versão
Não será implementado nesta etapa:
- voz;
- modo escuta;
- relatórios completos;
- exclusão de conta;
- gráficos avançados;
- push notification.

---

## 10. Telas iniciais
Sugestão de telas para o ciclo inicial:
1. **Boas-vindas / acesso**
2. **Login**
3. **Cadastro**
4. **Confirmação de e-mail (orientação/status)**
5. **Seleção de controle**
6. **Dashboard simples**
7. **Novo lançamento manual**
8. **Lista de lançamentos**

Opcional técnico para UX:
- tela de loading inicial para checar sessão autenticada.

---

## 11. Fluxo principal
Fluxo principal esperado:
1. Usuário abre o app.
2. Se não autenticado, vai para login/cadastro.
3. Após autenticação, confirma e-mail (quando aplicável).
4. Usuário seleciona o controle ativo (pessoal ou empresarial).
5. App abre dashboard simples do controle selecionado.
6. Usuário registra novo lançamento manual.
7. Lançamento aparece na listagem e impacta resumo do dashboard.

---

## 12. Estrutura inicial de pastas sugerida
Estrutura sugerida para início com Expo + TypeScript:

```txt
caixa-por-voz-mobile/
  docs/
    mobile-spec.md
  src/
    app/
      (auth)/
        login.tsx
        cadastro.tsx
      (main)/
        dashboard.tsx
        lancamentos/
          index.tsx
          novo.tsx
        controles/
          selecionar.tsx
    components/
    services/
      supabase/
        client.ts
      api/
    hooks/
    types/
    utils/
  assets/
```

Observação: a estrutura pode variar conforme decisão de roteamento (ex.: Expo Router), mantendo os mesmos domínios funcionais.

---

## 13. Roadmap mobile

### Mobile 001: scaffold Expo
- Criar projeto base com Expo + TypeScript.
- Configurar estrutura de pastas, lint e formatação.

### Mobile 002: autenticação
- Implementar login, cadastro e fluxo de sessão.
- Tratar estado de confirmação de e-mail.

### Mobile 003: controles pessoais/empresariais
- Listar controles disponíveis para o usuário.
- Permitir seleção e persistência do controle atual.

### Mobile 004: lançamentos manuais
- Criar formulário de novo lançamento.
- Listar lançamentos por controle selecionado.

### Mobile 005: dashboard simples
- Exibir resumo básico (ex.: saldo, entradas, saídas).
- Atualizar dados ao criar lançamento.

### Mobile 006: voz no mobile
- Planejar e implementar entrada por voz.
- Definir arquitetura segura para processamento (sem expor segredos no app).

---

## 14. Critérios para considerar o app mobile testável
O app será considerado testável quando:
- instalar e abrir em emulador/dispositivo sem erros críticos;
- permitir cadastro e login com Supabase;
- permitir seleção de controle ativo;
- exibir dashboard simples com dados reais do usuário;
- permitir criar lançamento manual válido;
- atualizar listagem após criação do lançamento;
- manter sessão autenticada entre reaberturas do app;
- apresentar mensagens básicas de erro e estados de carregamento.

---

## Restrições desta etapa (Mobile 000)
- Não alterar o repositório web.
- Não alterar banco.
- Não alterar regras financeiras.
- Apenas criar documentação inicial.
