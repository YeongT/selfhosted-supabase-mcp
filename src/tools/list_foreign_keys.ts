import { z } from 'zod';
import type { ToolContext } from './types.js';

const ListForeignKeysInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    table: z.string().optional().describe('Filter by table name'),
});
type ListForeignKeysInput = z.infer<typeof ListForeignKeysInputSchema>;

const ForeignKeySchema = z.object({
    schema: z.string(),
    table: z.string(),
    name: z.string(),
    columns: z.array(z.string()),
    foreign_schema: z.string(),
    foreign_table: z.string(),
    foreign_columns: z.array(z.string()),
    on_update: z.string(),
    on_delete: z.string(),
});
const ListForeignKeysOutputSchema = z.array(ForeignKeySchema);

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public', description: 'Schema name' },
        table: { type: 'string', description: 'Filter by table name' },
    },
    required: [],
};

export const listForeignKeysTool = {
    name: 'list_foreign_keys',
    description: 'Lists all foreign key constraints in the specified schema.',
    inputSchema: ListForeignKeysInputSchema,
    mcpInputSchema,
    outputSchema: ListForeignKeysOutputSchema,

    execute: async (input: ListForeignKeysInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, table } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        let sql = `
            SELECT
                tc.table_schema as schema,
                tc.table_name as table,
                tc.constraint_name as name,
                ARRAY_AGG(kcu.column_name ORDER BY kcu.ordinal_position) as columns,
                ccu.table_schema as foreign_schema,
                ccu.table_name as foreign_table,
                ARRAY_AGG(ccu.column_name ORDER BY kcu.ordinal_position) as foreign_columns,
                rc.update_rule as on_update,
                rc.delete_rule as on_delete
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage ccu
                ON tc.constraint_name = ccu.constraint_name
                AND tc.table_schema = ccu.constraint_schema
            JOIN information_schema.referential_constraints rc
                ON tc.constraint_name = rc.constraint_name
                AND tc.table_schema = rc.constraint_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = $1
        `;

        const params: string[] = [schema];
        if (table) {
            sql += ` AND tc.table_name = $2`;
            params.push(table);
        }

        sql += ` GROUP BY tc.table_schema, tc.table_name, tc.constraint_name,
                 ccu.table_schema, ccu.table_name, rc.update_rule, rc.delete_rule
                 ORDER BY tc.table_name, tc.constraint_name;`;

        const result = await client.executeSqlWithPg(sql, params);
        return ListForeignKeysOutputSchema.parse(result);
    },
};
