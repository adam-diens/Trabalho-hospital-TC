const fs = require('node:fs');
const path = require('node:path');
const { openapi } = require('../backend/openapi.cjs');
// JSON é um subconjunto de YAML; mantém o nome usado pelo repositório e ferramentas OpenAPI.
fs.writeFileSync(path.resolve(__dirname, '../backend/openapi.yaml'), JSON.stringify(openapi, null, 2) + '\n');
console.log('OpenAPI v2 atualizado a partir das mesmas rotas e schemas usados pela API.');
