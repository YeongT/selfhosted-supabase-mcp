import { z } from 'zod';
import type { ToolContext } from './types.js';

const ListViewsInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
});
type ListViewsInput = z.infer<typeof ListViewsInputSchema>;

const ViewSchema = z.object({
    schema: z.string(),
    name: z.string(),
    owner: z.string(),
    is_materialized: z.boolean(),
    definition: z.string(),
});
const ListViewsOutputSchema = z.array(ViewSchema);

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public', description: 'Schema name' },
    },
    required: [],
};

export const listViewsTool = {
    name: 'list_views',
    description: 'Lists all views (including materialized views) in the specified schema.',
    inputSchema: ListViewsInputSchema,
    mcpInputSchema,
    outputSchema: ListViewsOutputSchema,

    execute: async (input: ListViewsInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const sql = `
            SELECT
                schemaname as schema,
                viewname as name,
                viewowner as owner,
                false as is_materialized,
                definition
            FROM pg_views
            WHERE schemaname = $1
            UNION ALL
            SELECT
                schemaname as schema,
                matviewname as name,
                matviewowner as owner,
                true as is_materialized,
                definition
            FROM pg_matviews
            WHERE schemaname = $1
            ORDER BY name;
        `;

        const result = await client.executeSqlWithPg(sql, [schema]);
        return ListViewsOutputSchema.parse(result);
    },
};
