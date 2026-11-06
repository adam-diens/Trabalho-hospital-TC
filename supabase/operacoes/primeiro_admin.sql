-- SQL Editor, como proprietário. Crie e confirme primeiro o usuário no Supabase Auth.
-- Substitua o UUID e nome. Não usa senha nem concede perfil automaticamente a cadastros.
begin;
do $$
declare usuario uuid := '00000000-0000-0000-0000-000000000000';
        nome_admin text := 'Administrador inicial';
begin
  perform pg_advisory_xact_lock(716025001);
  if exists(select 1 from hospital.perfis where papel='super_admin' and ativo) then
    raise exception 'Já existe superadministrador. Use ep_definir_perfil.';
  end if;
  if not exists(select 1 from auth.users where id=usuario) then
    raise exception 'Substitua usuario pelo UUID de uma conta existente no Supabase Auth.';
  end if;
  insert into hospital.perfis(user_id,nome,papel) values(usuario,nome_admin,'super_admin');
  insert into hospital.auditoria(ator_id,acao,entidade,alvo)
    values(usuario,'bootstrap_super_admin','perfis',usuario::text);
end $$;
commit;
