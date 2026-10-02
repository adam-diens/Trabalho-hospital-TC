-- 05 - Primeiro Super Admin
-- Antes: crie seu login em Authentication > Users > Add user. Depois troque o e-mail abaixo e rode.
insert into perfis(user_id, nome, perfil)
select id, 'Seu nome', 'super_admin' from auth.users where email = 'seu@email.com'
on conflict (user_id) do update set perfil = 'super_admin';
