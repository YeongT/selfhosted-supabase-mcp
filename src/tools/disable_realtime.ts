import { z } from 'zod';
import type { ToolContext } from './types.js';

const DisableRealtimeInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    table: z.string().describe('Table name'),
});
type DisableRealtimeInput = z.infer<typeof DisableRealtimeInputSchema>;

const DisableRealtimeOutputSchema = z.object({
    success: z.boolean(),
    table: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public' },
        table: { type: 'string', description: 'Table name' },
    },
    required: ['table'],
};

export const disableRealtimeTool = {
    name: 'disable_realtime',
    description: 'Disables Supabase Realtime for a table by removing it from the publication.',
    inputSchema: DisableRealtimeInputSchema,
    mcpInputSchema,
    outputSchema: DisableRealtimeOutputSchema,

    execute: async (input: DisableRealtimeInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, table } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const sql = `ALTER PUBLICATION supabase_realtime DROP TABLE "${schema}"."${table}";`;

        try {
            await client.executeSqlWithPg(sql);
        } catch (error: any) {
            if (error.message?.includes('not a member')) {
                return {
                    success: true,
                    table: `${schema}.${table}`,
                    message: `Table ${schema}.${table} is not in Realtime publication.`,
                };
            }
            throw error;
        }

        return {
            success: true,
            table: `${schema}.${table}`,
            message: `Realtime disabled for ${schema}.${table}.`,
        };
    },
};
