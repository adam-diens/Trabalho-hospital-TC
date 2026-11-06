const { ApiError } = require('./errors.cjs');
const string = (min = 1, max = 120, extra = {}) => ({ type: 'string', minLength: min, maxLength: max, ...extra });
const uuid = { type: 'string', format: 'uuid', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' };
const date = { type: 'string', format: 'date', pattern: '^\\d{4}-\\d{2}-\\d{2}$' };
const integer = (min, max) => ({ type: 'integer', minimum: min, maximum: max });
const enumeration = values => ({ type: 'string', enum: values });
const nullable = schema => ({ anyOf: [schema, { type: 'null' }] });
const object = (properties, required = [], extra = {}) => ({ type: 'object', properties, required, additionalProperties: false, ...extra });
const boolean = { type: 'boolean' };
function invalid(field) { throw new ApiError(400, 'INVALID_INPUT', `Campo inválido: ${field}.`); }
function validate(value, schema, field = 'dados') {
  if (schema.anyOf) {
    for (const candidate of schema.anyOf) { try { return validate(value, candidate, field); } catch (error) { if (!(error instanceof ApiError)) throw error; } }
    invalid(field);
  }
  if (value === null) { if (schema.type !== 'null') invalid(field); return value; }
  if (schema.type === 'null') invalid(field);
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(field);
    const keys = Object.keys(value);
    if (schema.maxProperties !== undefined && keys.length > schema.maxProperties) invalid(field);
    for (const key of schema.required || []) if (!Object.hasOwn(value, key)) invalid(`${field}.${key}`);
    for (const key of keys) {
      const child = schema.properties && Object.hasOwn(schema.properties, key) ? schema.properties[key] : undefined;
      if (!child && schema.additionalProperties === false) invalid(`${field}.${key}`);
      if (child || typeof schema.additionalProperties === 'object') validate(value[key], child || schema.additionalProperties, `${field}.${key}`);
      if (schema.propertyNames?.pattern && !new RegExp(schema.propertyNames.pattern).test(key)) invalid(`${field}.${key}`);
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value) || value.length > (schema.maxItems ?? Infinity)) invalid(field);
    value.forEach((item, index) => validate(item, schema.items, `${field}[${index}]`));
  } else if (schema.type === 'integer') {
    if (!Number.isSafeInteger(value) || value < schema.minimum || value > schema.maximum) invalid(field);
  } else if (schema.type === 'string') {
    if (typeof value !== 'string' || value.length < (schema.minLength ?? 0) || value.length > (schema.maxLength ?? Infinity) ||
        (schema.pattern && !new RegExp(schema.pattern).test(value)) || value.includes('\0')) invalid(field);
    if (schema.format === 'date') {
      const parsed = new Date(value + 'T00:00:00Z');
      if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) invalid(field);
    }
  } else if (schema.type === 'boolean' && typeof value !== 'boolean') invalid(field);
  if (schema.enum && !schema.enum.includes(value)) invalid(field);
  return value;
}
function queryValues(search, schema) {
  const data = Object.create(null);
  for (const [key, value] of search) {
    if (Object.hasOwn(data, key)) invalid(key);
    const field = schema.properties?.[key];
    if (field?.type === 'integer') {
      if (!/^\d+$/.test(value)) invalid(key);
      data[key] = Number(value);
    } else data[key] = value;
  }
  return validate(data, schema, 'consulta');
}
function period(data, maxDays = 366) {
  if (!data.inicio || !data.fim) return;
  const days = (new Date(data.fim) - new Date(data.inicio)) / 86400000 + 1;
  if (days < 1 || days > maxDays) throw new ApiError(400, 'INVALID_PERIOD', `Informe um período de até ${maxDays} dias, em ordem crescente.`);
}
module.exports = { string, uuid, date, integer, enumeration, nullable, object, boolean, validate, queryValues, period };
