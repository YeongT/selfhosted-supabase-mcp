import { z } from 'zod';
import type { ToolContext } from './types.js';

const CreateViewInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    name: z.string().describe('View name'),
    query: z.string().describe('SELECT query for the view'),
    materialized: z.boolean().optional().default(false).describe('Create materialized view'),
    replace: z.boolean().optional().default(true).describe('Use CREATE OR REPLACE (not for materialized)'),
    columns: z.array(z.string()).optional().describe('Column names'),
    with_data: z.boolean().optional().default(true).describe('Populate materialized view with data'),
});
type CreateViewInput = z.infer<typeof CreateViewInputSchema>;

const CreateViewOutputSchema = z.object({
    success: z.boolean(),
    view_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public', description: 'Schema name' },
        name: { type: 'string', description: 'View name' },
        query: { type: 'string', description: 'SELECT query for the view' },
        materialized: { type: 'boolean', default: false, description: 'Create materialized view' },
        replace: { type: 'boolean', default: true },
        columns: { type: 'array', items: { type: 'string' } },
        with_data: { type: 'boolean', default: true },
    },
    required: ['name', 'query'],
};

export const createViewTool = {
    name: 'create_view',
    description: 'Creates a new view or materialized view.',
    inputSchema: CreateViewInputSchema,
    mcpInputSchema,
    outputSchema: CreateViewOutputSchema,

    execute: async (input: CreateViewInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, name, query, materialized, replace, columns, with_data } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const columnsStr = columns && columns.length > 0 ? ` (${columns.join(', ')})` : '';

        let sql: string;
        if (materialized) {
            sql = `CREATE MATERIALIZED VIEW "${schema}"."${name}"${columnsStr} AS ${query}`;
            sql += with_data ? ' WITH DATA;' : ' WITH NO DATA;';
        } else {
            const createOrReplace = replace ? 'CREATE OR REPLACE' : 'CREATE';
            sql = `${createOrReplace} VIEW "${schema}"."${name}"${columnsStr} AS ${query};`;
        }

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            view_name: `${schema}.${name}`,
            message: `${materialized ? 'Materialized view' : 'View'} ${schema}.${name} created.`,
        };
    },
};
