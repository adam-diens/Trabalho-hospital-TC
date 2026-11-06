-- Verificações de catálogo; complementam os testes funcionais, não os substituem.
select '6 setores iniciais' teste,count(*)=6 passou from hospital.setores
union all
select 'RLS em todas as tabelas',bool_and(rowsecurity) from pg_tables where schemaname='hospital'
union all
select 'Sem grants diretos para clientes',not exists(
 select 1 from information_schema.role_table_grants where table_schema='hospital'
 and grantee in ('anon','authenticated','service_role','PUBLIC'))
union all
select 'Sem execucao implicita de RPC',not exists(
 select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
 where n.nspname in ('hospital','public') and (n.nspname='hospital' or p.proname like 'ep\_%')
 and acl.grantee=0 and acl.privilege_type='EXECUTE')
union all
select 'Exatamente uma geral por questionario publicado',not exists(
 select q.id from hospital.questionarios q left join hospital.perguntas p on p.questionario_id=q.id and p.geral
 where q.publicado group by q.id having count(p.id)<>1)
union all
select 'Coleta exclusiva do backend',not has_function_privilege('anon',
 'public.ep_enviar_pesquisa(uuid,uuid,int,text,text,text,jsonb,text,text,text,boolean)','execute')
 and not has_function_privilege('authenticated',
 'public.ep_enviar_pesquisa(uuid,uuid,int,text,text,text,jsonb,text,text,text,boolean)','execute')
union all
select 'search_path fixo nas RPCs',bool_and(p.proconfig @> array['search_path=""'])
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'ep\_%';
