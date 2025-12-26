import { z } from 'zod';
import type { ToolContext } from './types.js';

const DisableRlsInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    table: z.string().describe('Table name'),
});
type DisableRlsInput = z.infer<typeof DisableRlsInputSchema>;

const DisableRlsOutputSchema = z.object({
    success: z.boolean(),
    table: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public', description: 'Schema name' },
        table: { type: 'string', description: 'Table name' },
    },
    required: ['table'],
};

export const disableRlsTool = {
    name: 'disable_rls',
    description: 'Disables Row Level Security on a table.',
    inputSchema: DisableRlsInputSchema,
    mcpInputSchema,
    outputSchema: DisableRlsOutputSchema,

    execute: async (input: DisableRlsInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, table } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const sql = `ALTER TABLE "${schema}"."${table}" DISABLE ROW LEVEL SECURITY;`;

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            table: `${schema}.${table}`,
            message: `RLS disabled on ${schema}.${table}.`,
        };
    },
};
