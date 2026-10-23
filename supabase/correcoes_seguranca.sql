-- Correções de segurança. Pode rodar quantas vezes quiser (SQL Editor do Supabase).

-- 1) Anti-spam: limite por dispositivo (celular 3 / tablet 40 em 10 min) e teto por setor
create table if not exists tentativas(id bigserial primary key, dispositivo text, setor_id int, em timestamptz not null default now());
create index if not exists tentativas_idx on tentativas(dispositivo, em);
create index if not exists tentativas_setor_idx on tentativas(setor_id, em);
alter table tentativas enable row level security;
revoke all on tentativas from anon, authenticated;

drop function if exists registrar_resposta(text,int,text);
create or replace function registrar_resposta(p_setor text, p_nota int, p_origem text default 'qr', p_dispositivo text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_setor int; v_id uuid;
  v_org text := case when p_origem='tablet' then 'tablet' else 'qr' end;
  v_disp text := left(coalesce(nullif(trim(p_dispositivo),''),'?'),64);
  v_lim int;
begin
  v_lim := case when p_origem='tablet' then 40 else 3 end;
  v_setor := (select id from setores where slug=p_setor and ativo);
  if v_setor is null then raise exception 'setor inválido'; end if;
  if p_nota is null or p_nota not between 1 and 5 then raise exception 'nota inválida'; end if;
  if (select count(*) from tentativas where dispositivo=v_disp and em > now()-interval '10 minutes') >= v_lim
    then raise exception 'muitas respostas em pouco tempo, tente novamente em alguns minutos'; end if;
  if (select count(*) from tentativas where setor_id=v_setor and em > now()-interval '10 minutes') >= 300
    then raise exception 'sistema ocupado, tente novamente em instantes'; end if;
  insert into tentativas(dispositivo,setor_id) values (v_disp,v_setor);
  if random() < 0.02 then delete from tentativas where em < now()-interval '1 day'; end if;
  v_id := gen_random_uuid();
  insert into respostas(id,setor_id,turno,nota,nps,origem)
  values (v_id, v_setor, turno_de(now()), p_nota, (array[0,3,6,8,10])[p_nota], v_org);
  return v_id;
end $$;

-- 2) Comentário: remove e-mail/CPF/telefone digitados por engano e valida a jornada (só notas 1-5, tamanho limitado)
create or replace function limpar_pii(t text) returns text language sql immutable as $$
  select regexp_replace(regexp_replace(regexp_replace(t,
    '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}','[e-mail removido]','g'),
    '\d{3}\.?\d{3}\.?\d{3}-?\d{2}','[CPF removido]','g'),
    '(\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}','[telefone removido]','g') $$;

create or replace function complementar_resposta(p_id uuid, p_jornada jsonb default null, p_tipo text default null, p_comentario text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  if p_jornada is not null and (jsonb_typeof(p_jornada)<>'object' or octet_length(p_jornada::text)>2000
     or exists (select 1 from jsonb_each(p_jornada) j where jsonb_typeof(j.value)<>'number' or (j.value::text)::numeric not between 1 and 5))
  then raise exception 'jornada inválida'; end if;
  update respostas set jornada = jornada || coalesce(p_jornada,'{}'::jsonb),
         tipo = coalesce(p_tipo, tipo),
         comentario = coalesce(nullif(limpar_pii(left(trim(p_comentario),1000)),''), comentario)
   where id=p_id and criado_em > now() - interval '2 hours';
  if not found then raise exception 'resposta não encontrada ou expirada'; end if;
end $$;

-- 3) purgar_telefones: só Super Admin ou cron/SQL Editor
create or replace function purgar_telefones(p_dias int default 90) returns int
language plpgsql security definer set search_path=public as $$
declare n int;
begin
  if auth.uid() is not null and perfil_atual() is distinct from 'super_admin' then raise exception 'acesso negado' using errcode='42501'; end if;
  update contatos set telefone=null, observacao=null where fechado_em < now() - make_interval(days=>p_dias) and telefone is not null;
  get diagnostics n = row_count; return n;
end $$;

-- 4) Admin de setor só mexe no PRÓPRIO setor (perguntas e escala)
drop policy if exists perg_ler on perguntas;
create policy perg_ler on perguntas for select using (ativa or perfil_atual()='super_admin' or (perfil_atual()='admin_setor' and setor_id=setor_do_usuario()));
drop policy if exists perg_esc on perguntas;
create policy perg_esc on perguntas for all
  using (perfil_atual()='super_admin' or (perfil_atual()='admin_setor' and setor_id=setor_do_usuario()))
  with check (perfil_atual()='super_admin' or (perfil_atual()='admin_setor' and setor_id=setor_do_usuario()));
drop policy if exists escala_esc on escala;
create policy escala_esc on escala for all
  using (perfil_atual()='super_admin' or (perfil_atual()='admin_setor' and setor_id=setor_do_usuario()))
  with check (perfil_atual()='super_admin' or (perfil_atual()='admin_setor' and setor_id=setor_do_usuario()));

-- 5) Permissões de função: nada liberado por padrão; só a lista abaixo
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function perfil_atual(), setor_do_usuario(), turno_de(timestamptz) to anon, authenticated;  -- usadas nas policies
grant execute on function registrar_resposta(text,int,text,text), complementar_resposta(uuid,jsonb,text,text),
  registrar_contato(uuid,text,text,boolean), tv_resumo() to anon, authenticated;
grant execute on function painel_resumo(text,text,int), listar_manifestacoes(text), atualizar_manifestacao(uuid,boolean,text,boolean),
  marcar_publicavel(uuid,boolean), exportar_respostas(text), definir_perfil(text,text,perfil,text) to authenticated;
