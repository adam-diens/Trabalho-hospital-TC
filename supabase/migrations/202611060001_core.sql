-- Banco v2. Instalação limpa, PostgreSQL 15+ / Supabase. Executar em ordem.
begin;
-- Instalação exige banco de domínio limpo. Preserve os schemas nativos do Supabase.
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public'
             and table_name in ('respostas','perfis','contatos','escala','perguntas','setores')) then
    raise exception 'Banco legado detectado. Use um projeto de homologação limpo; consulte README.md.';
  end if;
end $$;

create schema hospital;
revoke create on schema public from public, anon, authenticated, service_role;
revoke all on schema hospital from public, anon, authenticated, service_role;
-- Somente RPCs explicitamente concedidas ficam acessíveis. Nenhuma tabela via Data API.
alter default privileges in schema hospital revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema hospital revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges in schema hospital revoke execute on functions from public, anon, authenticated, service_role;

create type hospital.papel as enum ('super_admin','admin_setor','gestao','ouvidoria','visualizador');
create type hospital.metrica as enum ('rostos_5','nota_10');
create type hospital.turno as enum ('manha','tarde','noite');
create type hospital.tipo_manifestacao as enum ('elogio','reclamacao','sugestao','retorno');
create type hospital.situacao as enum ('aberta','em_atendimento','encerrada');

create table hospital.avisos_privacidade (
  versao text primary key check (length(trim(versao)) between 1 and 80),
  texto text not null check (length(trim(texto)) between 30 and 10000),
  criado_em timestamptz not null default now()
);
create table hospital.configuracao (
  id boolean primary key default true check (id),
  fuso text not null default 'America/Sao_Paulo' check (fuso='America/Sao_Paulo'),
  privacidade_versao text not null references hospital.avisos_privacidade(versao),
  privacidade_texto text not null check (length(trim(privacidade_texto)) between 30 and 10000),
  coleta_habilitada boolean not null default false,
  retencao_contato_dias int not null default 90 check (retencao_contato_dias between 1 and 3650),
  minimo_grupo int not null default 5 check (minimo_grupo >= 5),
  limite_origem_10min int not null default 15 check (limite_origem_10min between 1 and 1000),
  limite_setor_10min int not null default 300 check (limite_setor_10min between 10 and 10000)
);
create table hospital.setores (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z][a-z0-9_-]{1,39}$'),
  nome text not null check (length(trim(nome)) between 2 and 120),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create table hospital.perfis (
  user_id uuid primary key references auth.users(id) on delete restrict,
  nome text not null check (length(trim(nome)) between 2 and 120),
  papel hospital.papel not null,
  setor_id uuid references hospital.setores(id) on delete restrict,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now(),
  check ((papel='admin_setor' and setor_id is not null) or (papel<>'admin_setor' and setor_id is null))
);
create index perfis_setor_idx on hospital.perfis(setor_id) where setor_id is not null;

create table hospital.questionarios (
  id uuid primary key default gen_random_uuid(),
  setor_id uuid not null references hospital.setores(id) on delete restrict,
  versao int not null check (versao > 0),
  metrica hospital.metrica not null,
  limite_ouvidoria int not null,
  publicado boolean not null default false,
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete restrict,
  unique (setor_id,versao), unique (id,setor_id),
  check ((metrica='rostos_5' and limite_ouvidoria between 1 and 4) or
         (metrica='nota_10' and limite_ouvidoria between 1 and 9))
);
create unique index questionarios_publicado_idx on hospital.questionarios(setor_id) where publicado;
create table hospital.perguntas (
  id uuid primary key default gen_random_uuid(),
  questionario_id uuid not null references hospital.questionarios(id) on delete restrict,
  chave text not null check (chave ~ '^[a-z][a-z0-9_]{0,49}$'),
  texto text not null check (length(trim(texto)) between 8 and 300),
  metrica hospital.metrica not null default 'rostos_5',
  geral boolean not null default false,
  ordem int not null check (ordem between 0 and 30),
  unique (questionario_id,chave), unique (questionario_id,ordem), unique (id,questionario_id)
);
create unique index perguntas_geral_idx on hospital.perguntas(questionario_id) where geral;

create table hospital.equipes (
  id uuid primary key default gen_random_uuid(),
  setor_id uuid not null references hospital.setores(id) on delete restrict,
  nome text not null check (length(trim(nome)) between 2 and 120),
  ativa boolean not null default true,
  unique (setor_id,nome), unique (id,setor_id)
);
-- Uma equipe operacional por setor/data/turno: impede multiplicar respostas em joins.
-- A composição nominal de profissionais não é necessária para esta pesquisa.
create table hospital.escalas (
  id uuid primary key default gen_random_uuid(),
  setor_id uuid not null references hospital.setores(id) on delete restrict,
  equipe_id uuid not null,
  data date not null,
  turno hospital.turno not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete restrict,
  foreign key (equipe_id,setor_id) references hospital.equipes(id,setor_id) on delete restrict,
  unique (setor_id,data,turno)
);
create index escalas_equipe_idx on hospital.escalas(equipe_id);

