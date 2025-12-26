import { z } from 'zod';
import type { ToolContext } from './types.js';

const CreateIndexInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    table: z.string().describe('Table name'),
    name: z.string().describe('Index name'),
    columns: z.array(z.string()).min(1).describe('Columns to index'),
    unique: z.boolean().optional().default(false).describe('Create unique index'),
    method: z.enum(['btree', 'hash', 'gist', 'spgist', 'gin', 'brin']).optional().default('btree').describe('Index method'),
    where: z.string().optional().describe('Partial index WHERE clause'),
    include: z.array(z.string()).optional().describe('Columns to include (covering index)'),
    concurrently: z.boolean().optional().default(false).describe('Create index concurrently'),
    if_not_exists: z.boolean().optional().default(true).describe('Do not error if index exists'),
});
type CreateIndexInput = z.infer<typeof CreateIndexInputSchema>;

const CreateIndexOutputSchema = z.object({
    success: z.boolean(),
    index_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public' },
        table: { type: 'string', description: 'Table name' },
        name: { type: 'string', description: 'Index name' },
        columns: { type: 'array', items: { type: 'string' }, description: 'Columns to index' },
        unique: { type: 'boolean', default: false },
        method: { type: 'string', enum: ['btree', 'hash', 'gist', 'spgist', 'gin', 'brin'], default: 'btree' },
        where: { type: 'string', description: 'Partial index condition' },
        include: { type: 'array', items: { type: 'string' } },
        concurrently: { type: 'boolean', default: false },
        if_not_exists: { type: 'boolean', default: true },
    },
    required: ['table', 'name', 'columns'],
};

export const createIndexTool = {
    name: 'create_index',
    description: 'Creates a new index on a table.',
    inputSchema: CreateIndexInputSchema,
    mcpInputSchema,
    outputSchema: CreateIndexOutputSchema,

    execute: async (input: CreateIndexInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, table, name, columns, unique, method, where, include, concurrently, if_not_exists } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const uniqueClause = unique ? 'UNIQUE' : '';
        const concurrentlyClause = concurrently ? 'CONCURRENTLY' : '';
        const ifNotExistsClause = if_not_exists ? 'IF NOT EXISTS' : '';
        const columnsStr = columns.join(', ');
        const includeClause = include && include.length > 0 ? `INCLUDE (${include.join(', ')})` : '';
        const whereClause = where ? `WHERE ${where}` : '';

        const sql = `CREATE ${uniqueClause} INDEX ${concurrentlyClause} ${ifNotExistsClause} "${name}" ON "${schema}"."${table}" USING ${method} (${columnsStr}) ${includeClause} ${whereClause};`;

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            index_name: name,
            message: `Index ${name} created on ${schema}.${table}.`,
        };
    },
};
