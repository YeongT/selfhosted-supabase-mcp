import { z } from 'zod';
import type { ToolContext } from './types.js';

const ListConstraintsInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    table: z.string().optional().describe('Filter by table name'),
});
type ListConstraintsInput = z.infer<typeof ListConstraintsInputSchema>;

const ConstraintSchema = z.object({
    schema: z.string(),
    table: z.string(),
    name: z.string(),
    type: z.string(),
    columns: z.array(z.string()),
    definition: z.string(),
});
const ListConstraintsOutputSchema = z.array(ConstraintSchema);

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public' },
        table: { type: 'string', description: 'Filter by table name' },
    },
    required: [],
};

export const listConstraintsTool = {
    name: 'list_constraints',
    description: 'Lists all constraints (PRIMARY KEY, UNIQUE, CHECK, EXCLUDE) in the specified schema.',
    inputSchema: ListConstraintsInputSchema,
    mcpInputSchema,
    outputSchema: ListConstraintsOutputSchema,

    execute: async (input: ListConstraintsInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, table } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        let sql = `
            SELECT
                n.nspname as schema,
                c.relname as table,
                con.conname as name,
                CASE con.contype
                    WHEN 'p' THEN 'PRIMARY KEY'
                    WHEN 'u' THEN 'UNIQUE'
                    WHEN 'c' THEN 'CHECK'
                    WHEN 'x' THEN 'EXCLUDE'
                    WHEN 'f' THEN 'FOREIGN KEY'
                END as type,
                ARRAY(
                    SELECT a.attname
                    FROM pg_attribute a
                    WHERE a.attrelid = c.oid
                      AND a.attnum = ANY(con.conkey)
                ) as columns,
                pg_get_constraintdef(con.oid) as definition
            FROM pg_constraint con
            JOIN pg_class c ON c.oid = con.conrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = $1
              AND con.contype != 'f'
        `;

        const params: string[] = [schema];
        if (table) {
            sql += ` AND c.relname = $2`;
            params.push(table);
        }

        sql += ` ORDER BY c.relname, con.conname;`;

        const result = await client.executeSqlWithPg(sql, params);
        return ListConstraintsOutputSchema.parse(result);
    },
};
