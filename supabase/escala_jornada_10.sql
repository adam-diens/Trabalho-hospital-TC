-- Aplicar após schema.sql e correcoes_seguranca.sql.
-- Preserva as notas existentes; novas avaliações de etapas usam inteiros de 1 a 10.
create or replace function complementar_resposta(p_id uuid, p_jornada jsonb default null, p_tipo text default null, p_comentario text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  if p_jornada is not null and (jsonb_typeof(p_jornada)<>'object' or octet_length(p_jornada::text)>2000
     or exists (select 1 from jsonb_each(p_jornada) j where jsonb_typeof(j.value)<>'number' or ((j.value::text)::numeric not between 1 and 10 or (j.value::text)::numeric <> trunc((j.value::text)::numeric))))
  then raise exception 'jornada inválida'; end if;
  update respostas set jornada = jornada || coalesce(p_jornada,'{}'::jsonb),
         tipo = coalesce(p_tipo, tipo),
         comentario = coalesce(nullif(limpar_pii(left(trim(p_comentario),1000)),''), comentario)
   where id=p_id and criado_em > now() - interval '2 hours';
  if not found then raise exception 'resposta não encontrada ou expirada'; end if;
end $$;
