import { z } from 'zod';
import type { ToolContext } from './types.js';

const EnableRlsInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    table: z.string().describe('Table name'),
    force: z.boolean().optional().default(false).describe('Force RLS for table owner'),
});
type EnableRlsInput = z.infer<typeof EnableRlsInputSchema>;

const EnableRlsOutputSchema = z.object({
    success: z.boolean(),
    table: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public', description: 'Schema name' },
        table: { type: 'string', description: 'Table name' },
        force: { type: 'boolean', default: false, description: 'Force RLS for table owner' },
    },
    required: ['table'],
};

export const enableRlsTool = {
    name: 'enable_rls',
    description: 'Enables Row Level Security on a table.',
    inputSchema: EnableRlsInputSchema,
    mcpInputSchema,
    outputSchema: EnableRlsOutputSchema,

    execute: async (input: EnableRlsInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, table, force } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        let sql = `ALTER TABLE "${schema}"."${table}" ENABLE ROW LEVEL SECURITY;`;

        if (force) {
            sql += ` ALTER TABLE "${schema}"."${table}" FORCE ROW LEVEL SECURITY;`;
        }

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            table: `${schema}.${table}`,
            message: `RLS enabled on ${schema}.${table}${force ? ' (forced)' : ''}.`,
        };
    },
};
