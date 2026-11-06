begin;
-- Helpers internos: nunca concedidos a clientes.
create function hospital.exigir_acesso(p_papeis hospital.papel[], p_setor uuid default null)
returns hospital.perfis language plpgsql security definer set search_path='' as $$
declare p hospital.perfis;
begin
  select * into p from hospital.perfis where user_id=auth.uid() and ativo;
  if p.user_id is null or not (p.papel=any(p_papeis)) then
    raise exception 'Acesso negado' using errcode='42501';
  end if;
  if p.papel='admin_setor' and (p.setor_id is null or
      not exists(select 1 from hospital.setores where id=p.setor_id and ativo) or
      (p_setor is not null and p_setor is distinct from p.setor_id)) then
    raise exception 'Setor não autorizado' using errcode='42501';
  end if;
  return p;
end $$;
create function hospital.auditar(p_acao text,p_entidade text,p_alvo text,p_detalhes jsonb default '{}')
returns void language sql security definer set search_path='' as $$
  insert into hospital.auditoria(ator_id,acao,entidade,alvo,detalhes)
  values(auth.uid(),p_acao,p_entidade,p_alvo,p_detalhes);
$$;
create function hospital.consumir_limite(p_chave text,p_limite int) returns void
language plpgsql set search_path='' as $$
declare n int; w timestamptz := date_bin(interval '10 minutes',statement_timestamp(),timestamptz '2000-01-01 UTC');
begin
  insert into hospital.limites_coleta(chave,janela,quantidade) values(p_chave,w,1)
  on conflict(chave,janela) do update set quantidade=hospital.limites_coleta.quantidade+1
  returning quantidade into n;
  if n>p_limite then raise exception 'Limite temporário de coleta atingido' using errcode='P0001'; end if;
end $$;

create function public.ep_meu_perfil() returns jsonb language plpgsql security definer set search_path='' as $$
declare p hospital.perfis;
begin
  p:=hospital.exigir_acesso(array['super_admin','admin_setor','gestao','ouvidoria','visualizador']::hospital.papel[]);
  return jsonb_build_object('user_id',p.user_id,'nome',p.nome,'papel',p.papel,'setor_id',p.setor_id);
end $$;
create function public.ep_setores() returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'slug',slug,'nome',nome) order by nome),'[]')
  from hospital.setores where ativo;
