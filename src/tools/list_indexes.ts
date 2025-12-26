import { z } from 'zod';
import type { ToolContext } from './types.js';

const ListIndexesInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    table: z.string().optional().describe('Filter by table name'),
});
type ListIndexesInput = z.infer<typeof ListIndexesInputSchema>;

const IndexSchema = z.object({
    schema: z.string(),
    table: z.string(),
    name: z.string(),
    columns: z.array(z.string()),
    is_unique: z.boolean(),
    is_primary: z.boolean(),
    index_type: z.string(),
    definition: z.string(),
});
const ListIndexesOutputSchema = z.array(IndexSchema);

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public', description: 'Schema name' },
        table: { type: 'string', description: 'Filter by table name' },
    },
    required: [],
};

export const listIndexesTool = {
    name: 'list_indexes',
    description: 'Lists all indexes in the specified schema.',
    inputSchema: ListIndexesInputSchema,
    mcpInputSchema,
    outputSchema: ListIndexesOutputSchema,

    execute: async (input: ListIndexesInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, table } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        let sql = `
            SELECT
                n.nspname as schema,
                t.relname as table,
                i.relname as name,
                ARRAY(
                    SELECT a.attname
                    FROM pg_attribute a
                    WHERE a.attrelid = i.oid
                    ORDER BY a.attnum
                ) as columns,
                ix.indisunique as is_unique,
                ix.indisprimary as is_primary,
                am.amname as index_type,
                pg_get_indexdef(i.oid) as definition
            FROM pg_index ix
            JOIN pg_class i ON i.oid = ix.indexrelid
            JOIN pg_class t ON t.oid = ix.indrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            JOIN pg_am am ON am.oid = i.relam
            WHERE n.nspname = $1
        `;

        const params: string[] = [schema];
        if (table) {
            sql += ` AND t.relname = $2`;
            params.push(table);
        }

        sql += ` ORDER BY t.relname, i.relname;`;

        const result = await client.executeSqlWithPg(sql, params);
        return ListIndexesOutputSchema.parse(result);
    },
};
