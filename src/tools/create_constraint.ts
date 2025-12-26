import { z } from 'zod';
import type { ToolContext } from './types.js';

const CreateConstraintInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    table: z.string().describe('Table name'),
    name: z.string().describe('Constraint name'),
    type: z.enum(['PRIMARY KEY', 'UNIQUE', 'CHECK']).describe('Constraint type'),
    columns: z.array(z.string()).optional().describe('Columns for PRIMARY KEY or UNIQUE'),
    expression: z.string().optional().describe('Expression for CHECK constraint'),
    if_not_exists: z.boolean().optional().default(false).describe('Do not error if constraint exists'),
});
type CreateConstraintInput = z.infer<typeof CreateConstraintInputSchema>;

const CreateConstraintOutputSchema = z.object({
    success: z.boolean(),
    constraint_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public' },
        table: { type: 'string', description: 'Table name' },
        name: { type: 'string', description: 'Constraint name' },
        type: { type: 'string', enum: ['PRIMARY KEY', 'UNIQUE', 'CHECK'] },
        columns: { type: 'array', items: { type: 'string' } },
        expression: { type: 'string', description: 'CHECK expression' },
        if_not_exists: { type: 'boolean', default: false },
    },
    required: ['table', 'name', 'type'],
};

export const createConstraintTool = {
    name: 'create_constraint',
    description: 'Creates a new constraint (PRIMARY KEY, UNIQUE, or CHECK).',
    inputSchema: CreateConstraintInputSchema,
    mcpInputSchema,
    outputSchema: CreateConstraintOutputSchema,

    execute: async (input: CreateConstraintInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, table, name, type, columns, expression, if_not_exists } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        let sql: string;

        switch (type) {
            case 'PRIMARY KEY':
            case 'UNIQUE':
                if (!columns || columns.length === 0) {
                    throw new Error(`${type} constraint requires columns.`);
                }
                const columnsStr = columns.map(c => `"${c}"`).join(', ');
                sql = `ALTER TABLE "${schema}"."${table}" ADD CONSTRAINT "${name}" ${type} (${columnsStr})`;
                break;
            case 'CHECK':
                if (!expression) {
                    throw new Error('CHECK constraint requires expression.');
                }
                sql = `ALTER TABLE "${schema}"."${table}" ADD CONSTRAINT "${name}" CHECK (${expression})`;
                break;
            default:
                throw new Error(`Unknown constraint type: ${type}`);
        }

        sql += ';';

        try {
            await client.executeSqlWithPg(sql);
        } catch (error: any) {
            if (if_not_exists && error.message?.includes('already exists')) {
                return {
                    success: true,
                    constraint_name: name,
                    message: `Constraint ${name} already exists on ${schema}.${table}.`,
                };
            }
            throw error;
        }

        return {
            success: true,
            constraint_name: name,
            message: `${type} constraint ${name} created on ${schema}.${table}.`,
        };
    },
};