$$;
create function public.ep_formulario(p_setor text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare q hospital.questionarios; c hospital.configuracao;
begin
  select * into c from hospital.configuracao where id;
  if not coalesce(c.coleta_habilitada,false) then raise exception 'Coleta indisponível' using errcode='55000'; end if;
  select q1.* into q from hospital.questionarios q1 join hospital.setores s on s.id=q1.setor_id
    where s.slug=p_setor and s.ativo and q1.publicado;
  if q.id is null then raise exception 'Setor sem pesquisa disponível' using errcode='22023'; end if;
  return jsonb_build_object('questionario_id',q.id,'versao',q.versao,'metrica',q.metrica,
    'limite_ouvidoria',q.limite_ouvidoria,'privacidade_versao',c.privacidade_versao,
    'privacidade_texto',c.privacidade_texto,
    'perguntas',(select jsonb_agg(jsonb_build_object('id',id,'chave',chave,'texto',texto,'metrica',metrica,
       'obrigatoria',geral,'ordem',ordem) order by ordem) from hospital.perguntas where questionario_id=q.id));
end $$;

-- Coleta atômica EXCLUSIVA do backend (service_role). Não aceitar hash de origem do navegador.
-- p_chave_envio identifica uma tentativa lógica; retries idênticos não duplicam dados.
create function public.ep_enviar_pesquisa(
  p_chave_envio uuid,p_questionario uuid,p_nota int,p_canal text,p_origem_hash text,
  p_privacidade_versao text,p_etapas jsonb default '{}',p_tipo text default null,
  p_comentario text default null,p_telefone text default null,p_consentimento boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare q hospital.questionarios; c hospital.configuracao; r hospital.respostas; m hospital.manifestacoes;
  etapa record; pergunta hospital.perguntas; payload_hash text; tel text; rid uuid; mid uuid; tipo hospital.tipo_manifestacao;
begin
  if p_chave_envio is null or p_questionario is null or p_nota is null or p_canal is null
     or p_canal not in ('celular','tablet') or p_origem_hash is null or p_origem_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Envio inválido' using errcode='22023';
  end if;
  payload_hash:=encode(sha256(convert_to(jsonb_build_array(p_questionario,p_nota,p_canal,p_privacidade_versao,
    p_etapas,p_tipo,p_comentario,p_telefone,p_consentimento)::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended(p_chave_envio::text,0));
  select * into r from hospital.respostas where chave_envio=p_chave_envio;
  if r.id is not null then
    if r.conteudo_hash<>payload_hash then raise exception 'Chave de envio reutilizada com conteúdo diferente' using errcode='22023'; end if;
    select * into m from hospital.manifestacoes where resposta_id=r.id;
    return jsonb_build_object('recebida',true,'protocolo',m.protocolo);
  end if;
  select * into c from hospital.configuracao where id for share;
  if not coalesce(c.coleta_habilitada,false) then raise exception 'Coleta indisponível' using errcode='55000'; end if;
  if p_privacidade_versao is distinct from c.privacidade_versao then
    raise exception 'Aviso de privacidade desatualizado; recarregue a pesquisa' using errcode='22023';
  end if;
  -- Mesma ordem de locks da publicação: setor antes do questionário.
  select * into q from hospital.questionarios where id=p_questionario;
  if q.id is null then raise exception 'Questionário inexistente' using errcode='22023'; end if;
  perform 1 from hospital.setores where id=q.setor_id and ativo for share;
  if not found then raise exception 'Setor inativo' using errcode='22023'; end if;
  select * into q from hospital.questionarios where id=p_questionario and publicado for share;
  if q.id is null then raise exception 'Questionário não publicado; recarregue a pesquisa' using errcode='22023'; end if;
  if not exists(select 1 from hospital.perguntas where questionario_id=q.id and geral and metrica=q.metrica) then
    raise exception 'Questionário inconsistente' using errcode='23514';
  end if;
  if p_nota<1 or p_nota>(case when q.metrica='rostos_5' then 5 else 10 end) then
    raise exception 'Nota geral fora da escala' using errcode='22023';
  end if;
  if p_etapas is null or jsonb_typeof(p_etapas)<>'object' or octet_length(p_etapas::text)>8000 then
    raise exception 'Etapas inválidas' using errcode='22023';
  end if;
  if p_tipo is not null and p_tipo not in ('elogio','reclamacao','sugestao') then
    raise exception 'Tipo de manifestação inválido' using errcode='22023';
  end if;
  if (p_tipo is null) <> (nullif(trim(p_comentario),'') is null) or length(p_comentario)>2000 then
    raise exception 'Informe tipo e comentário juntos (máximo 2000 caracteres)' using errcode='22023';
  end if;
  tel:=nullif(regexp_replace(coalesce(p_telefone,''),'[^0-9]','','g'),'');
  if p_telefone is not null and nullif(trim(p_telefone),'') is not null and tel is null then
    raise exception 'Telefone inválido' using errcode='22023';
  end if;
  if tel is not null and (tel !~ '^[1-9][0-9]{9,10}$' or not coalesce(p_consentimento,false)) then
    raise exception 'Contato exige telefone válido e consentimento explícito' using errcode='22023';
  end if;
  if coalesce(p_consentimento,false) and tel is null then
    raise exception 'Consentimento de contato sem telefone' using errcode='22023';
  end if;
  tipo:=case when p_tipo is not null then p_tipo::hospital.tipo_manifestacao
             when tel is not null then 'retorno'::hospital.tipo_manifestacao end;
  perform hospital.consumir_limite('origem:'||p_origem_hash,c.limite_origem_10min);
  perform hospital.consumir_limite('setor:'||q.setor_id::text,c.limite_setor_10min);
  insert into hospital.respostas(chave_envio,conteudo_hash,setor_id,questionario_id,metrica,nota,canal,privacidade_versao,data_local,turno)
    values(p_chave_envio,payload_hash,q.setor_id,q.id,q.metrica,p_nota,p_canal,p_privacidade_versao,current_date,'manha') returning id into rid;
  for etapa in select key,value from jsonb_each(p_etapas) loop
    select * into pergunta from hospital.perguntas where questionario_id=q.id and chave=etapa.key and not geral;
    if pergunta.id is null or jsonb_typeof(etapa.value)<>'number' then
      raise exception 'Etapa desconhecida ou nota inválida' using errcode='22023';
    end if;
    if etapa.value::text::numeric<>trunc(etapa.value::text::numeric) or etapa.value::text::numeric<1 or
       etapa.value::text::numeric>(case when pergunta.metrica='rostos_5' then 5 else 10 end) then
      raise exception 'Nota da etapa fora da escala' using errcode='22023';
    end if;
    insert into hospital.avaliacoes_etapas(resposta_id,questionario_id,pergunta_id,metrica,nota)
      values(rid,q.id,pergunta.id,pergunta.metrica,etapa.value::text::smallint);
  end loop;
  if tipo is not null then
    insert into hospital.manifestacoes(resposta_id,tipo,comentario) values(rid,tipo,nullif(trim(p_comentario),''))
      returning * into m;
    mid:=m.id;
    if tel is not null then
      insert into hospital.contatos(manifestacao_id,telefone,consentimento,consentimento_versao)
      values(mid,tel,true,c.privacidade_versao);
    end if;
  end if;
  return jsonb_build_object('recebida',true,'protocolo',m.protocolo);
end $$;

create function public.ep_salvar_setor(p_slug text,p_nome text,p_ativo boolean default true) returns uuid
language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
  perform hospital.exigir_acesso(array['super_admin']::hospital.papel[]);
  insert into hospital.setores(slug,nome,ativo) values(p_slug,trim(p_nome),p_ativo)
  on conflict(slug) do update set nome=excluded.nome,ativo=excluded.ativo returning id into sid;
  perform hospital.auditar('salvar_setor','setores',sid::text,jsonb_build_object('ativo',p_ativo));
  return sid;
end $$;

create function public.ep_publicar_questionario(p_setor uuid,p_metrica text,p_limite int,p_pergunta_geral text,p_etapas jsonb default '[]')
returns uuid language plpgsql security definer set search_path='' as $$
declare qid uuid; v int; e jsonb; i int:=0;
begin
  perform hospital.exigir_acesso(array['super_admin','admin_setor']::hospital.papel[],p_setor);
  if p_setor is null then raise exception 'Setor obrigatório' using errcode='22023'; end if;
  perform 1 from hospital.setores where id=p_setor and ativo for update;
  if not found then raise exception 'Setor inválido ou inativo' using errcode='22023'; end if;
  if p_etapas is null or jsonb_typeof(p_etapas)<>'array' or jsonb_array_length(p_etapas)>20 then
    raise exception 'Informe até 20 etapas opcionais' using errcode='22023'; end if;
  select coalesce(max(versao),0)+1 into v from hospital.questionarios where setor_id=p_setor;
  update hospital.questionarios set publicado=false where setor_id=p_setor and publicado;
  insert into hospital.questionarios(setor_id,versao,metrica,limite_ouvidoria,criado_por)
    values(p_setor,v,p_metrica::hospital.metrica,p_limite,auth.uid()) returning id into qid;
  insert into hospital.perguntas(questionario_id,chave,texto,metrica,geral,ordem)
    values(qid,'geral',trim(p_pergunta_geral),p_metrica::hospital.metrica,true,0);
  for e in select value from jsonb_array_elements(p_etapas) loop
    if jsonb_typeof(e)<>'object' or e->>'chave' is null or e->>'texto' is null or e->>'metrica' is null then
      raise exception 'Etapa exige chave, texto e métrica' using errcode='22023'; end if;
    i:=i+1;
    insert into hospital.perguntas(questionario_id,chave,texto,metrica,ordem)
      values(qid,e->>'chave',trim(e->>'texto'),(e->>'metrica')::hospital.metrica,i);
  end loop;
  update hospital.questionarios set publicado=true where id=qid;
  perform hospital.auditar('publicar_questionario','questionarios',qid::text,jsonb_build_object('versao',v,'setor_id',p_setor));
  return qid;
end $$;

create function public.ep_definir_perfil(p_usuario uuid,p_nome text,p_papel text,p_setor uuid default null,p_ativo boolean default true)
returns void language plpgsql security definer set search_path='' as $$
declare anterior hospital.perfis;
begin
  -- Serializa concessões/revogações para proteger o último superadministrador.
  perform pg_advisory_xact_lock(716025001);
  perform hospital.exigir_acesso(array['super_admin']::hospital.papel[]);
  if p_usuario=auth.uid() then raise exception 'Não altere o próprio acesso' using errcode='42501'; end if;
  if p_setor is not null and not exists(select 1 from hospital.setores where id=p_setor and ativo) then
    raise exception 'Setor inválido ou inativo' using errcode='22023'; end if;
  select * into anterior from hospital.perfis where user_id=p_usuario for update;
  if anterior.papel='super_admin' and anterior.ativo and (p_papel is distinct from 'super_admin' or p_ativo is distinct from true)
     and (select count(*) from hospital.perfis where papel='super_admin' and ativo)<=1 then
    raise exception 'Não é permitido remover o último superadministrador' using errcode='23514'; end if;
  insert into hospital.perfis(user_id,nome,papel,setor_id,ativo) values(p_usuario,trim(p_nome),p_papel::hospital.papel,p_setor,p_ativo)
  on conflict(user_id) do update set nome=excluded.nome,papel=excluded.papel,setor_id=excluded.setor_id,
    ativo=excluded.ativo,atualizado_em=now();
  perform hospital.auditar('definir_perfil','perfis',p_usuario::text,
    jsonb_build_object('anterior',anterior.papel,'novo',p_papel,'setor_id',p_setor,'ativo',p_ativo));
end $$;
create function public.ep_listar_perfis(p_limite int default 50,p_depois uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform hospital.exigir_acesso(array['super_admin']::hospital.papel[]);
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'Limite inválido' using errcode='22023'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.user_id),'[]') from
    (select user_id,nome,papel,setor_id,ativo from hospital.perfis where p_depois is null or user_id>p_depois order by user_id limit p_limite) x);
end $$;
create function public.ep_salvar_equipe(p_setor uuid,p_nome text,p_ativa boolean default true) returns uuid
language plpgsql security definer set search_path='' as $$
declare eid uuid;
begin
  perform hospital.exigir_acesso(array['super_admin','admin_setor']::hospital.papel[],p_setor);
  if p_setor is null or not exists(select 1 from hospital.setores where id=p_setor and ativo) then
    raise exception 'Setor inválido ou inativo' using errcode='22023'; end if;
  insert into hospital.equipes(setor_id,nome,ativa) values(p_setor,trim(p_nome),p_ativa)
    on conflict(setor_id,nome) do update set ativa=excluded.ativa returning id into eid;
  perform hospital.auditar('salvar_equipe','equipes',eid::text,jsonb_build_object('ativa',p_ativa));
  return eid;
end $$;
create function public.ep_salvar_escala(p_setor uuid,p_equipe uuid,p_data date,p_turno text) returns uuid
language plpgsql security definer set search_path='' as $$
declare eid uuid;
begin
  perform hospital.exigir_acesso(array['super_admin','admin_setor']::hospital.papel[],p_setor);
  if p_setor is null or not exists(select 1 from hospital.equipes e join hospital.setores s on s.id=e.setor_id
      where e.id=p_equipe and e.setor_id=p_setor and e.ativa and s.ativo) then
    raise exception 'Equipe incompatível ou inativa' using errcode='22023'; end if;
  insert into hospital.escalas(setor_id,equipe_id,data,turno,atualizado_por)
    values(p_setor,p_equipe,p_data,p_turno::hospital.turno,auth.uid())
    on conflict(setor_id,data,turno) do update set equipe_id=excluded.equipe_id,atualizado_em=now(),atualizado_por=auth.uid()
    returning id into eid;
  perform hospital.auditar('salvar_escala','escalas',eid::text,jsonb_build_object('equipe_id',p_equipe,'data',p_data,'turno',p_turno));
  return eid;
end $$;
create function public.ep_listar_equipes(p_setor uuid default null,p_limite int default 100,p_depois uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p hospital.perfis; sid uuid:=p_setor;
begin
  p:=hospital.exigir_acesso(array['super_admin','admin_setor','gestao','ouvidoria']::hospital.papel[],p_setor);
  if p.papel='admin_setor' then sid:=p.setor_id; end if;
  if p_limite is null or p_limite not between 1 and 200 then raise exception 'Limite inválido' using errcode='22023'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') from
    (select id,setor_id,nome,ativa from hospital.equipes where (sid is null or setor_id=sid)
     and (p_depois is null or id>p_depois) order by id limit p_limite) x);
end $$;
create function public.ep_listar_escalas(p_inicio date,p_fim date,p_setor uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p hospital.perfis; sid uuid:=p_setor;
begin
  p:=hospital.exigir_acesso(array['super_admin','admin_setor','gestao','ouvidoria']::hospital.papel[],p_setor);
  if p.papel='admin_setor' then sid:=p.setor_id; end if;
  if p_inicio is null or p_fim is null or p_fim<p_inicio or p_fim-p_inicio>92 then
    raise exception 'Use um intervalo de até 93 dias' using errcode='22023'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.data,x.setor_id,x.turno),'[]') from
    (select e.id,e.setor_id,e.equipe_id,t.nome equipe,e.data,e.turno from hospital.escalas e join hospital.equipes t on t.id=e.equipe_id
     where e.data between p_inicio and p_fim and (sid is null or e.setor_id=sid)) x);
