begin;
create function public.ep_painel(p_inicio date,p_fim date,p_setor uuid default null,p_turno text default null,p_equipe uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p hospital.perfis; sid uuid:=p_setor; minimo int;
begin
  p:=hospital.exigir_acesso(array['super_admin','admin_setor','gestao','ouvidoria','visualizador']::hospital.papel[],p_setor);
  if p.papel='admin_setor' then sid:=p.setor_id; end if;
  if p_inicio is null or p_fim is null or p_fim<p_inicio or p_fim-p_inicio>365 then
    raise exception 'Use um intervalo de até 366 dias' using errcode='22023'; end if;
  if p_turno is not null and p_turno not in ('manha','tarde','noite') then raise exception 'Turno inválido' using errcode='22023'; end if;
  if p_equipe is not null and (p.papel='visualizador' or not exists(select 1 from hospital.equipes where id=p_equipe and (sid is null or setor_id=sid))) then
    raise exception 'Equipe não autorizada' using errcode='42501'; end if;
  select minimo_grupo into minimo from hospital.configuracao where id;
  return (
    with f as materialized (
      select r.*,s.nome setor,e.equipe_id,t.nome equipe,m.id manifestacao_id
      from hospital.respostas r join hospital.setores s on s.id=r.setor_id
      left join hospital.escalas e on e.setor_id=r.setor_id and e.data=r.data_local and e.turno=r.turno
      left join hospital.equipes t on t.id=e.equipe_id
      left join hospital.manifestacoes m on m.resposta_id=r.id
      where r.data_local between p_inicio and p_fim and (sid is null or r.setor_id=sid)
        and (p_turno is null or r.turno=p_turno::hospital.turno) and (p_equipe is null or e.equipe_id=p_equipe)
    )
    select jsonb_build_object(
      'atualizado_em',statement_timestamp(),'inicio',p_inicio,'fim',p_fim,
      'respostas',(select count(*) from f),'manifestacoes',(select count(manifestacao_id) from f),
      'por_metrica',(select coalesce(jsonb_agg(to_jsonb(x) order by x.metrica),'[]') from
        (select metrica,count(*) n,round(avg(nota),2) media,
          round(100.0*count(*) filter(where nota>=case when metrica='rostos_5' then 4 else 8 end)/nullif(count(*),0),2) satisfacao
         from f group by metrica) x),
      'tendencia',(select coalesce(jsonb_agg(to_jsonb(x) order by x.data,x.metrica),'[]') from
        (select data_local data,metrica,count(*) n,round(avg(nota),2) media from f group by data_local,metrica) x),
      'distribuicao',(select coalesce(jsonb_agg(to_jsonb(x) order by x.metrica,x.nota),'[]') from
        (select metrica,nota,count(*) n from f group by metrica,nota) x),
      'por_setor',(select coalesce(jsonb_agg(to_jsonb(x) order by x.nome,x.metrica),'[]') from
        (select setor_id,setor nome,metrica,count(*) n,round(avg(nota),2) media from f group by setor_id,setor,metrica) x),
      'por_turno',(select coalesce(jsonb_agg(to_jsonb(x) order by x.turno,x.metrica),'[]') from
        (select turno,metrica,count(*) n,round(avg(nota),2) media from f group by turno,metrica) x),
      'por_equipe',case when p.papel='visualizador' then '[]'::jsonb else
        (select coalesce(jsonb_agg(to_jsonb(x) order by x.nome,x.metrica),'[]') from
          (select equipe_id,equipe nome,metrica,count(*) n,round(avg(nota),2) media from f where equipe_id is not null
           group by equipe_id,equipe,metrica having count(*)>=minimo) x) end,
      'etapas',(select coalesce(jsonb_agg(to_jsonb(x) order by x.questionario_id,x.ordem),'[]') from
        (select a.questionario_id,q.versao,a.pergunta_id,g.chave,g.texto,g.ordem,a.metrica,count(*) n,round(avg(a.nota),2) media
         from f join hospital.avaliacoes_etapas a on a.resposta_id=f.id
         join hospital.perguntas g on g.id=a.pergunta_id join hospital.questionarios q on q.id=a.questionario_id
         group by a.questionario_id,q.versao,a.pergunta_id,g.chave,g.texto,g.ordem,a.metrica) x),
      'equipes_aviso','Associação indicativa pelo horário da resposta e escala vigente. Não identifica culpabilidade nem comprova a equipe do atendimento.'
    )
  );
end $$;

-- TV público: somente snapshots, com pelo menos 5 respostas novas entre publicações.
-- Evita que chamadas repetidas isolem a nota de um único envio. Nunca devolve texto livre.
create function public.ep_tv() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('periodo_dias',30,'metricas',coalesce((
    select jsonb_agg(jsonb_build_object('metrica',metrica,'n',n,'media',media,'satisfacao',satisfacao,
      'publicado_em',publicado_em,'inicio',inicio,'fim',fim) order by metrica)
    from hospital.tv_publicacoes where publicado_em>now()-interval '1 day'),'[]'));
$$;
create function public.ep_publicar_tv() returns int language plpgsql security definer set search_path='' as $$
declare g record; anterior hospital.tv_publicacoes; minimo int; n int:=0;
  hoje date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
  perform pg_advisory_xact_lock(716025003);
  select minimo_grupo into minimo from hospital.configuracao where id;
  for g in select r.metrica,count(*) filter(where r.data_local>=hoje-29) quantidade,
      round(avg(r.nota) filter(where r.data_local>=hoje-29),2) media,
      round(100.0*count(*) filter(where r.data_local>=hoje-29 and r.nota>=case when r.metrica='rostos_5' then 4 else 8 end)/
        nullif(count(*) filter(where r.data_local>=hoje-29),0),2) satisfacao,count(*) total
    from hospital.respostas r group by r.metrica loop
    select * into anterior from hospital.tv_publicacoes where metrica=g.metrica;
    if g.quantidade>=minimo and g.total-coalesce(anterior.total_coletado,0)>=minimo
       and (anterior.publicado_em is null or anterior.publicado_em<=now()-interval '15 minutes') then
      insert into hospital.tv_publicacoes(metrica,n,media,satisfacao,total_coletado,publicado_em,inicio,fim)
      values(g.metrica,g.quantidade,g.media,g.satisfacao,g.total,now(),hoje-29,hoje)
      on conflict(metrica) do update set n=excluded.n,media=excluded.media,satisfacao=excluded.satisfacao,
        total_coletado=excluded.total_coletado,publicado_em=excluded.publicado_em,inicio=excluded.inicio,fim=excluded.fim;
      n:=n+1;
    end if;
  end loop;
  perform hospital.auditar('publicar_tv','tv_publicacoes',null,jsonb_build_object('grupos',n));
  return n;
end $$;

create function public.ep_listar_manifestacoes(p_setor uuid default null,p_situacao text default null,p_limite int default 50,p_antes bigint default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p hospital.perfis; sid uuid:=p_setor;
begin
  p:=hospital.exigir_acesso(array['super_admin','admin_setor','gestao','ouvidoria']::hospital.papel[],p_setor);
  if p.papel='admin_setor' then sid:=p.setor_id; end if;
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'Limite inválido' using errcode='22023'; end if;
  if p_situacao is not null and p_situacao not in ('aberta','em_atendimento','encerrada') then
    raise exception 'Situação inválida' using errcode='22023'; end if;
  perform hospital.auditar('listar_manifestacoes','manifestacoes',sid::text);
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.protocolo desc),'[]') from
    (select m.id,m.protocolo,m.tipo,m.situacao,m.criado_em,m.revisao,r.setor_id,s.nome setor,r.turno,r.nota,r.metrica
     from hospital.manifestacoes m join hospital.respostas r on r.id=m.resposta_id join hospital.setores s on s.id=r.setor_id
     where (sid is null or r.setor_id=sid) and (p_situacao is null or m.situacao=p_situacao::hospital.situacao)
       and (p_antes is null or m.protocolo<p_antes) order by m.protocolo desc limit p_limite) x);
