// Gera um instalador para o SQL Editor a partir das migrations, sem cópias manuais.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'supabase', 'migrations');
const files = fs.readdirSync(source).filter(f => /^\d{12,}_[a-z_]+\.sql$/.test(f)).sort();
if (!files.length) throw new Error('Nenhuma migration encontrada.');
const manifest = [];
const bodies = files.map(file => {
  const sql = fs.readFileSync(path.join(source, file), 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  // Aceita indentação e linhas vazias, sem remover BEGINs de funções internas.
  const opening=/^(?:[ \t]*(?:--[^\n]*)?\n)*([ \t]*begin;[ \t]*\n)/i.exec(sql);
  const closing=/\n[ \t]*commit;[ \t]*(?:\n[ \t]*)*$/i;
  if (!opening) throw new Error(`Transação inicial ausente: ${file}`);
  if (!closing.test(sql)) throw new Error(`Commit final ausente: ${file}`);
  manifest.push({ arquivo: file, sha256: crypto.createHash('sha256').update(sql).digest('hex') });
  const start=opening[0].length-opening[1].length;
  const body=(sql.slice(0,start)+sql.slice(opening[0].length)).replace(closing,'');
  return `-- MIGRATION: ${file}\n${body}`;
});
const output = path.join(root, 'output', 'database');
fs.mkdirSync(output, { recursive: true });
const bundle = '-- GERADO por npm run db:bundle. Não editar; altere as migrations.\n' +
  '-- Instalação limpa. Recusa tabelas legadas. Nenhuma operação de exclusão.\n' +
  "begin;\nset local lock_timeout='5s';\nset local statement_timeout='120s';\n\n" + bodies.join('\n\n') + '\n\ncommit;\n';
fs.writeFileSync(path.join(output, 'instalar.sql'), bundle, 'utf8');
fs.writeFileSync(path.join(output, 'manifesto.json'), JSON.stringify({ migrations: manifest, instalador_sha256: crypto.createHash('sha256').update(bundle).digest('hex') }, null, 2) + '\n');
console.log(`Instalador gerado: ${path.join(output, 'instalar.sql')}`);
