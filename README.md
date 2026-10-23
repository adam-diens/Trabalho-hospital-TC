# Trabalho-hospital-TC

Projeto do curso técnico em informática integrado ao ensino médio da Escola Técnica Estadual Monteiro Lobato, com finalidade unicamente acadêmica, desenvolvido por Theo Keller Paiva, Adam Romão Dientsmann e Ygor Marcadenti Squena, conforme as requisições da Fundação Hospitalar Dr. Oswaldo Diesel.

Aplicação para coletar a satisfação dos pacientes do hospital. Contato: theokpaiva@gmail.com

## Como rodar
1. `npm install`
2. Copie `.env.example` para `.env` e preencha a URL e a chave **anon public** (Supabase > Project Settings > API).
3. No SQL Editor do Supabase rode, nesta ordem: `supabase/schema.sql` → `supabase/correcoes_seguranca.sql` → `supabase/testes.sql` (tudo deve dar `true`).
4. `npm run dev` para desenvolver; `npm run build` gera a pasta `dist/` (site estático, pode ser servida por qualquer servidor interno).

## Segurança (leia)
- A chave **anon** fica visível no navegador por natureza; quem protege os dados é o RLS e as funções do banco. O `.env` só evita versionar a chave.
- **Nunca** coloque no front-end: senha do banco, connection string (`postgresql://...`) ou `service_role`.
- Se a senha do banco já apareceu em algum commit, troque-a em Project Settings > Database.
