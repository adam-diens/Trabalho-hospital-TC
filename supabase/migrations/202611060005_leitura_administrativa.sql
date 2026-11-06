-- Evolução aditiva para a API v2; executar também no banco já instalado.
begin;
create function public.ep_configuracao() returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform hospital.exigir_acesso(array['super_admin']::hospital.papel[]);
  return (select jsonb_build_object('privacidade_versao',privacidade_versao,'privacidade_texto',privacidade_texto,
    'coleta_habilitada',coleta_habilitada,'retencao_contato_dias',retencao_contato_dias,'minimo_grupo',minimo_grupo)
    from hospital.configuracao where id);
end $$;
create function public.ep_listar_setores() returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform hospital.exigir_acesso(array['super_admin']::hospital.papel[]);
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'slug',slug,'nome',nome,'ativo',ativo) order by nome),'[]') from hospital.setores);
end $$;
create function public.ep_questionario(p_setor uuid,p_versao int default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare q hospital.questionarios;
begin
  perform hospital.exigir_acesso(array['super_admin','admin_setor']::hospital.papel[],p_setor);
  if p_setor is null or (p_versao is not null and p_versao<1) then raise exception 'Setor ou versão inválida' using errcode='22023'; end if;
  select * into q from hospital.questionarios where setor_id=p_setor
    and ((p_versao is null and publicado) or versao=p_versao);
  if q.id is null then raise exception 'Questionário inexistente' using errcode='22023'; end if;
  return jsonb_build_object('id',q.id,'setor_id',q.setor_id,'versao',q.versao,'metrica',q.metrica,
    'limite_ouvidoria',q.limite_ouvidoria,'publicado',q.publicado,
    'perguntas',(select jsonb_agg(jsonb_build_object('id',id,'chave',chave,'texto',texto,'metrica',metrica,'geral',geral,'ordem',ordem)
      order by ordem) from hospital.perguntas where questionario_id=q.id));
end $$;
revoke all on function public.ep_configuracao(),public.ep_listar_setores(),public.ep_questionario(uuid,int) from public,anon,authenticated,service_role;
grant execute on function public.ep_configuracao(),public.ep_listar_setores(),public.ep_questionario(uuid,int) to authenticated;
commit;
