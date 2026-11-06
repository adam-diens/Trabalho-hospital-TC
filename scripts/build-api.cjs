const fs = require('node:fs');
const path = require('node:path');
const { openapi } = require('../backend/openapi.cjs');
// JSON válido também pode ser consumido como YAML pelas ferramentas OpenAPI.
fs.writeFileSync(path.resolve(__dirname, '../backend/openapi.yaml'), JSON.stringify(openapi, null, 2) + '\n');
console.log('OpenAPI v2 atualizado a partir das mesmas rotas e schemas usados pela API.');
