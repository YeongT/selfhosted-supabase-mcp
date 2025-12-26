import { z } from 'zod';
import type { ToolContext } from './types.js';

const GetTableStatsInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    table: z.string().optional().describe('Filter by table name'),
});
type GetTableStatsInput = z.infer<typeof GetTableStatsInputSchema>;

const TableStatsSchema = z.object({
    schema: z.string(),
    table: z.string(),
    row_count: z.number(),
    total_size: z.string(),
    table_size: z.string(),
    index_size: z.string(),
    toast_size: z.string().nullable(),
    last_vacuum: z.string().nullable(),
    last_autovacuum: z.string().nullable(),
    last_analyze: z.string().nullable(),
    last_autoanalyze: z.string().nullable(),
    dead_tuples: z.number(),
});
const GetTableStatsOutputSchema = z.array(TableStatsSchema);

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public' },
        table: { type: 'string', description: 'Filter by table name' },
    },
    required: [],
};

export const getTableStatsTool = {
    name: 'get_table_stats',
    description: 'Gets table statistics including size, row count, and vacuum info.',
    inputSchema: GetTableStatsInputSchema,
    mcpInputSchema,
    outputSchema: GetTableStatsOutputSchema,

    execute: async (input: GetTableStatsInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, table } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        let sql = `
            SELECT
                n.nspname as schema,
                c.relname as table,
                c.reltuples::bigint as row_count,
                pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
                pg_size_pretty(pg_table_size(c.oid)) as table_size,
                pg_size_pretty(pg_indexes_size(c.oid)) as index_size,
                pg_size_pretty(pg_total_relation_size(c.reltoastrelid)) as toast_size,
                s.last_vacuum::text,
                s.last_autovacuum::text,
                s.last_analyze::text,
                s.last_autoanalyze::text,
                COALESCE(s.n_dead_tup, 0)::bigint as dead_tuples
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
            WHERE c.relkind = 'r'
              AND n.nspname = $1
        `;

        const params: string[] = [schema];
        if (table) {
            sql += ` AND c.relname = $2`;
            params.push(table);
        }

        sql += ` ORDER BY pg_total_relation_size(c.oid) DESC;`;

        const result = await client.executeSqlWithPg(sql, params);
        return GetTableStatsOutputSchema.parse(result);
    },
};