create table hospital.respostas (
  id uuid primary key default gen_random_uuid(),
  chave_envio uuid not null unique,
  conteudo_hash text not null,
  setor_id uuid not null references hospital.setores(id) on delete restrict,
  questionario_id uuid not null,
  metrica hospital.metrica not null,
  nota smallint not null,
  criado_em timestamptz not null default now(),
  data_local date not null,
  turno hospital.turno not null,
  canal text not null check (canal in ('celular','tablet')),
  privacidade_versao text not null references hospital.avisos_privacidade(versao),
  foreign key (questionario_id,setor_id) references hospital.questionarios(id,setor_id) on delete restrict,
  unique (id,questionario_id),
  check ((metrica='rostos_5' and nota between 1 and 5) or (metrica='nota_10' and nota between 1 and 10))
);
create index respostas_filtro_idx on hospital.respostas(setor_id,criado_em,turno);
create index respostas_data_idx on hospital.respostas(data_local,metrica);
create index respostas_questionario_idx on hospital.respostas(questionario_id);
create table hospital.avaliacoes_etapas (
  resposta_id uuid not null,
  questionario_id uuid not null,
  pergunta_id uuid not null,
  metrica hospital.metrica not null,
  nota smallint not null,
  check ((metrica='rostos_5' and nota between 1 and 5) or (metrica='nota_10' and nota between 1 and 10)),
  primary key (resposta_id,pergunta_id),
  foreign key (resposta_id,questionario_id) references hospital.respostas(id,questionario_id) on delete restrict,
  foreign key (pergunta_id,questionario_id) references hospital.perguntas(id,questionario_id) on delete restrict
);
create index avaliacoes_pergunta_idx on hospital.avaliacoes_etapas(pergunta_id,questionario_id);
create table hospital.manifestacoes (
  id uuid primary key default gen_random_uuid(),
  resposta_id uuid not null unique references hospital.respostas(id) on delete restrict,
  protocolo bigint generated always as identity unique,
  tipo hospital.tipo_manifestacao not null,
  comentario text,
  check ((tipo='retorno' and comentario is null) or
         (tipo<>'retorno' and comentario is not null and length(trim(comentario)) between 1 and 2000)),
  situacao hospital.situacao not null default 'aberta',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  revisao int not null default 1 check (revisao>0),
  encerrado_em timestamptz,
  encerrado_por uuid references auth.users(id) on delete restrict,
  check ((situacao='encerrada' and encerrado_em is not null and encerrado_por is not null)
      or (situacao<>'encerrada' and encerrado_em is null and encerrado_por is null))
);
create index manifestacoes_fila_idx on hospital.manifestacoes(situacao,criado_em,id);
create table hospital.contatos (
  manifestacao_id uuid primary key references hospital.manifestacoes(id) on delete restrict,
  telefone text check (telefone ~ '^[1-9][0-9]{9,10}$'),
  consentimento boolean not null check (consentimento),
  consentimento_versao text not null references hospital.avisos_privacidade(versao),
  consentimento_em timestamptz not null default now(),
  expurgado_em timestamptz,
  check ((telefone is not null and expurgado_em is null) or (telefone is null and expurgado_em is not null))
);
create table hospital.interacoes (
  id bigint generated always as identity primary key,
  manifestacao_id uuid not null references hospital.manifestacoes(id) on delete restrict,
  autor_id uuid not null references auth.users(id) on delete restrict,
  relato text not null check (length(trim(relato)) between 3 and 4000),
  situacao hospital.situacao not null,
  criado_em timestamptz not null default now()
);
create index interacoes_manifestacao_idx on hospital.interacoes(manifestacao_id,id);
create index interacoes_autor_idx on hospital.interacoes(autor_id);
create index questionarios_autor_idx on hospital.questionarios(criado_por) where criado_por is not null;
create index escalas_autor_idx on hospital.escalas(atualizado_por) where atualizado_por is not null;
create index manifestacoes_autor_idx on hospital.manifestacoes(encerrado_por) where encerrado_por is not null;
create table hospital.auditoria (
  id bigint generated always as identity primary key,
  ator_id uuid references auth.users(id) on delete restrict,
  acao text not null,
  entidade text not null,
  alvo text,
  detalhes jsonb not null default '{}',
  criado_em timestamptz not null default now()
);
create index auditoria_ator_idx on hospital.auditoria(ator_id,criado_em);
create table hospital.limites_coleta (
  chave text not null,
  janela timestamptz not null,
  quantidade int not null check (quantidade > 0),
  primary key (chave,janela)
);
create table hospital.tv_publicacoes (
  metrica hospital.metrica primary key,
  n bigint not null check (n>=5),
  media numeric not null,
  satisfacao numeric not null,
  total_coletado bigint not null,
  publicado_em timestamptz not null,
  inicio date not null,
  fim date not null
);