end $$;
create function public.ep_detalhar_manifestacao(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p hospital.perfis; sid uuid; resultado jsonb;
begin
  p:=hospital.exigir_acesso(array['super_admin','admin_setor','gestao','ouvidoria']::hospital.papel[]);
  select r.setor_id into sid from hospital.manifestacoes m join hospital.respostas r on r.id=m.resposta_id where m.id=p_id;
  if sid is null or (p.papel='admin_setor' and sid is distinct from p.setor_id) then
    raise exception 'Manifestação não disponível' using errcode='42501'; end if;
  select jsonb_build_object('id',m.id,'protocolo',m.protocolo,'tipo',m.tipo,'comentario',m.comentario,
    'situacao',m.situacao,'revisao',m.revisao,'criado_em',m.criado_em,'encerrado_em',m.encerrado_em,
    'setor_id',sid,
    'telefone',case when p.papel in ('super_admin','ouvidoria') then c.telefone else null end,
    'consentimento_em',case when p.papel in ('super_admin','ouvidoria') then c.consentimento_em else null end,
    'interacoes',case when p.papel in ('super_admin','ouvidoria') then
       (select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'relato',i.relato,'situacao',i.situacao,'criado_em',i.criado_em) order by i.id),'[]')
        from hospital.interacoes i where i.manifestacao_id=m.id) else '[]'::jsonb end)
  into resultado from hospital.manifestacoes m left join hospital.contatos c on c.manifestacao_id=m.id where m.id=p_id;
  perform hospital.auditar(case when p.papel in ('super_admin','ouvidoria') then 'ler_manifestacao_contato' else 'ler_manifestacao' end,
    'manifestacoes',p_id::text);
  return resultado;
