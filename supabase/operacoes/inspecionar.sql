-- Somente leitura. Executar no SQL Editor antes de substituir o projeto remoto.
-- Não consulta respostas, contatos, senhas ou dados de pacientes.
select nspname schema from pg_namespace
where nspname not like 'pg_%' and nspname<>'information_schema' order by 1;
select schemaname,tablename,rowsecurity from pg_tables
where schemaname not in ('pg_catalog','information_schema') order by 1,2;
select n.nspname schema,p.proname funcao,p.prosecdef security_definer,p.proconfig configuracao,
       has_function_privilege('anon',p.oid,'execute') anon_executa,
       has_function_privilege('authenticated',p.oid,'execute') authenticated_executa
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','hospital') order by 1,2;
