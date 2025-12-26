import { z } from 'zod';
import type { ToolContext } from './types.js';

const CreateSequenceInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    name: z.string().describe('Sequence name'),
    data_type: z.enum(['smallint', 'integer', 'bigint']).optional().default('bigint').describe('Data type'),
    start: z.number().optional().describe('Start value'),
    increment: z.number().optional().default(1).describe('Increment by'),
    min_value: z.number().optional().describe('Minimum value'),
    max_value: z.number().optional().describe('Maximum value'),
    cycle: z.boolean().optional().default(false).describe('Cycle when reaching max/min'),
    cache: z.number().optional().default(1).describe('Cache size'),
    owned_by_table: z.string().optional().describe('Owner table'),
    owned_by_column: z.string().optional().describe('Owner column'),
    if_not_exists: z.boolean().optional().default(true).describe('Do not error if sequence exists'),
});
type CreateSequenceInput = z.infer<typeof CreateSequenceInputSchema>;

const CreateSequenceOutputSchema = z.object({
    success: z.boolean(),
    sequence_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public' },
        name: { type: 'string', description: 'Sequence name' },
        data_type: { type: 'string', enum: ['smallint', 'integer', 'bigint'], default: 'bigint' },
        start: { type: 'number' },
        increment: { type: 'number', default: 1 },
        min_value: { type: 'number' },
        max_value: { type: 'number' },
        cycle: { type: 'boolean', default: false },
        cache: { type: 'number', default: 1 },
        owned_by_table: { type: 'string' },
        owned_by_column: { type: 'string' },
        if_not_exists: { type: 'boolean', default: true },
    },
    required: ['name'],
};

export const createSequenceTool = {
    name: 'create_sequence',
    description: 'Creates a new sequence.',
    inputSchema: CreateSequenceInputSchema,
    mcpInputSchema,
    outputSchema: CreateSequenceOutputSchema,

    execute: async (input: CreateSequenceInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, name, data_type, start, increment, min_value, max_value, cycle, cache, owned_by_table, owned_by_column, if_not_exists } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const ifNotExistsClause = if_not_exists ? 'IF NOT EXISTS' : '';

        let sql = `CREATE SEQUENCE ${ifNotExistsClause} "${schema}"."${name}"`;
        sql += ` AS ${data_type}`;
        if (increment !== undefined) sql += ` INCREMENT BY ${increment}`;
        if (min_value !== undefined) sql += ` MINVALUE ${min_value}`;
        if (max_value !== undefined) sql += ` MAXVALUE ${max_value}`;
        if (start !== undefined) sql += ` START WITH ${start}`;
        if (cache !== undefined) sql += ` CACHE ${cache}`;
        sql += cycle ? ' CYCLE' : ' NO CYCLE';
        sql += ';';

        await client.executeSqlWithPg(sql);

        if (owned_by_table && owned_by_column) {
            const ownedBySql = `ALTER SEQUENCE "${schema}"."${name}" OWNED BY "${schema}"."${owned_by_table}"."${owned_by_column}";`;
            await client.executeSqlWithPg(ownedBySql);
        }

        return {
            success: true,
            sequence_name: `${schema}.${name}`,
            message: `Sequence ${schema}.${name} created.`,
        };
    },
};
