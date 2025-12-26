import { z } from 'zod';
import type { ToolContext } from './types.js';

const RefreshMaterializedViewInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    name: z.string().describe('Materialized view name'),
    concurrently: z.boolean().optional().default(false).describe('Refresh concurrently (requires unique index)'),
});
type RefreshMaterializedViewInput = z.infer<typeof RefreshMaterializedViewInputSchema>;

const RefreshMaterializedViewOutputSchema = z.object({
    success: z.boolean(),
    view_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public', description: 'Schema name' },
        name: { type: 'string', description: 'Materialized view name' },
        concurrently: { type: 'boolean', default: false },
    },
    required: ['name'],
};

export const refreshMaterializedViewTool = {
    name: 'refresh_materialized_view',
    description: 'Refreshes a materialized view.',
    inputSchema: RefreshMaterializedViewInputSchema,
    mcpInputSchema,
    outputSchema: RefreshMaterializedViewOutputSchema,

    execute: async (input: RefreshMaterializedViewInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, name, concurrently } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const concurrentlyClause = concurrently ? 'CONCURRENTLY' : '';
        const sql = `REFRESH MATERIALIZED VIEW ${concurrentlyClause} "${schema}"."${name}";`;

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            view_name: `${schema}.${name}`,
            message: `Materialized view ${schema}.${name} refreshed.`,
        };
    },
};
