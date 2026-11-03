# Pesquisa em tablet e administração de setores

## Pesquisa do paciente

A pesquisa tem uma pergunta geral obrigatoria e cinco perguntas opcionais especificas para o setor selecionado. As perguntas opcionais usam rostinhos de 1 a 5, aparecem uma por vez e podem ser puladas.

Para abrir a pesquisa em modo quiosque, use o código do setor com `modo=tablet`, por exemplo:

```text
?setor=pa&modo=tablet
```

Os codigos sao pa (Pronto Atendimento), int (Internacao), enfermagem, lab (Laboratorio), rx (Raio-X) e refeitorio. Cada setor tem seu link e QR Code na area QR Codes.

## Perfis e permissões

- **Administrador de setor (`admin_setor`)**: edita a pergunta do próprio setor e consulta os dados de acordo com o perfil.
- **Superadministrador (`super_admin`)**: edita a pergunta de qualquer setor e concede perfis de administrador ou superadministrador.
- A pessoa precisa ter uma conta existente no Supabase Auth. O superadministrador concede o perfil usando o e-mail e seleciona o setor.
- O banco valida usuário, perfil e setor. A interface não pode conceder permissões por conta própria.

## Banco de dados

A regra de uma pergunta ativa por setor e as RPCs protegidas `salvar_pergunta_setor` e `definir_perfil` estão aplicadas no Supabase conectado. O arquivo da migration correspondente não está nesta cópia do repositório; compare o esquema remoto antes de reaplicar scripts.

As RPCs só podem ser executadas por usuários autenticados. `salvar_pergunta_setor` limita o administrador de setor ao setor associado ao seu perfil; `definir_perfil` permite concessões apenas ao superadministrador.


## Limites antispam

A API aceita ate 15 respostas por dispositivo em QR e 100 em tablet a cada 10 minutos, com limite global de 1000 por setor no periodo.