end $$;

create function public.ep_configurar_operacao(p_privacidade_versao text,p_privacidade_texto text,p_habilitada boolean,p_retencao_dias int default 90)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform hospital.exigir_acesso(array['super_admin']::hospital.papel[]);
  if p_habilitada and p_privacidade_versao='rascunho' then
    raise exception 'Publique o aviso institucional antes de habilitar a coleta' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(716025002);
  if exists(select 1 from hospital.avisos_privacidade where versao=p_privacidade_versao and texto<>trim(p_privacidade_texto)) then
    raise exception 'Uma versão de privacidade não pode mudar de conteúdo' using errcode='22023'; end if;
  insert into hospital.avisos_privacidade(versao,texto) values(p_privacidade_versao,trim(p_privacidade_texto)) on conflict do nothing;
  update hospital.configuracao set privacidade_versao=p_privacidade_versao,privacidade_texto=trim(p_privacidade_texto),
    coleta_habilitada=p_habilitada,retencao_contato_dias=p_retencao_dias where id;
  perform hospital.auditar('configurar_operacao','configuracao','true',
    jsonb_build_object('privacidade_versao',p_privacidade_versao,'habilitada',p_habilitada,'retencao_dias',p_retencao_dias));
end $$;

-- Grants por assinatura: nenhuma alteração global nos schemas gerenciados do Supabase.
revoke execute on all functions in schema hospital from public,anon,authenticated,service_role;
do $$ declare f record; begin
  for f in select p.oid::regprocedure assinatura from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public' and p.proname like 'ep\_%' escape '\' loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.assinatura);
  end loop;
end $$;
grant execute on function public.ep_setores(),public.ep_formulario(text) to anon,authenticated;
grant execute on function public.ep_enviar_pesquisa(uuid,uuid,int,text,text,text,jsonb,text,text,text,boolean) to service_role;
grant execute on function public.ep_meu_perfil(),public.ep_salvar_setor(text,text,boolean),
  public.ep_publicar_questionario(uuid,text,int,text,jsonb),public.ep_definir_perfil(uuid,text,text,uuid,boolean),
  public.ep_listar_perfis(int,uuid),public.ep_salvar_equipe(uuid,text,boolean),public.ep_salvar_escala(uuid,uuid,date,text),
  public.ep_listar_escalas(date,date,uuid),public.ep_listar_equipes(uuid,int,uuid),public.ep_configurar_operacao(text,text,boolean,int) to authenticated;
commit;
