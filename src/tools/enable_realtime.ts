import { z } from 'zod';
import type { ToolContext } from './types.js';

const EnableRealtimeInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    table: z.string().describe('Table name'),
});
type EnableRealtimeInput = z.infer<typeof EnableRealtimeInputSchema>;

const EnableRealtimeOutputSchema = z.object({
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

export const enableRealtimeTool = {
    name: 'enable_realtime',
    description: 'Enables Supabase Realtime for a table by adding it to the publication.',
    inputSchema: EnableRealtimeInputSchema,
    mcpInputSchema,
    outputSchema: EnableRealtimeOutputSchema,

    execute: async (input: EnableRealtimeInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, table } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        // Add table to supabase_realtime publication
        const sql = `ALTER PUBLICATION supabase_realtime ADD TABLE "${schema}"."${table}";`;

        try {
            await client.executeSqlWithPg(sql);
        } catch (error: any) {
            if (error.message?.includes('already member')) {
                return {
                    success: true,
                    table: `${schema}.${table}`,
                    message: `Table ${schema}.${table} already has Realtime enabled.`,
                };
            }
            throw error;
        }

        return {
            success: true,
            table: `${schema}.${table}`,
            message: `Realtime enabled for ${schema}.${table}.`,
        };
    },
};
