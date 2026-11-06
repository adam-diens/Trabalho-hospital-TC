begin;
insert into hospital.avisos_privacidade(versao,texto) values('rascunho',
 'Coleta desabilitada. O hospital deve publicar aqui seu aviso de privacidade e definir a retenção antes de habilitar a pesquisa.');
insert into hospital.configuracao(privacidade_versao,privacidade_texto)
select versao,texto from hospital.avisos_privacidade where versao='rascunho';
insert into hospital.setores(slug,nome) values
 ('pa','Pronto Atendimento'),('int','Internação'),('enfermagem','Enfermagem'),
 ('lab','Laboratório'),('rx','Raio-X'),('refeitorio','Refeitório');
do $$ declare s record; qid uuid; etapa record;
begin
  for s in select id,slug from hospital.setores loop
    insert into hospital.questionarios(setor_id,versao,metrica,limite_ouvidoria)
      values(s.id,1,'rostos_5',2) returning id into qid;
    insert into hospital.perguntas(questionario_id,chave,texto,metrica,geral,ordem)
      values(qid,'geral','Como você avalia sua experiência geral no hospital?','rostos_5',true,0);
    for etapa in select * from (values
      ('pa','recepcao','Como foi o acolhimento na recepção?',1),
      ('pa','triagem','Como foi sua experiência na triagem?',2),
      ('pa','enfermagem','Como foi o cuidado da equipe de enfermagem?',3),
      ('pa','medico','Como foi o atendimento médico?',4),
      ('pa','orientacoes','As orientações recebidas foram claras?',5),
      ('int','admissao','Como foi o processo de internação?',1),
      ('int','enfermagem','Como foi o cuidado da equipe de enfermagem?',2),
      ('int','medico','Como foi o atendimento da equipe médica?',3),
      ('int','conforto','Como avalia o conforto do quarto e do leito?',4),
      ('int','limpeza','Como avalia a limpeza e organização do ambiente?',5),
      ('enfermagem','acolhimento','Como foi o acolhimento da equipe de enfermagem?',1),
      ('enfermagem','atencao','Como foi a atenção da equipe durante o cuidado?',2),
      ('enfermagem','disponibilidade','Quando chamou, a equipe respondeu em tempo adequado?',3),
      ('enfermagem','orientacoes','As orientações da equipe de enfermagem foram claras?',4),
      ('enfermagem','respeito','Você se sentiu respeitado e bem cuidado pela equipe?',5),
      ('lab','recepcao','Como foi o acolhimento na recepção do laboratório?',1),
      ('lab','orientacao','As orientações para o exame foram claras?',2),
      ('lab','espera','Como avalia o tempo de espera para o exame?',3),
      ('lab','coleta','Como foi o atendimento durante a coleta ou exame?',4),
      ('lab','ambiente','Como avalia a limpeza e organização do laboratório?',5),
      ('rx','recepcao','Como foi o acolhimento na recepção do Raio-X?',1),
      ('rx','orientacao','As orientações para o exame foram claras?',2),
      ('rx','espera','Como avalia o tempo de espera para o exame?',3),
      ('rx','exame','Como foi o atendimento durante o exame?',4),
      ('rx','ambiente','Como avalia a limpeza e organização do ambiente?',5),
      ('refeitorio','acolhimento','Como foi o atendimento no refeitório?',1),
      ('refeitorio','sabor','Como avalia o sabor da refeição?',2),
      ('refeitorio','temperatura','A refeição estava na temperatura adequada?',3),
      ('refeitorio','variedade','Como avalia a variedade das refeições?',4),
      ('refeitorio','higiene','Como avalia a limpeza do refeitório?',5)
    ) as itens(slug,chave,texto,ordem) where slug=s.slug loop
      insert into hospital.perguntas(questionario_id,chave,texto,metrica,ordem)
        values(qid,etapa.chave,etapa.texto,'rostos_5',etapa.ordem);
    end loop;
    update hospital.questionarios set publicado=true where id=qid;
  end loop;
end $$;
commit;
