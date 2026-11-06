  -- Solicitações de acesso sem concessão automática de privilégios.
  begin;
  create table hospital.solicitacoes_acesso (
    user_id uuid primary key references auth.users(id) on delete cascade,
    nome text not null check(length(trim(nome)) between 2 and 120),
    email text not null check(length(email) between 3 and 254),
    situacao text not null default 'pendente' check(situacao in ('pendente','aprovada','rejeitada')),
    criado_em timestamptz not null default now(),
    decidido_em timestamptz,
    decidido_por uuid references auth.users(id) on delete restrict,
    motivo text check(length(motivo) between 3 and 500),
    check((situacao='pendente' and decidido_em is null) or (situacao<>'pendente' and decidido_em is not null))
  );
  create index solicitacoes_situacao_idx on hospital.solicitacoes_acesso(situacao,user_id);
  alter table hospital.solicitacoes_acesso enable row level security;
  revoke all on hospital.solicitacoes_acesso from public,anon,authenticated,service_role;

  -- Metadados do usuário servem somente para o nome; nunca para autorização.
  create function hospital.registrar_solicitacao() returns trigger
  language plpgsql security definer set search_path='' as $$
  declare nome text;
  begin
    if coalesce(new.is_anonymous,false) or new.email is null or length(new.email) not between 3 and 254 then return new; end if;
    nome=left(trim(coalesce(new.raw_user_meta_data->>'name','')),120);
    if length(nome)<2 then nome='Conta institucional'; end if;
    insert into hospital.solicitacoes_acesso(user_id,nome,email) values(new.id,nome,new.email)
      on conflict(user_id) do nothing;
    return new;
  end $$;
  create trigger ep_nova_solicitacao after insert on auth.users
  for each row execute function hospital.registrar_solicitacao();

  -- Inclui contas já criadas que ainda não receberam nenhum perfil.
  insert into hospital.solicitacoes_acesso(user_id,nome,email)
  select u.id,case when length(trim(coalesce(u.raw_user_meta_data->>'name','')))>=2
    then left(trim(u.raw_user_meta_data->>'name'),120) else 'Conta institucional' end,u.email
  from auth.users u where not coalesce(u.is_anonymous,false) and length(u.email) between 3 and 254
    and not exists(select 1 from hospital.perfis p where p.user_id=u.id);

  -- Concessões manuais também retiram a solicitação da fila pendente.
  create function hospital.sincronizar_solicitacao() returns trigger
  language plpgsql security definer set search_path='' as $$
  begin
    if new.ativo then
      update hospital.solicitacoes_acesso set situacao='aprovada',decidido_em=now(),decidido_por=auth.uid(),motivo=null
      where user_id=new.user_id and situacao='pendente';
    end if;
    return new;
  end $$;
  create trigger ep_perfil_aprovado after insert or update on hospital.perfis
  for each row execute function hospital.sincronizar_solicitacao();

  create function public.ep_listar_solicitacoes(p_situacao text default 'pendente',p_limite int default 50,p_depois uuid default null)
  returns jsonb language plpgsql security definer set search_path='' as $$
  begin
    perform hospital.exigir_acesso(array['super_admin']::hospital.papel[]);
    if p_situacao is null or p_situacao not in ('pendente','aprovada','rejeitada') or p_limite is null or p_limite not between 1 and 100 then
      raise exception 'Filtro inválido' using errcode='22023'; end if;
    return (select coalesce(jsonb_agg(to_jsonb(x) order by x.user_id),'[]') from
      (select s.user_id,s.nome,s.email,s.situacao,s.criado_em,s.decidido_em,s.motivo,p.papel,p.setor_id
      from hospital.solicitacoes_acesso s left join hospital.perfis p on p.user_id=s.user_id
      where s.situacao=p_situacao and (p_depois is null or s.user_id>p_depois)
      order by s.user_id limit p_limite) x);
  end $$;

  create function public.ep_decidir_solicitacao(p_usuario uuid,p_decisao text,p_papel text default null,p_setor uuid default null,p_motivo text default null)
  returns jsonb language plpgsql security definer set search_path='' as $$
  declare s hospital.solicitacoes_acesso;
  begin
    perform pg_advisory_xact_lock(716025001);
    perform hospital.exigir_acesso(array['super_admin']::hospital.papel[]);
    if p_usuario=auth.uid() then raise exception 'Não decida o próprio acesso' using errcode='42501'; end if;
    if p_decisao is null or p_decisao not in ('aprovar','rejeitar') then raise exception 'Decisão inválida' using errcode='22023'; end if;
    select * into s from hospital.solicitacoes_acesso where user_id=p_usuario for update;
    if s.user_id is null then raise exception 'Solicitação inexistente' using errcode='22023'; end if;
    if s.situacao<>'pendente' or exists(select 1 from hospital.perfis where user_id=p_usuario and ativo) then
      raise exception 'Solicitação já decidida' using errcode='40001'; end if;
    if p_decisao='aprovar' then
      if p_papel is null or p_papel not in ('admin_setor','gestao','ouvidoria','visualizador') or p_motivo is not null
        or (p_papel='admin_setor' and p_setor is null) or (p_papel<>'admin_setor' and p_setor is not null) then
        raise exception 'Perfil de aprovação inválido' using errcode='22023'; end if;
      perform public.ep_definir_perfil(p_usuario,s.nome,p_papel,p_setor,true);
    elsif p_papel is not null or p_setor is not null or p_motivo is null or length(trim(p_motivo)) not between 3 and 500 then
      raise exception 'Informe somente o motivo da rejeição' using errcode='22023';
    end if;
    update hospital.solicitacoes_acesso set situacao=case when p_decisao='aprovar' then 'aprovada' else 'rejeitada' end,
      decidido_em=now(),decidido_por=auth.uid(),motivo=case when p_decisao='rejeitar' then trim(p_motivo) end
      where user_id=p_usuario;
    perform hospital.auditar('decidir_solicitacao','solicitacoes_acesso',p_usuario::text,
      jsonb_build_object('decisao',p_decisao,'papel',p_papel,'setor_id',p_setor));
    return jsonb_build_object('situacao',case when p_decisao='aprovar' then 'aprovada' else 'rejeitada' end);
  end $$;
  revoke all on function hospital.registrar_solicitacao(),hospital.sincronizar_solicitacao(),
    public.ep_listar_solicitacoes(text,int,uuid),public.ep_decidir_solicitacao(uuid,text,text,uuid,text)
    from public,anon,authenticated,service_role;
  grant execute on function public.ep_listar_solicitacoes(text,int,uuid),public.ep_decidir_solicitacao(uuid,text,text,uuid,text) to authenticated;
  notify pgrst,'reload schema';
  commit;