-- Triggers preservam as invariantes também em alterações administrativas.
create function hospital.validar_resposta() returns trigger language plpgsql set search_path='' as $$
declare q hospital.questionarios; ts timestamptz := statement_timestamp(); h int;
begin
  select * into q from hospital.questionarios where id=new.questionario_id;
  if q.id is null or q.metrica is distinct from new.metrica or q.setor_id is distinct from new.setor_id then
    raise exception 'Questionário, setor ou métrica incompatível' using errcode='23514';
  end if;
  new.criado_em := ts; new.data_local := (ts at time zone 'America/Sao_Paulo')::date;
  h := extract(hour from ts at time zone 'America/Sao_Paulo');
  new.turno := case when h between 7 and 12 then 'manha'::hospital.turno
                   when h between 13 and 18 then 'tarde'::hospital.turno else 'noite'::hospital.turno end;
  return new;
end $$;
create trigger validar_resposta before insert on hospital.respostas for each row execute function hospital.validar_resposta();
create function hospital.impedir_alteracao() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Registro imutável: publique uma nova versão ou registre uma interação' using errcode='23514'; end $$;
create trigger respostas_imutaveis before update or delete on hospital.respostas for each row execute function hospital.impedir_alteracao();
create trigger etapas_imutaveis before update or delete on hospital.avaliacoes_etapas for each row execute function hospital.impedir_alteracao();
create trigger auditoria_imutavel before update or delete on hospital.auditoria for each row execute function hospital.impedir_alteracao();
create trigger interacoes_imutaveis before update or delete on hospital.interacoes for each row execute function hospital.impedir_alteracao();
create trigger avisos_imutaveis before update or delete on hospital.avisos_privacidade for each row execute function hospital.impedir_alteracao();
create function hospital.validar_etapa() returns trigger language plpgsql set search_path='' as $$
begin
  if exists(select 1 from hospital.perguntas where id=new.pergunta_id and geral) then
    raise exception 'Pergunta geral não é etapa opcional' using errcode='23514';
  end if;
  if not exists(select 1 from hospital.perguntas where id=new.pergunta_id and metrica=new.metrica) then
    raise exception 'Escala da etapa incompatível' using errcode='23514';
  end if;
  return new;
end $$;
create trigger validar_etapa before insert on hospital.avaliacoes_etapas for each row execute function hospital.validar_etapa();
create function hospital.proteger_questionario() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then
    if new.publicado then raise exception 'Insira como rascunho e publique após criar as perguntas' using errcode='23514'; end if;
    return new;
  end if;
  if tg_op='DELETE' or new.setor_id is distinct from old.setor_id or new.versao is distinct from old.versao
     or new.metrica is distinct from old.metrica or new.limite_ouvidoria is distinct from old.limite_ouvidoria then
    raise exception 'Questionário imutável: crie uma versão' using errcode='23514';
  end if;
  if new.publicado and (select count(*) from hospital.perguntas where questionario_id=new.id and geral)<>1 then
    raise exception 'É necessária exatamente uma pergunta geral' using errcode='23514';
  end if;
  return new;
end $$;
create trigger proteger_questionario before insert or update or delete on hospital.questionarios for each row execute function hospital.proteger_questionario();
create function hospital.proteger_pergunta() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op<>'INSERT' then
    raise exception 'Perguntas imutáveis: crie uma versão' using errcode='23514';
  end if;
  if exists(select 1 from hospital.questionarios where id=new.questionario_id and publicado) or
     exists(select 1 from hospital.respostas where questionario_id=new.questionario_id) then
    raise exception 'Questionário já publicado ou respondido' using errcode='23514';
  end if;
  return new;
end $$;
create trigger proteger_pergunta before insert or update or delete on hospital.perguntas for each row execute function hospital.proteger_pergunta();

-- Defesa adicional: sem policies e sem grants, nenhum cliente lê tabelas internas.
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname='hospital' loop
    execute format('alter table hospital.%I enable row level security',t.tablename);
  end loop;
end $$;
revoke all on all tables in schema hospital from public, anon, authenticated, service_role;
revoke all on all sequences in schema hospital from public, anon, authenticated, service_role;
revoke execute on all functions in schema hospital from public, anon, authenticated, service_role;
commit;
