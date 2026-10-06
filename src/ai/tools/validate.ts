import type { JSONSchema } from '@/ai/llm/types';

/**
 * Checks a tool input against the subset of JSON Schema the tools use
 * (object properties, required, type, enum, pattern-free strings, numbers
 * with min/max, arrays). Returns readable problems, or [] when valid, so a
 * model that sends bad arguments gets an error it can correct instead of a
 * crash deep inside a repository call.
 */
export function validateInput(schema: JSONSchema, input: unknown, path = 'input'): string[] {
  const problems: string[] = [];
  const types = schema.type === undefined ? [] : Array.isArray(schema.type) ? schema.type : [schema.type];

  if (types.length > 0 && !types.some((t) => matchesType(t, input))) {
    return [`${path} must be ${types.join(' or ')}`];
  }
  if (schema.enum && !schema.enum.includes(input as string | number)) {
    problems.push(`${path} must be one of ${schema.enum.map((v) => JSON.stringify(v)).join(', ')}`);
  }
  if (typeof input === 'number') {
    if (schema.minimum !== undefined && input < schema.minimum) problems.push(`${path} must be ≥ ${schema.minimum}`);
    if (schema.maximum !== undefined && input > schema.maximum) problems.push(`${path} must be ≤ ${schema.maximum}`);
  }
  if (isObject(input) && schema.properties) {
    for (const key of schema.required ?? []) {
      if (input[key] === undefined || input[key] === null) problems.push(`${path}.${key} is required`);
    }
    for (const [key, value] of Object.entries(input)) {
      const propertySchema = schema.properties[key];
      if (!propertySchema) {
        if (schema.additionalProperties === false) problems.push(`${path}.${key} is not a known field`);
        continue;
      }
      if (value === undefined || value === null) continue;
      problems.push(...validateInput(propertySchema, value, `${path}.${key}`));
    }
  }
  if (Array.isArray(input) && schema.items) {
    input.forEach((item, i) => problems.push(...validateInput(schema.items as JSONSchema, item, `${path}[${i}]`)));
  }
  return problems;
}

function matchesType(type: string, value: unknown): boolean {
  switch (type) {
    case 'object':
      return isObject(value);
    case 'array':
      return Array.isArray(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'null':
      return value === null;
    default:
      return typeof value === type;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
