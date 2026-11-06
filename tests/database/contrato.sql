\set ON_ERROR_STOP on
create schema teste;
create function teste.ok(p_condicao boolean,p_nome text) returns text language plpgsql as $$
begin
  if p_condicao is distinct from true then raise exception 'FALHOU: %',p_nome; end if;
  return 'OK: '||p_nome;
end $$;
create function teste.erro(p_sql text,p_codigo text,p_nome text) returns text language plpgsql as $$
declare codigo text;
begin
  begin execute p_sql;
  exception when others then
    get stacked diagnostics codigo=returned_sqlstate;
    if codigo=p_codigo then return 'OK: '||p_nome; end if;
    raise exception 'FALHOU: %, esperado %, recebido %: %',p_nome,p_codigo,codigo,sqlerrm;
  end;
  raise exception 'FALHOU: %, comando deveria falhar',p_nome;
end $$;
grant usage on schema teste to anon,authenticated,service_role;

insert into auth.users(id,email) select ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'teste'||i||'@example.invalid'
from generate_series(1,9) i;
select id as pa from hospital.setores where slug='pa' \gset
select id as rx from hospital.setores where slug='rx' \gset
select id as qpa from hospital.questionarios where setor_id=:'pa' and publicado \gset
select id as qrx from hospital.questionarios where setor_id=:'rx' and publicado \gset
insert into hospital.perfis(user_id,nome,papel,setor_id,ativo) values
 ('00000000-0000-0000-0000-000000000001','Super Admin','super_admin',null,true),
 ('00000000-0000-0000-0000-000000000002','Admin PA','admin_setor',:'pa',true),
 ('00000000-0000-0000-0000-000000000003','Gestão','gestao',null,true),
 ('00000000-0000-0000-0000-000000000004','Ouvidoria','ouvidoria',null,true),
 ('00000000-0000-0000-0000-000000000005','Visualizador','visualizador',null,true),
 ('00000000-0000-0000-0000-000000000007','Admin RX','admin_setor',:'rx',true),
 ('00000000-0000-0000-0000-000000000008','Admin inativo','super_admin',null,false);
select teste.ok((select count(*)=6 from hospital.setores),'seis setores');
select teste.ok((select count(*)=36 from hospital.perguntas),'geral e cinco etapas por setor');
select teste.erro(format('insert into hospital.perfis(user_id,nome,papel) values(%L,%L,%L)',
 '00000000-0000-0000-0000-000000000006','Sem setor','admin_setor'),'23514','admin exige setor');

