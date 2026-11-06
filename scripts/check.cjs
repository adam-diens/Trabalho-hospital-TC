// Verificações locais de código/contrato, sem carregar .env nem conectar ao banco.
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const sources=['app.js'];
for(const folder of ['assets/js','backend','scripts','tests/backend','tests/database','tests/frontend']) {
  for(const entry of fs.readdirSync(path.join(root,folder)))if(/\.(?:js|cjs)$/.test(entry))sources.push(folder+'/'+entry);
}
for(const file of sources)execFileSync(process.execPath,['--check',path.join(root,file)],{stdio:'pipe'});
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'backend/openapi.yaml'),'utf8')),require('../backend/openapi.cjs').openapi,
  'OpenAPI desatualizado: executar npm run api:spec e versionar o resultado.');
for(const file of ['index.html','app.js','styles.css','tablet.css',...sources.filter(f=>f.startsWith('assets/'))]) {
  const content=fs.readFileSync(path.join(root,file),'utf8');
  assert.ok(!/sb_secret_[a-zA-Z0-9_-]{20,}/.test(content),'Segredo em arquivo público: '+file);
  for(const match of content.matchAll(/(?:from\s+|import\s*\()\s*['"](\.[^'"]+)['"]/g)) {
    const target=path.resolve(root,path.dirname(file),match[1]);
    assert.ok(target.startsWith(root+path.sep)&&fs.existsSync(target),'Import inexistente: '+file+' → '+match[1]);
    assert.ok(fs.readdirSync(path.dirname(target)).includes(path.basename(target)),'Nome de import incompatível com Linux: '+target);
  }
}
console.log(`OK: sintaxe de ${sources.length} arquivos, contrato OpenAPI e arquivos públicos.`);
