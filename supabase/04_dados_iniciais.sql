-- 04 - Dados iniciais (setores e perguntas)
-- Rode no SQL Editor do Supabase, na ordem 01 > 02 > 03 > 04.

-- ========== DADOS INICIAIS ==========
insert into setores(slug,nome) values ('pa','Pronto Atendimento'),('int','Internação'),('rx','Raio-X'),('lab','Laboratório') on conflict do nothing;
insert into perguntas(setor_id,etapa,texto,obrigatoria,ordem)
select null,'Geral','Como foi sua experiência no hospital?',true,0 where not exists (select 1 from perguntas where etapa='Geral');
insert into perguntas(setor_id,etapa,texto,ordem)
select s.id, e.etapa, 'Como foi o atendimento: '||e.etapa||'?', e.ordem
from (values ('pa','Recepção',1),('pa','Triagem',2),('pa','Enfermagem',3),('pa','Médico',4),
             ('int','Recepção',1),('int','Enfermagem',2),('int','Médico',3),
             ('rx','Recepção',1),('rx','Realização do exame',2),
             ('lab','Recepção',1),('lab','Coleta',2)) e(slug,etapa,ordem)
join setores s on s.slug=e.slug
where not exists (select 1 from perguntas p where p.setor_id=s.id and p.etapa=e.etapa);
