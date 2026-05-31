# RLS da tabela `companies` para criação de controles

Este repositório mobile não possui pasta `supabase/migrations` nem migrations SQL existentes. Por isso, o app não altera o banco diretamente e este arquivo registra o SQL mínimo sugerido caso o ambiente Supabase ainda não tenha políticas para criação/listagem dos controles do próprio usuário.

## Diagnóstico no app mobile

A tela **Meus controles** usa a tabela `companies` como origem dos controles financeiros.

Campos lidos atualmente:

- `id`
- `name`
- `cnpj`
- `profile_type`

Campos enviados no insert pelo app:

- `name`
- `profile_type`
- `cnpj`
- campo de vínculo com usuário autenticado, quando existir na tabela, detectado nesta ordem:
  - `user_id`
  - `owner_id`
  - `created_by`
  - `profile_id`

O app obtém o usuário autenticado via `supabase.auth.getSession()` antes de criar um controle e não tenta inserir sem sessão ativa.

## SQL sugerido se o campo de dono for `user_id`

> Ajuste o nome da coluna (`user_id`) apenas se o schema real usar outro campo de dono, como `owner_id`, `created_by` ou `profile_id`.

```sql
alter table public.companies enable row level security;

create policy "Users can select their own companies"
on public.companies
for select
to authenticated
using (user_id = auth.uid());

create policy "Users can insert their own companies"
on public.companies
for insert
to authenticated
with check (user_id = auth.uid());
```

## Observações de segurança

- Não use `anon` para criar/listar controles.
- Não crie políticas com `using (true)` ou `with check (true)` para esta tabela.
- Não desabilite RLS.
- Não remova políticas existentes sem revisar impactos no ambiente web/mobile.
- Se já existirem policies equivalentes, prefira ajustar apenas a policy ausente ou conflitante.
