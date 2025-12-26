import { z } from 'zod';
import type { ToolContext } from './types.js';

const ListTriggersInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    table: z.string().optional().describe('Filter by table name'),
});
type ListTriggersInput = z.infer<typeof ListTriggersInputSchema>;

const TriggerSchema = z.object({
    schema: z.string(),
    table: z.string(),
    name: z.string(),
    event: z.string(),
    timing: z.string(),
    function_schema: z.string(),
    function_name: z.string(),
    enabled: z.boolean(),
});
const ListTriggersOutputSchema = z.array(TriggerSchema);

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public', description: 'Schema name' },
        table: { type: 'string', description: 'Filter by table name' },
    },
    required: [],
};

export const listTriggersTool = {
    name: 'list_triggers',
    description: 'Lists all triggers in the specified schema.',
    inputSchema: ListTriggersInputSchema,
    mcpInputSchema,
    outputSchema: ListTriggersOutputSchema,

    execute: async (input: ListTriggersInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, table } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        let sql = `
            SELECT
                n.nspname as schema,
                c.relname as table,
                t.tgname as name,
                CASE
                    WHEN t.tgtype & 1 = 1 THEN 'ROW'
                    ELSE 'STATEMENT'
                END ||
                CASE
                    WHEN t.tgtype & 2 = 2 THEN ' BEFORE'
                    WHEN t.tgtype & 64 = 64 THEN ' INSTEAD OF'
                    ELSE ' AFTER'
                END as timing,
                ARRAY_TO_STRING(ARRAY[
                    CASE WHEN t.tgtype & 4 = 4 THEN 'INSERT' END,
                    CASE WHEN t.tgtype & 8 = 8 THEN 'DELETE' END,
                    CASE WHEN t.tgtype & 16 = 16 THEN 'UPDATE' END,
                    CASE WHEN t.tgtype & 32 = 32 THEN 'TRUNCATE' END
                ], ' OR ') as event,
                fn.nspname as function_schema,
                p.proname as function_name,
                t.tgenabled != 'D' as enabled
            FROM pg_trigger t
            JOIN pg_class c ON c.oid = t.tgrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            JOIN pg_proc p ON p.oid = t.tgfoid
            JOIN pg_namespace fn ON fn.oid = p.pronamespace
            WHERE NOT t.tgisinternal
              AND n.nspname = $1
        `;

        const params: string[] = [schema];
        if (table) {
            sql += ` AND c.relname = $2`;
            params.push(table);
        }

        sql += ` ORDER BY c.relname, t.tgname;`;

        const result = await client.executeSqlWithPg(sql, params);
        return ListTriggersOutputSchema.parse(result);
    },
};