set role anon;
select set_config('request.jwt.claim.sub','',false);
select teste.ok(jsonb_array_length(public.ep_setores())=6,'anon consulta apenas catálogo');
select teste.erro('select * from hospital.respostas','42501','anon não lê respostas');
select teste.erro('select * from hospital.contatos','42501','anon não lê contatos');
select teste.erro('select public.ep_meu_perfil()','42501','anon não consulta perfil');
select teste.erro('select public.ep_painel(current_date,current_date)','42501','anon não consulta gestão');
select teste.erro('select public.ep_formulario(''pa'')','55000','instalação inicia com coleta desabilitada');
select teste.erro('select public.ep_expurgar_contatos()','42501','anon não executa manutenção');
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',false);
select teste.erro('select public.ep_meu_perfil()','42501','cadastro sem perfil não acessa gestão');
select teste.erro('select public.ep_definir_perfil(''00000000-0000-0000-0000-000000000006'',''Invasor'',''super_admin'')','42501','sem perfil não se promove');
select teste.erro(format('select public.ep_publicar_questionario(%L,''rostos_5'',2,''Pergunta indevida'')',:'pa'),'42501','sem perfil não publica');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000008',false);
select teste.erro('select public.ep_meu_perfil()','42501','perfil inativo não entra');
select set_config('request.jwt.claim.sub','',false);
select teste.erro('select public.ep_meu_perfil()','42501','JWT sem sujeito não entra');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select teste.ok(public.ep_meu_perfil()->>'papel'='super_admin','superadmin autorizado');
select teste.erro('select public.ep_definir_perfil(''00000000-0000-0000-0000-000000000001'',''Eu'',''gestao'')','42501','superadmin não altera próprio acesso');
select public.ep_configurar_operacao('teste-v1','Aviso de privacidade exclusivo do ambiente de teste. Contato opcional e restrito à Ouvidoria.',true,90);
select teste.erro('select public.ep_configurar_operacao(''teste-v1'',''Outro texto com a mesma versão que não deve ser aceito.'',true)','22023','versão de privacidade imutável');
select public.ep_definir_perfil('00000000-0000-0000-0000-000000000009','Segundo Admin','super_admin');
select teste.ok(jsonb_array_length(public.ep_listar_perfis())=8,'concessão de acesso auditável');
select public.ep_salvar_equipe(:'pa','Equipe PA') as equipe_pa \gset
select public.ep_salvar_equipe(:'rx','Equipe RX') as equipe_rx \gset
select public.ep_salvar_escala(:'pa',:'equipe_pa',(now() at time zone 'America/Sao_Paulo')::date,'manha');
select public.ep_salvar_escala(:'pa',:'equipe_pa',(now() at time zone 'America/Sao_Paulo')::date,'tarde');
select public.ep_salvar_escala(:'pa',:'equipe_pa',(now() at time zone 'America/Sao_Paulo')::date,'noite');
select teste.erro(format('select public.ep_salvar_escala(%L,%L,current_date,''manha'')',:'pa',:'equipe_rx'),'22023','escala rejeita equipe de outro setor');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select teste.ok(public.ep_meu_perfil()->>'papel'='admin_setor','admin setor autorizado');
select teste.erro(format('select public.ep_salvar_equipe(%L,''Equipe indevida'')',:'rx'),'42501','admin não altera equipe de outro setor');
select teste.erro(format('select public.ep_publicar_questionario(%L,''rostos_5'',2,''Pergunta indevida'')',:'rx'),'42501','admin não publica em outro setor');
select teste.erro(format('select public.ep_painel(current_date,current_date,%L)',:'rx'),'42501','admin não consulta outro setor');
select teste.erro('select public.ep_configurar_operacao(''v2'',''Texto de privacidade suficientemente longo.'',true)','42501','admin setor não altera operação global');
select teste.erro('select * from hospital.perfis','42501','authenticated não lê tabelas internas');
reset role;

set role anon;
select teste.ok(public.ep_formulario('pa')->>'metrica'='rostos_5','formulário público usa escala publicada');
select teste.ok((select count(*)=1 from jsonb_array_elements(public.ep_formulario('pa')->'perguntas') p where (p->>'obrigatoria')::boolean),'só uma pergunta obrigatória');
select teste.erro('select public.ep_formulario(''inexistente'')','22023','setor inválido não vira todos os setores');
select teste.erro(format('select public.ep_enviar_pesquisa(gen_random_uuid(),%L,5,''celular'',repeat(''a'',64),''teste-v1'')',:'qpa'),'42501','anon não grava diretamente');
reset role;
set role authenticated;
select teste.erro(format('select public.ep_enviar_pesquisa(gen_random_uuid(),%L,5,''celular'',repeat(''a'',64),''teste-v1'')',:'qpa'),'42501','authenticated não burla coleta do backend');
reset role;
set role service_role;
select teste.erro('select * from hospital.respostas','42501','service_role sem grants diretos de tabelas');
select public.ep_enviar_pesquisa('10000000-0000-0000-0000-000000000001',:'qpa',5,'celular',repeat('a',64),'teste-v1','{"recepcao":4}',
 'reclamacao','Demora no atendimento, gostaria de retorno.','(51) 98765-4321',true) as recebido \gset
