import { z } from 'zod';
import type { ToolContext } from './types.js';

const CreateTypeInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    name: z.string().describe('Type name'),
    type: z.enum(['composite', 'domain', 'range']).describe('Type category'),
    // For composite type
    attributes: z.array(z.object({
        name: z.string(),
        data_type: z.string(),
    })).optional().describe('Attributes for composite type'),
    // For domain type
    base_type: z.string().optional().describe('Base type for domain'),
    constraint: z.string().optional().describe('CHECK constraint for domain'),
    default: z.string().optional().describe('Default value for domain'),
    not_null: z.boolean().optional().describe('NOT NULL constraint for domain'),
    // For range type
    subtype: z.string().optional().describe('Subtype for range'),
    subtype_opclass: z.string().optional().describe('Subtype operator class'),
});
type CreateTypeInput = z.infer<typeof CreateTypeInputSchema>;

const CreateTypeOutputSchema = z.object({
    success: z.boolean(),
    type_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public' },
        name: { type: 'string', description: 'Type name' },
        type: { type: 'string', enum: ['composite', 'domain', 'range'] },
        attributes: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, data_type: { type: 'string' } } } },
        base_type: { type: 'string' },
        constraint: { type: 'string' },
        default: { type: 'string' },
        not_null: { type: 'boolean' },
        subtype: { type: 'string' },
        subtype_opclass: { type: 'string' },
    },
    required: ['name', 'type'],
};

export const createTypeTool = {
    name: 'create_type',
    description: 'Creates a new composite, domain, or range type.',
    inputSchema: CreateTypeInputSchema,
    mcpInputSchema,
    outputSchema: CreateTypeOutputSchema,

    execute: async (input: CreateTypeInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, name, type, attributes, base_type, constraint, default: defaultValue, not_null, subtype, subtype_opclass } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        let sql: string;

        switch (type) {
            case 'composite':
                if (!attributes || attributes.length === 0) {
                    throw new Error('Composite type requires attributes.');
                }
                const attrsStr = attributes.map(a => `"${a.name}" ${a.data_type}`).join(', ');
                sql = `CREATE TYPE "${schema}"."${name}" AS (${attrsStr});`;
                break;

            case 'domain':
                if (!base_type) {
                    throw new Error('Domain type requires base_type.');
                }
                sql = `CREATE DOMAIN "${schema}"."${name}" AS ${base_type}`;
                if (not_null) sql += ' NOT NULL';
                if (defaultValue) sql += ` DEFAULT ${defaultValue}`;
                if (constraint) sql += ` CHECK (${constraint})`;
                sql += ';';
                break;

            case 'range':
                if (!subtype) {
                    throw new Error('Range type requires subtype.');
                }
                sql = `CREATE TYPE "${schema}"."${name}" AS RANGE (SUBTYPE = ${subtype}`;
                if (subtype_opclass) sql += `, SUBTYPE_OPCLASS = ${subtype_opclass}`;
                sql += ');';
                break;

            default:
                throw new Error(`Unknown type category: ${type}`);
        }

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            type_name: `${schema}.${name}`,
            message: `${type} type ${schema}.${name} created.`,
        };
    },
};
