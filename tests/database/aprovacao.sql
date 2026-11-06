\set ON_ERROR_STOP on
select id as aprovacao_pa from hospital.setores where slug='pa' \gset
insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000000101','nova@example.invalid','{"name":"Nova Pessoa","papel":"super_admin"}'),
 ('00000000-0000-0000-0000-000000000102','rejeitar@example.invalid','{"name":"Pessoa Rejeitada"}'),
 ('00000000-0000-0000-0000-000000000103','setor@example.invalid','{"name":"Pessoa do Setor"}'),
 ('00000000-0000-0000-0000-000000000104','manual@example.invalid','{}'),
 ('00000000-0000-0000-0000-000000000105','concorrencia@example.invalid','{}');
select teste.ok((select nome='Nova Pessoa' and situacao='pendente' from hospital.solicitacoes_acesso where user_id='00000000-0000-0000-0000-000000000101'),'Auth cria solicitação pendente');
select teste.ok(not exists(select 1 from hospital.perfis where user_id='00000000-0000-0000-0000-000000000101'),'metadata não concede cargo nem acesso');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',false);
select teste.erro('select public.ep_meu_perfil()','42501','conta pendente não entra na gestão');
select teste.erro('select public.ep_listar_solicitacoes()','42501','conta pendente não lê solicitações');
select teste.erro('select public.ep_decidir_solicitacao(''00000000-0000-0000-0000-000000000101'',''aprovar'',''super_admin'')','42501','conta pendente não se aprova');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select teste.erro('select public.ep_listar_solicitacoes()','42501','admin de setor não analisa contas');
select teste.erro('select public.ep_decidir_solicitacao(''00000000-0000-0000-0000-000000000101'',''aprovar'',''visualizador'')','42501','admin de setor não aprova contas');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select teste.ok(exists(select 1 from jsonb_array_elements(public.ep_listar_solicitacoes()) s where s->>'email'='nova@example.invalid'),'superadmin vê solicitante e email');
select teste.erro('select public.ep_listar_solicitacoes(''invalida'')','22023','situação da fila validada');
select teste.erro('select public.ep_decidir_solicitacao(''00000000-0000-0000-0000-000000000101'',''aprovar'',''super_admin'')','22023','aprovação não cria superadmin');
select teste.erro('select public.ep_decidir_solicitacao(''00000000-0000-0000-0000-000000000103'',''aprovar'',''admin_setor'')','22023','aprovação exige setor para admin de setor');
select teste.erro('select public.ep_decidir_solicitacao(''00000000-0000-0000-0000-000000000102'',''rejeitar'')','22023','rejeição exige motivo');
select teste.erro('select public.ep_decidir_solicitacao(''00000000-0000-0000-0000-000000000101'',''aprovar'',''visualizador'',null,''indevido'')','22023','aprovação rejeita campos de rejeição');
select teste.ok(public.ep_decidir_solicitacao('00000000-0000-0000-0000-000000000101','aprovar','visualizador')->>'situacao'='aprovada','superadmin aprova função inferior');
select teste.erro('select public.ep_decidir_solicitacao(''00000000-0000-0000-0000-000000000101'',''rejeitar'',null,null,''Decisão repetida'')','40001','segunda decisão não sobrescreve primeira');
select teste.ok(public.ep_decidir_solicitacao('00000000-0000-0000-0000-000000000102','rejeitar',null,null,'Vínculo não confirmado')->>'situacao'='rejeitada','superadmin rejeita sem conceder acesso');
select teste.ok(public.ep_decidir_solicitacao('00000000-0000-0000-0000-000000000103','aprovar','admin_setor',:'aprovacao_pa')->>'situacao'='aprovada','aprovação vincula setor');
select public.ep_definir_perfil('00000000-0000-0000-0000-000000000104','Conta manual','gestao');
select teste.ok(not exists(select 1 from jsonb_array_elements(public.ep_listar_solicitacoes()) s where s->>'user_id'='00000000-0000-0000-0000-000000000104'),'concessão manual retira da fila pendente');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',false);
select teste.ok(public.ep_meu_perfil()->>'papel'='visualizador','conta aprovada recebe apenas perfil definido');
select teste.erro('select public.ep_listar_solicitacoes()','42501','visualizador aprovado não administra contas');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000102',false);
select teste.erro('select public.ep_meu_perfil()','42501','conta rejeitada segue sem acesso');
reset role;
select teste.ok((select decidido_por='00000000-0000-0000-0000-000000000001' from hospital.solicitacoes_acesso where user_id='00000000-0000-0000-0000-000000000101'),'decisão registra superadmin responsável');
select teste.ok((select count(*)=3 from hospital.auditoria where acao='decidir_solicitacao'),'decisões auditadas uma vez');
select teste.ok(not exists(select 1 from hospital.auditoria where acao='decidir_solicitacao' and detalhes::text like '%example.invalid%'),'auditoria não replica email nem motivo');
set role anon;
select teste.erro('select public.ep_listar_solicitacoes()','42501','fila não é pública');
select teste.erro('select * from hospital.solicitacoes_acesso','42501','sem acesso direto à fila');
reset role;