select teste.ok((:'recebido'::jsonb->>'recebida')::boolean,'coleta atômica completa');
select teste.ok(public.ep_enviar_pesquisa('10000000-0000-0000-0000-000000000001',:'qpa',5,'celular',repeat('a',64),'teste-v1','{"recepcao":4}',
 'reclamacao','Demora no atendimento, gostaria de retorno.','(51) 98765-4321',true)=:'recebido'::jsonb,'retry retorna mesmo protocolo');
select teste.erro(format('select public.ep_enviar_pesquisa(''10000000-0000-0000-0000-000000000001'',%L,4,''celular'',repeat(''a'',64),''teste-v1'')',:'qpa'),'22023','chave não aceita conteúdo diferente');
select teste.erro(format('select public.ep_enviar_pesquisa(gen_random_uuid(),%L,6,''celular'',repeat(''a'',64),''teste-v1'')',:'qpa'),'22023','rostinhos rejeitam nota 6');
select teste.erro(format('select public.ep_enviar_pesquisa(gen_random_uuid(),%L,5,''celular'',repeat(''a'',64),''teste-v1'',''{"recepcao":10}'')',:'qpa'),'22023','etapa respeita escala facial');
select teste.erro(format('select public.ep_enviar_pesquisa(gen_random_uuid(),%L,5,''celular'',repeat(''a'',64),''teste-v1'',''{"desconhecida":4}'')',:'qpa'),'22023','etapa precisa pertencer ao questionário');
select teste.erro(format('select public.ep_enviar_pesquisa(gen_random_uuid(),%L,5,''celular'',repeat(''a'',64),''teste-v1'',''{"recepcao":2.5}'')',:'qpa'),'22023','nota fracionária rejeitada');
select teste.erro(format('select public.ep_enviar_pesquisa(gen_random_uuid(),%L,5,''celular'',repeat(''a'',64),''teste-v1'',''{"recepcao":"4"}'')',:'qpa'),'22023','nota textual rejeitada');
select teste.erro(format('select public.ep_enviar_pesquisa(gen_random_uuid(),%L,5,''celular'',repeat(''a'',64),''antiga'')',:'qpa'),'22023','aviso desatualizado rejeitado');
select teste.erro(format('select public.ep_enviar_pesquisa(gen_random_uuid(),%L,5,''celular'',repeat(''a'',64),''teste-v1'',''{}'',''reclamacao'',''Teste de retorno'',''51987654321'',false)',:'qpa'),'22023','telefone sem consentimento rejeitado');
select teste.erro(format('select public.ep_enviar_pesquisa(gen_random_uuid(),%L,5,''celular'',repeat(''a'',64),''teste-v1'',''{}'',null,null,''abc'',true)',:'qpa'),'22023','contato rejeita telefone sem dígitos');
select teste.erro(format('select public.ep_enviar_pesquisa(gen_random_uuid(),%L,5,''celular'',repeat(''a'',64),''teste-v1'',''{}'',''reclamacao'',repeat(''x'',2001))',:'qpa'),'22023','comentário longo rejeitado sem truncar');
select public.ep_enviar_pesquisa('10000000-0000-0000-0000-000000000002',:'qpa',1,'tablet',repeat('b',64),'teste-v1','{}','reclamacao','Reclamação sem identificação.');
select public.ep_enviar_pesquisa('10000000-0000-0000-0000-000000000003',:'qrx',4,'celular',repeat('c',64),'teste-v1');
reset role;
select teste.ok((select count(*)=3 from hospital.respostas),'falhas e retries não geram respostas extras');
select teste.ok((select count(*)=1 from hospital.contatos),'telefone armazenado apenas com consentimento');
select teste.ok((select count(*)=2 from hospital.manifestacoes),'manifestação anônima tem registro independente');
select teste.ok((select count(*)=1 from hospital.avaliacoes_etapas),'gravação de etapas normalizada');
select teste.ok((select sum(quantidade)=6 from hospital.limites_coleta),'falhas e retries não consomem cotas');
select teste.ok((select bool_and(data_local=(criado_em at time zone 'America/Sao_Paulo')::date) from hospital.respostas),'data local derivada no banco');
select id as mid,revisao as revisao from hospital.manifestacoes where protocolo=(:'recebido'::jsonb->>'protocolo')::bigint \gset
select m.id as mid_anon from hospital.manifestacoes m join hospital.respostas r on r.id=m.resposta_id
 where r.chave_envio='10000000-0000-0000-0000-000000000002'::uuid \gset

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select teste.ok((public.ep_painel(current_date,current_date)->>'respostas')::int=3,'gestão consulta painel completo');
select teste.ok(jsonb_array_length(public.ep_painel(current_date,current_date)->'tendencia')=1,'tendência retorna valores reais');
select teste.ok(jsonb_array_length(public.ep_painel(current_date,current_date)->'distribuicao')=3,'distribuição retorna valores reais');
select teste.ok(public.ep_detalhar_manifestacao(:'mid')->>'telefone' is null,'gestão não recebe telefone');
select teste.ok(jsonb_array_length(public.ep_exportar(current_date,current_date,:'pa'))=2,'exportação filtra setor');
select teste.ok(not (public.ep_exportar(current_date,current_date)->0 ? 'comentario'),'exportação não contém texto livre');
select teste.ok(not (public.ep_exportar(current_date,current_date)->0 ? 'telefone'),'exportação não contém telefone');
select teste.erro(format('select public.ep_atender_manifestacao(%L,1,''encerrada'',''Encerrar indevidamente'')',:'mid'),'42501','gestão não atende Ouvidoria');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select teste.ok((public.ep_painel(current_date,current_date)->>'respostas')::int=2,'admin só vê próprio setor mesmo sem filtro');
select teste.ok(jsonb_array_length(public.ep_exportar(current_date,current_date))=2,'exportação respeita setor do admin');
select teste.ok(public.ep_detalhar_manifestacao(:'mid')->>'telefone' is null,'admin não recebe telefone');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000007',false);
select teste.erro(format('select public.ep_detalhar_manifestacao(%L)',:'mid'),'42501','admin de outro setor não lê manifestação');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',false);
select teste.ok((public.ep_painel(current_date,current_date)->>'respostas')::int=3,'visualizador acessa indicadores');
select teste.ok(jsonb_array_length(public.ep_painel(current_date,current_date)->'por_equipe')=0,'visualizador não recebe equipes');
select teste.erro('select public.ep_listar_manifestacoes()','42501','visualizador não recebe manifestações');
select teste.erro('select public.ep_exportar(current_date,current_date)','42501','visualizador não exporta linhas individuais');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
select teste.ok(public.ep_detalhar_manifestacao(:'mid')->>'telefone'='51987654321','Ouvidoria recebe contato normalizado');
select teste.ok(jsonb_array_length(public.ep_listar_manifestacoes())=2,'Ouvidoria inclui manifestações anônimas');
select teste.ok(public.ep_atender_manifestacao(:'mid_anon',1,'em_atendimento','Encaminhada à coordenação do setor.')=2,'atendimento anônimo sem telefone');
select teste.erro(format('select public.ep_atender_manifestacao(%L,1,''encerrada'',''Encerramento com versão antiga'')',:'mid_anon'),'40001','concorrência de atendimento detectada');
select teste.erro(format('select public.ep_atender_manifestacao(%L,2,''encerrada'','''')',:'mid_anon'),'22023','encerramento exige relato');
select teste.ok(public.ep_atender_manifestacao(:'mid_anon',2,'encerrada','Resolvido e registrado o encaminhamento.')=3,'encerramento com histórico');
select teste.erro(format('select public.ep_atender_manifestacao(%L,3,''em_atendimento'',''Reabrir sem regra'')',:'mid_anon'),'22023','encerramento é terminal');
select teste.erro('select public.ep_listar_manifestacoes(null,null,101)','22023','paginação limitada');
reset role;
select teste.ok((select count(*)>=1 from hospital.auditoria where acao='ler_manifestacao_contato'),'leitura de contato auditada');
select teste.ok(not exists(select 1 from hospital.auditoria where detalhes::text like '%51987654321%'),'auditoria não replica telefone');
select teste.erro('update hospital.auditoria set acao=''alterada''','23514','auditoria imutável');
select teste.erro('update hospital.interacoes set relato=''Histórico alterado''','23514','interações imutáveis');
select teste.erro('update hospital.respostas set nota=1','23514','respostas imutáveis');
select teste.erro('update hospital.perguntas set texto=''Pergunta substituída''','23514','pergunta versionada é imutável');

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select public.ep_publicar_questionario(:'pa','nota_10',4,'Como você avalia sua experiência geral no hospital?',
 '[{"chave":"recepcao","texto":"Como foi o acolhimento na recepção?","metrica":"nota_10"},
   {"chave":"triagem","texto":"Como foi sua experiência na triagem?","metrica":"rostos_5"}]') as qpa2 \gset
select teste.ok(public.ep_formulario('pa')->>'versao'='2','publicação cria versão nova');
select teste.ok(public.ep_formulario('pa')->'perguntas'->1->>'metrica'='nota_10','criador escolhe escala 1 a 10 na etapa');
select teste.ok(public.ep_formulario('pa')->'perguntas'->2->>'metrica'='rostos_5','mesmo questionário admite etapas com escalas diferentes');
reset role;
set role service_role;
select teste.erro(format('select public.ep_enviar_pesquisa(gen_random_uuid(),%L,5,''celular'',repeat(''a'',64),''teste-v1'')',:'qpa'),'22023','versão antiga deixa de receber novos envios');
select teste.ok(public.ep_enviar_pesquisa('10000000-0000-0000-0000-000000000004',:'qpa2',10,'celular',repeat('d',64),'teste-v1','{"recepcao":10,"triagem":5}')->>'recebida'='true','nota geral e etapa aceitam 10 quando configuradas');
select teste.erro(format('select public.ep_enviar_pesquisa(gen_random_uuid(),%L,0,''celular'',repeat(''a'',64),''teste-v1'')',:'qpa2'),'22023','escala numérica começa em 1, não é NPS');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select teste.ok(jsonb_array_length(public.ep_painel(current_date,current_date)->'por_metrica')=2,'indicadores não misturam escalas');
select teste.ok(jsonb_array_length(public.ep_painel(current_date,current_date)->'por_equipe')=0,'equipes com menos de cinco respostas por escala suprimidas');
select teste.ok(jsonb_array_length(public.ep_exportar(current_date-2,current_date-1))=0,'exportação respeita período');
select teste.erro('select public.ep_painel(current_date,current_date,null,''invalido'')','22023','turno inválido não amplia filtro');
select teste.erro('select public.ep_painel(current_date,current_date-1)','22023','período invertido rejeitado');
select teste.erro('select public.ep_painel(current_date-1000,current_date)','22023','consulta sem limite temporal rejeitada');
reset role;
set role anon;
select teste.ok(public.ep_tv()->'metricas'='[]'::jsonb,'TV não revela envios antes da publicação protegida');
select teste.ok(not (public.ep_tv() ? 'comentario'),'TV sem comentários');
reset role;

-- Filtros de turno, limiar de equipe e contadores sem duplicação.
set role service_role;
select public.ep_enviar_pesquisa(gen_random_uuid(),:'qrx',4,'celular',repeat('e',64),'teste-v1') from generate_series(1,4);
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select public.ep_salvar_escala(:'rx',:'equipe_rx',current_date,'manha');
select public.ep_salvar_escala(:'rx',:'equipe_rx',current_date,'tarde');
select public.ep_salvar_escala(:'rx',:'equipe_rx',current_date,'noite');
select teste.ok((public.ep_painel(current_date,current_date,:'rx')->>'respostas')::int=5,'join de escala não duplica respostas');
select teste.ok(jsonb_array_length(public.ep_painel(current_date,current_date,:'rx')->'por_equipe')=1,'equipe aparece no limiar mínimo');
reset role;
select turno::text as turno_atual from hospital.respostas limit 1 \gset
set role authenticated;
select teste.ok(jsonb_array_length(public.ep_exportar(current_date,current_date,:'rx',:'turno_atual'))=5,'exportação respeita turno');
select teste.ok(jsonb_array_length(public.ep_exportar(current_date,current_date,:'rx',null,:'equipe_rx'))=5,'exportação respeita equipe');
select teste.ok(jsonb_array_length(public.ep_exportar(current_date,current_date,:'rx',null,null,2))=2,'exportação paginada');
select public.ep_exportar(current_date,current_date,:'rx',null,null,2)->1->>'id' as cursor_export \gset
select teste.ok(jsonb_array_length(public.ep_exportar(current_date,current_date,:'rx',null,null,100,:'cursor_export'))=3,'cursor continua sem repetir linhas');
reset role;

-- Rate limit: atomicidade sob rejeição, separado por origem e por setor.
update hospital.configuracao set limite_origem_10min=1 where id;
set role service_role;
select public.ep_enviar_pesquisa(gen_random_uuid(),:'qrx',4,'tablet',repeat('f',64),'teste-v1');
select teste.erro(format('select public.ep_enviar_pesquisa(gen_random_uuid(),%L,4,''celular'',repeat(''f'',64),''teste-v1'')',:'qrx'),'P0001','mudar canal não contorna limite de origem');
reset role;
select teste.ok((select count(*)=9 from hospital.respostas),'rate limit não deixa gravação parcial');
update hospital.configuracao set limite_origem_10min=15,limite_setor_10min=10 where id;
set role service_role;
select public.ep_enviar_pesquisa(gen_random_uuid(),:'qrx',4,'celular',repeat('1',64),'teste-v1') from generate_series(1,4);
select teste.erro(format('select public.ep_enviar_pesquisa(gen_random_uuid(),%L,4,''celular'',repeat(''2'',64),''teste-v1'')',:'qrx'),'P0001','limite agregado de setor');
reset role;
update hospital.configuracao set limite_setor_10min=300 where id;
-- Expurgo cobre também chamados abertos; não depende de fechamento que pode nunca ocorrer.
update hospital.contatos set consentimento_em=now()-interval '91 days';
set role service_role;
select teste.ok(public.ep_expurgar_contatos()=1,'expurgo remove telefone vencido em chamado aberto');
select teste.ok(public.ep_expurgar_contatos()=0,'expurgo repetido é idempotente');
select teste.ok(public.ep_publicar_tv()=1,'TV publica apenas escala com grupo mínimo');
select teste.ok(public.ep_publicar_tv()=0,'TV não republica sem lote novo e intervalo mínimo');
select teste.ok(public.ep_enviar_pesquisa(gen_random_uuid(),:'qrx',4,'celular',repeat('3',64),'teste-v1','{}',null,null,'51912345678',true)->>'recebida'='true','telefone com consentimento não torna comentário obrigatório');
reset role;
select teste.ok((select count(*)=1 from hospital.manifestacoes where tipo='retorno' and comentario is null),'retorno sem texto tem protocolo e atendimento próprio');
set role anon;
select teste.ok(jsonb_array_length(public.ep_tv()->'metricas')=1,'TV serve snapshot agregado');
select teste.ok(not (public.ep_tv()->'metricas'->0 ? 'total_coletado'),'TV não expõe contador interno');
reset role;
select teste.ok((select telefone is null and expurgado_em is not null from hospital.contatos where manifestacao_id=:'mid'),'expurgo preserva evidência mínima de consentimento');
select teste.ok((select count(*)=3 from hospital.manifestacoes),'expurgo não apaga manifestações');
select teste.ok((select bool_and(rowsecurity) from pg_tables where schemaname='hospital'),'RLS habilitada em todas as tabelas');
select teste.ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='hospital' and has_function_privilege('anon',p.oid,'execute')),'helpers internos inacessíveis a anon');
select 'Contrato funcional concluído' resultado;
