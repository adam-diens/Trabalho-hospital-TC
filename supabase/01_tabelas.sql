-- 01 - Tabelas, tipos e indices
-- Rode no SQL Editor do Supabase, na ordem 01 > 02 > 03 > 04.

create extension if not exists pgcrypto;

do $$ begin
  create type perfil as enum ('super_admin','admin_setor','gestao','ouvidoria','visualizador');
exception when duplicate_object then null; end $$;

-- ========== TABELAS ==========
create table if not exists setores(
  id serial primary key, slug text unique not null, nome text not null,
  limite_ouvidoria smallint not null default 2,   -- nota <= limite abre o caminho da Ouvidoria
  ativo boolean not null default true);

create table if not exists perfis(
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome text, perfil perfil not null, setor_id int references setores(id));

create table if not exists perguntas(
  id serial primary key, setor_id int references setores(id), -- null = todos os setores
  etapa text not null, texto text not null, obrigatoria boolean not null default false,
  ordem int not null default 0, ativa boolean not null default true);

create table if not exists respostas(
  id uuid primary key default gen_random_uuid(),
  setor_id int not null references setores(id),
  criado_em timestamptz not null default now(),
  turno text not null, nota smallint not null check (nota between 1 and 5),
  nps smallint not null,                       -- nota convertida para 0-10
  jornada jsonb not null default '{}',         -- {"Recepção":4,...}
  tipo text check (tipo in ('elogio','reclamacao','sugestao')),
  comentario text check (char_length(comentario) <= 1000),
  publicavel boolean not null default false,   -- elogio liberado para o TV Wall
  origem text not null default 'qr');
create index if not exists respostas_idx on respostas(setor_id, criado_em);

create sequence if not exists protocolo_seq;
create table if not exists contatos(
  resposta_id uuid primary key references respostas(id) on delete cascade,
  protocolo text unique not null, telefone text, observacao text,
  aceite_lgpd boolean not null, aceite_em timestamptz not null default now(),
  contatado boolean not null default false, contatado_em timestamptz, contatado_por uuid,
  relato text, fechado_em timestamptz, fechado_por uuid);

create table if not exists escala(               -- escala de trabalho mensal
  id serial primary key, setor_id int not null references setores(id),
  data date not null, turno text not null, equipe text not null);

create table if not exists auditoria(
  id bigserial primary key, user_id uuid, acao text, alvo text, em timestamptz default now());