end $$;
create function public.ep_atender_manifestacao(p_id uuid,p_revisao int,p_situacao text,p_relato text) returns int
language plpgsql security definer set search_path='' as $$
declare m hospital.manifestacoes;
begin
  perform hospital.exigir_acesso(array['super_admin','ouvidoria']::hospital.papel[]);
  select * into m from hospital.manifestacoes where id=p_id for update;
  if m.id is null then raise exception 'Manifestação inexistente' using errcode='22023'; end if;
  if p_revisao is distinct from m.revisao then raise exception 'Atendimento atualizado por outra pessoa; recarregue' using errcode='40001'; end if;
  if m.situacao='encerrada' then raise exception 'Atendimento já encerrado' using errcode='22023'; end if;
  if p_situacao is null or p_situacao not in ('em_atendimento','encerrada') or length(trim(coalesce(p_relato,''))) not between 3 and 4000 then
    raise exception 'Informe situação e relato de 3 a 4000 caracteres' using errcode='22023'; end if;
  insert into hospital.interacoes(manifestacao_id,autor_id,relato,situacao) values(p_id,auth.uid(),trim(p_relato),p_situacao::hospital.situacao);
  update hospital.manifestacoes set situacao=p_situacao::hospital.situacao,revisao=revisao+1,atualizado_em=now(),
    encerrado_em=case when p_situacao='encerrada' then now() end,
    encerrado_por=case when p_situacao='encerrada' then auth.uid() end where id=p_id;
  perform hospital.auditar('atender_manifestacao','manifestacoes',p_id::text,jsonb_build_object('situacao',p_situacao,'revisao',m.revisao+1));
  return m.revisao+1;
end $$;

