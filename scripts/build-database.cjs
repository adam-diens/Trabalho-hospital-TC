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
  const sql = fs.readFileSync(path.join(source, file), 'utf8').replace(/\r\n/g, '\n');
  if (!/^begin;\n/.test(sql) && !/^--[^\n]*\n(?:--[^\n]*\n)*begin;\n/.test(sql)) throw new Error(`Transação inicial ausente: ${file}`);
  if (!/\ncommit;\s*$/.test(sql)) throw new Error(`Commit final ausente: ${file}`);
  manifest.push({ arquivo: file, sha256: crypto.createHash('sha256').update(sql).digest('hex') });
  return `-- MIGRATION: ${file}\n${sql.replace(/^begin;\n/m, '').replace(/\ncommit;\s*$/, '')}`;
});
const output = path.join(root, 'output', 'database');
fs.mkdirSync(output, { recursive: true });
const bundle = '-- GERADO por npm run db:bundle. Não editar; altere as migrations.\n' +
  '-- Instalação limpa. Recusa tabelas legadas. Nenhuma operação de exclusão.\n' +
  "begin;\nset local lock_timeout='5s';\nset local statement_timeout='120s';\n\n" + bodies.join('\n\n') + '\n\ncommit;\n';
fs.writeFileSync(path.join(output, 'instalar.sql'), bundle, 'utf8');
fs.writeFileSync(path.join(output, 'manifesto.json'), JSON.stringify({ migrations: manifest, instalador_sha256: crypto.createHash('sha256').update(bundle).digest('hex') }, null, 2) + '\n');
console.log(`Instalador gerado: ${path.join(output, 'instalar.sql')}`);
