-- Rode depois das correções. Todas as linhas devem mostrar passou = true.
select 'anon NÃO executa purgar_telefones' teste, not has_function_privilege('anon','purgar_telefones(int)','execute') passou
union all select 'anon NÃO executa painel_resumo', not has_function_privilege('anon','painel_resumo(text,text,int)','execute')
union all select 'anon NÃO executa exportar_respostas', not has_function_privilege('anon','exportar_respostas(text)','execute')
union all select 'anon NÃO executa definir_perfil', not has_function_privilege('anon','definir_perfil(text,text,perfil,text)','execute')
union all select 'anon NÃO executa listar_manifestacoes', not has_function_privilege('anon','listar_manifestacoes(text)','execute')
union all select 'anon DEVE executar registrar_resposta', has_function_privilege('anon','registrar_resposta(text,int,text,text)','execute')
union all select 'anon DEVE executar tv_resumo', has_function_privilege('anon','tv_resumo()','execute')
union all select 'anon NÃO lê respostas', not has_table_privilege('anon','respostas','select')
union all select 'anon NÃO lê contatos', not has_table_privilege('anon','contatos','select')
union all select 'anon NÃO lê tentativas', not has_table_privilege('anon','tentativas','select');
