-- 03 - API (funcoes chamadas pelo front) e permissoes
-- Rode no SQL Editor do Supabase, na ordem 01 > 02 > 03 > 04.

-- ========== API PÚBLICA (paciente) ==========
create or replace function registrar_resposta(p_setor text, p_nota int, p_origem text default 'qr')
returns uuid language plpgsql security definer set search_path=public as $$
declare v_setor int; v_id uuid;
begin
  select id into v_setor from setores where slug=p_setor and ativo;
  if v_setor is null then raise exception 'setor inválido'; end if;
  if p_nota not between 1 and 5 then raise exception 'nota inválida'; end if;
  insert into respostas(setor_id, turno, nota, nps, origem)
  values (v_setor, turno_de(now()), p_nota, (array[0,3,6,8,10])[p_nota], left(coalesce(p_origem,'qr'),20))
  returning id into v_id;
  return v_id;
end $$;

create or replace function complementar_resposta(p_id uuid, p_jornada jsonb default null, p_tipo text default null, p_comentario text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  update respostas set jornada = jornada || coalesce(p_jornada,'{}'::jsonb),
         tipo = coalesce(p_tipo, tipo), comentario = coalesce(nullif(left(trim(p_comentario),1000),''), comentario)
   where id=p_id and criado_em > now() - interval '2 hours';
  if not found then raise exception 'resposta não encontrada ou expirada'; end if;
end $$;

create or replace function registrar_contato(p_id uuid, p_telefone text, p_obs text, p_aceite boolean)
returns text language plpgsql security definer set search_path=public as $$
declare v_tel text := regexp_replace(coalesce(p_telefone,''),'\D','','g'); v_prot text;
begin
  if not coalesce(p_aceite,false) then raise exception 'é necessário aceitar o aviso de LGPD'; end if;
  if length(v_tel) not between 10 and 11 then raise exception 'telefone inválido'; end if;
  if not exists (select 1 from respostas where id=p_id and criado_em > now() - interval '2 hours') then
    raise exception 'resposta não encontrada ou expirada'; end if;
  insert into contatos(resposta_id, protocolo, telefone, observacao, aceite_lgpd)
  values (p_id, 'OUV-'||lpad(nextval('protocolo_seq')::text,4,'0'), v_tel, left(p_obs,500), true)
  on conflict (resposta_id) do update set telefone=excluded.telefone, observacao=excluded.observacao
  returning protocolo into v_prot;
  return v_prot;
end $$;

create or replace function tv_resumo() returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'n', count(*), 'media', round(avg(nota),2),
    'sat', round(100.0*count(*) filter (where nota>=4)/nullif(count(*),0)),
    'hoje', count(*) filter (where (criado_em at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date),
    'elogios', coalesce((select jsonb_agg(c) from (select comentario c from respostas where publicavel and tipo='elogio' and comentario is not null order by criado_em desc limit 3) t),'[]'))
  from respostas where criado_em >= now() - interval '30 days' $$;

-- ========== API DA GESTÃO (exige login) ==========
create or replace function painel_resumo(p_setor text default null, p_turno text default null, p_dias int default 30)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_perfil perfil := perfil_atual(); v_sid int; r jsonb;
begin
  if v_perfil is null then raise exception 'acesso negado' using errcode='42501'; end if;
  if p_setor is not null then select id into v_sid from setores where slug=p_setor; end if;
  if v_perfil='admin_setor' then v_sid := setor_do_usuario(); end if;
  with f as (
    select r.*, s.slug, s.nome as setor_nome from respostas r join setores s on s.id=r.setor_id
    where r.criado_em >= now() - make_interval(days=>p_dias)
      and (v_sid is null or r.setor_id=v_sid) and (p_turno is null or r.turno=p_turno))
  select jsonb_build_object(
    'kpis', (select jsonb_build_object('n',count(*),'media',round(avg(nota),2),
        'sat',round(100.0*count(*) filter (where nota>=4)/nullif(count(*),0)),
        'nps',round(100.0*(count(*) filter (where nps=10) - count(*) filter (where nps<=6))/nullif(count(*),0))) from f),
    'por_setor', coalesce((select jsonb_agg(x) from (select slug, setor_nome nome, count(*) n, round(avg(nota),2) media from f group by 1,2 order by 2) x),'[]'),
    'por_turno', coalesce((select jsonb_agg(x) from (select turno, count(*) n, round(avg(nota),2) media from f group by 1 order by 1) x),'[]'),
    -- equipe só aparece agregada e com no mínimo 5 respostas (evita culpar uma pessoa)
    'por_equipe', coalesce((select jsonb_agg(x) from (select e.equipe, count(*) n, round(avg(f.nota),2) media from f
        join escala e on e.setor_id=f.setor_id and e.turno=f.turno and e.data=(f.criado_em at time zone 'America/Sao_Paulo')::date
        group by 1 having count(*)>=5 order by 3 desc) x),'[]'),
    'elogios', coalesce((select jsonb_agg(x) from (select id, comentario, publicavel from f where tipo='elogio' and comentario is not null order by criado_em desc limit 10) x),'[]')
  ) into r;
  return r;
end $$;

create or replace function listar_manifestacoes(p_setor text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_perfil perfil := perfil_atual(); v_sid int; v_tel boolean; r jsonb;
begin
  if v_perfil is null or v_perfil='visualizador' then raise exception 'acesso negado' using errcode='42501'; end if;
  v_tel := v_perfil in ('super_admin','ouvidoria');          -- só a Ouvidoria vê telefone
  if p_setor is not null then select id into v_sid from setores where slug=p_setor; end if;
  if v_perfil='admin_setor' then v_sid := setor_do_usuario(); end if;
  if v_tel then insert into auditoria(user_id,acao,alvo) values (auth.uid(),'ver_telefones',coalesce(p_setor,'todos')); end if;
  select coalesce(jsonb_agg(x order by x.criado_em desc),'[]') into r from (
    select r.id, c.protocolo, s.nome setor, r.criado_em, r.turno, r.nota, r.tipo, r.comentario,
           case when v_tel then c.telefone end telefone, case when v_tel then c.observacao end observacao,
           coalesce(c.contatado,false) contatado, c.relato, c.fechado_em is not null fechado
    from respostas r join setores s on s.id=r.setor_id left join contatos c on c.resposta_id=r.id
    where (c.resposta_id is not null or (r.tipo='reclamacao' and r.comentario is not null))
      and (v_sid is null or r.setor_id=v_sid)) x;
  return r;
end $$;

create or replace function atualizar_manifestacao(p_id uuid, p_contatado boolean default null, p_relato text default null, p_fechar boolean default false)
returns void language plpgsql security definer set search_path=public as $$
begin
  if perfil_atual() not in ('super_admin','ouvidoria') then raise exception 'acesso negado' using errcode='42501'; end if;
  if p_fechar and coalesce(trim(p_relato),'')='' then raise exception 'informe o relato'; end if;
  update contatos set
    contatado = coalesce(p_contatado, contatado),
    contatado_em = case when p_contatado then now() else contatado_em end,
    contatado_por = case when p_contatado then auth.uid() else contatado_por end,
    relato = coalesce(nullif(trim(p_relato),''), relato),
    fechado_em = case when p_fechar then now() else fechado_em end,
    fechado_por = case when p_fechar then auth.uid() else fechado_por end
  where resposta_id=p_id;
  if not found then raise exception 'manifestação sem protocolo'; end if;
  insert into auditoria(user_id,acao,alvo) values (auth.uid(),'atualizar_manifestacao',p_id::text);
end $$;

create or replace function marcar_publicavel(p_id uuid, p_valor boolean) returns void
language plpgsql security definer set search_path=public as $$
begin
  if perfil_atual() not in ('super_admin','ouvidoria','gestao') then raise exception 'acesso negado' using errcode='42501'; end if;
  update respostas set publicavel=p_valor where id=p_id and tipo='elogio';
end $$;

create or replace function exportar_respostas(p_setor text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_perfil perfil := perfil_atual(); v_sid int; r jsonb;
begin
  if v_perfil is null or v_perfil='visualizador' then raise exception 'acesso negado' using errcode='42501'; end if;
  if p_setor is not null then select id into v_sid from setores where slug=p_setor; end if;
  if v_perfil='admin_setor' then v_sid := setor_do_usuario(); end if;
  select coalesce(jsonb_agg(x order by x.data_hora),'[]') into r from (
    select c.protocolo, s.nome setor, r.criado_em data_hora, r.turno, r.nota, r.nps, r.tipo, r.comentario, r.jornada
    from respostas r join setores s on s.id=r.setor_id left join contatos c on c.resposta_id=r.id
    where v_sid is null or r.setor_id=v_sid) x;
  return r;
end $$;

-- Super Admin define o perfil de um usuário já criado em Authentication > Users
create or replace function definir_perfil(p_email text, p_nome text, p_perfil perfil, p_setor text default null) returns void
language plpgsql security definer set search_path=public as $$
declare v_uid uuid; v_sid int;
begin
  if perfil_atual() <> 'super_admin' then raise exception 'acesso negado' using errcode='42501'; end if;
  select id into v_uid from auth.users where lower(email)=lower(p_email);
  if v_uid is null then raise exception 'usuário não existe em Authentication'; end if;
  if p_setor is not null then select id into v_sid from setores where slug=p_setor; end if;
  insert into perfis(user_id,nome,perfil,setor_id) values (v_uid,p_nome,p_perfil,v_sid)
  on conflict (user_id) do update set nome=excluded.nome, perfil=excluded.perfil, setor_id=excluded.setor_id;
end $$;

-- LGPD: apaga telefone e observação de chamados fechados há mais de N dias (agende com pg_cron)
create or replace function purgar_telefones(p_dias int default 90) returns int
language plpgsql security definer set search_path=public as $$
declare n int;
begin
  update contatos set telefone=null, observacao=null where fechado_em < now() - make_interval(days=>p_dias) and telefone is not null;
  get diagnostics n = row_count; return n;
end $$;

-- ========== PERMISSÕES DAS FUNÇÕES ==========
revoke all on function registrar_resposta, complementar_resposta, registrar_contato, tv_resumo, painel_resumo, listar_manifestacoes,
  atualizar_manifestacao, marcar_publicavel, exportar_respostas, definir_perfil, purgar_telefones from public;
grant execute on function registrar_resposta(text,int,text), complementar_resposta(uuid,jsonb,text,text), registrar_contato(uuid,text,text,boolean), tv_resumo() to anon, authenticated;
grant execute on function painel_resumo(text,text,int), listar_manifestacoes(text), atualizar_manifestacao(uuid,boolean,text,boolean),
  marcar_publicavel(uuid,boolean), exportar_respostas(text), definir_perfil(text,text,perfil,text) to authenticated;
-- purgar_telefones: só roda pelo cron / SQL Editor (não é exposta à API)
