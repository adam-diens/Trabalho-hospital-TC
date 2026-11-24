-- Mensagens institucionais enviadas pela página pública de contato.
begin;
create table hospital.mensagens_contato (
  id uuid primary key default gen_random_uuid(),
  origem_hash text not null check (origem_hash ~ '^[a-f0-9]{64}$'),
  nome text not null check (length(trim(nome)) between 2 and 120),
  email text not null check (length(email) between 3 and 254),
  assunto text not null check (length(trim(assunto)) between 3 and 120),
  mensagem text not null check (length(trim(mensagem)) between 10 and 3000),
  criado_em timestamptz not null default now()
);
create index mensagens_contato_criado_idx on hospital.mensagens_contato(criado_em);

create function public.ep_enviar_contato(
  p_origem_hash text,p_nome text,p_email text,p_assunto text,p_mensagem text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare janela timestamptz := date_bin(interval '1 hour',statement_timestamp(),timestamptz '2000-01-01 UTC'); n int;
begin
  if p_origem_hash is null or p_origem_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Origem inválida' using errcode='22023';
  end if;
  insert into hospital.limites_coleta(chave,janela,quantidade)
    values('contato:'||p_origem_hash,janela,1)
    on conflict(chave,janela) do update set quantidade=hospital.limites_coleta.quantidade+1
    returning quantidade into n;
  if n>5 then raise exception 'Limite temporário de contato atingido' using errcode='P0001'; end if;
  insert into hospital.mensagens_contato(origem_hash,nome,email,assunto,mensagem)
    values(p_origem_hash,trim(p_nome),lower(trim(p_email)),trim(p_assunto),trim(p_mensagem));
  return jsonb_build_object('recebida',true);
end $$;
revoke all on function public.ep_enviar_contato(text,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.ep_enviar_contato(text,text,text,text,text) to service_role;
commit;
