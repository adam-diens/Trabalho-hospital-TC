-- 02 - Funcoes auxiliares e seguranca (RLS)
-- Rode no SQL Editor do Supabase, na ordem 01 > 02 > 03 > 04.

-- ========== FUNÇÕES AUXILIARES ==========
create or replace function turno_de(ts timestamptz) returns text language sql immutable as $$
  select case when extract(hour from ts at time zone 'America/Sao_Paulo') between 7 and 12 then 'Manhã'
              when extract(hour from ts at time zone 'America/Sao_Paulo') between 13 and 18 then 'Tarde'
              else 'Noite' end $$;

create or replace function perfil_atual() returns perfil language sql stable security definer set search_path=public as $$
  select perfil from perfis where user_id = auth.uid() $$;

create or replace function setor_do_usuario() returns int language sql stable security definer set search_path=public as $$
  select setor_id from perfis where user_id = auth.uid() $$;

-- ========== RLS (tabelas sensíveis ficam fechadas; acesso só pelas funções) ==========
alter table setores enable row level security;   alter table perfis enable row level security;
alter table perguntas enable row level security; alter table respostas enable row level security;
alter table contatos enable row level security;  alter table escala enable row level security;
alter table auditoria enable row level security;

drop policy if exists setores_ler on setores;   create policy setores_ler on setores for select using (true);
drop policy if exists setores_esc on setores;   create policy setores_esc on setores for all using (perfil_atual()='super_admin') with check (perfil_atual()='super_admin');
drop policy if exists perg_ler on perguntas;    create policy perg_ler on perguntas for select using (ativa or perfil_atual() in ('super_admin','admin_setor'));
drop policy if exists perg_esc on perguntas;    create policy perg_esc on perguntas for all using (perfil_atual() in ('super_admin','admin_setor')) with check (perfil_atual() in ('super_admin','admin_setor'));
drop policy if exists perfis_ler on perfis;     create policy perfis_ler on perfis for select using (user_id = auth.uid() or perfil_atual()='super_admin');
drop policy if exists escala_ler on escala;     create policy escala_ler on escala for select using (perfil_atual() is not null);
drop policy if exists escala_esc on escala;     create policy escala_esc on escala for all using (perfil_atual() in ('super_admin','admin_setor')) with check (perfil_atual() in ('super_admin','admin_setor'));
-- respostas, contatos e auditoria: sem policy = ninguém lê direto
revoke all on respostas, contatos, auditoria from anon, authenticated;
