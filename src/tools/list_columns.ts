import { z } from 'zod';
import type { ToolContext } from './types.js';

const ListColumnsInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    table: z.string().describe('Table name'),
});
type ListColumnsInput = z.infer<typeof ListColumnsInputSchema>;

const ColumnSchema = z.object({
    name: z.string(),
    type: z.string(),
    nullable: z.boolean(),
    default: z.string().nullable(),
    is_identity: z.boolean(),
    is_generated: z.boolean(),
    comment: z.string().nullable(),
});
const ListColumnsOutputSchema = z.array(ColumnSchema);

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public' },
        table: { type: 'string', description: 'Table name' },
    },
    required: ['table'],
};

export const listColumnsTool = {
    name: 'list_columns',
    description: 'Lists all columns of a table with their properties.',
    inputSchema: ListColumnsInputSchema,
    mcpInputSchema,
    outputSchema: ListColumnsOutputSchema,

    execute: async (input: ListColumnsInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, table } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const sql = `
            SELECT
                c.column_name as name,
                c.data_type || COALESCE('(' || c.character_maximum_length || ')', '') as type,
                c.is_nullable = 'YES' as nullable,
                c.column_default as default,
                c.is_identity = 'YES' as is_identity,
                c.is_generated != 'NEVER' as is_generated,
                col_description(
                    ('"' || c.table_schema || '"."' || c.table_name || '"')::regclass,
                    c.ordinal_position
                ) as comment
            FROM information_schema.columns c
            WHERE c.table_schema = $1 AND c.table_name = $2
            ORDER BY c.ordinal_position;
        `;

        const result = await client.executeSqlWithPg(sql, [schema, table]);
        return ListColumnsOutputSchema.parse(result);
    },
};