-- Exportação paginada: mesmos filtros do painel, sem contato nem texto livre.
create function public.ep_exportar(p_inicio date,p_fim date,p_setor uuid default null,p_turno text default null,
  p_equipe uuid default null,p_limite int default 500,p_depois uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p hospital.perfis; sid uuid:=p_setor;
begin
  p:=hospital.exigir_acesso(array['super_admin','admin_setor','gestao']::hospital.papel[],p_setor);
  if p.papel='admin_setor' then sid:=p.setor_id; end if;
  if p_inicio is null or p_fim is null or p_fim<p_inicio or p_fim-p_inicio>365 or p_limite is null or p_limite not between 1 and 1000 then
    raise exception 'Intervalo ou limite inválido' using errcode='22023'; end if;
  if p_turno is not null and p_turno not in ('manha','tarde','noite') then raise exception 'Turno inválido' using errcode='22023'; end if;
  if p_equipe is not null and not exists(select 1 from hospital.equipes where id=p_equipe and (sid is null or setor_id=sid)) then
    raise exception 'Equipe não autorizada' using errcode='42501'; end if;
  perform hospital.auditar('exportar','respostas',sid::text,jsonb_build_object('inicio',p_inicio,'fim',p_fim,'turno',p_turno,'equipe',p_equipe,'limite',p_limite,'depois',p_depois));
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') from
    (select r.id,s.slug setor,r.criado_em,r.data_local,r.turno,r.canal,r.metrica,r.nota,q.versao questionario_versao,m.tipo,
       (select coalesce(jsonb_agg(jsonb_build_object('chave',g.chave,'metrica',a.metrica,'nota',a.nota) order by g.ordem),'[]')
        from hospital.avaliacoes_etapas a join hospital.perguntas g on g.id=a.pergunta_id where a.resposta_id=r.id) etapas
     from hospital.respostas r join hospital.setores s on s.id=r.setor_id join hospital.questionarios q on q.id=r.questionario_id
     left join hospital.manifestacoes m on m.resposta_id=r.id
     left join hospital.escalas e on e.setor_id=r.setor_id and e.data=r.data_local and e.turno=r.turno
     where r.data_local between p_inicio and p_fim and (sid is null or r.setor_id=sid)
       and (p_turno is null or r.turno=p_turno::hospital.turno) and (p_equipe is null or e.equipe_id=p_equipe)
       and (p_depois is null or r.id>p_depois) order by r.id limit p_limite) x);
end $$;

-- Manutenção: somente executor operacional confiável; nunca anon/authenticated.
create function public.ep_expurgar_contatos() returns int language plpgsql security definer set search_path='' as $$
declare n int; dias int;
begin
  select retencao_contato_dias into dias from hospital.configuracao where id;
  update hospital.contatos set telefone=null,expurgado_em=now()
    where telefone is not null and consentimento_em<now()-make_interval(days=>dias);
  get diagnostics n=row_count;
  delete from hospital.limites_coleta where janela<now()-interval '1 day';
  perform hospital.auditar('expurgar_contatos','contatos',null,jsonb_build_object('quantidade',n,'retencao_dias',dias));
  return n;
end $$;
create function public.ep_auditoria(p_antes bigint default null,p_limite int default 100) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform hospital.exigir_acesso(array['super_admin']::hospital.papel[]);
  if p_limite is null or p_limite not between 1 and 500 then raise exception 'Limite inválido' using errcode='22023'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.id desc),'[]') from
    (select id,ator_id,acao,entidade,alvo,detalhes,criado_em from hospital.auditoria
     where p_antes is null or id<p_antes order by id desc limit p_limite) x);
end $$;

revoke all on function public.ep_painel(date,date,uuid,text,uuid),public.ep_tv(),
 public.ep_listar_manifestacoes(uuid,text,int,bigint),public.ep_detalhar_manifestacao(uuid),
 public.ep_atender_manifestacao(uuid,int,text,text),public.ep_exportar(date,date,uuid,text,uuid,int,uuid),
 public.ep_expurgar_contatos(),public.ep_publicar_tv(),public.ep_auditoria(bigint,int) from public,anon,authenticated,service_role;
grant execute on function public.ep_tv() to anon,authenticated;
grant execute on function public.ep_painel(date,date,uuid,text,uuid),public.ep_listar_manifestacoes(uuid,text,int,bigint),
 public.ep_detalhar_manifestacao(uuid),public.ep_atender_manifestacao(uuid,int,text,text),
 public.ep_exportar(date,date,uuid,text,uuid,int,uuid),public.ep_auditoria(bigint,int) to authenticated;
grant execute on function public.ep_expurgar_contatos(),public.ep_publicar_tv() to service_role;
commit;
