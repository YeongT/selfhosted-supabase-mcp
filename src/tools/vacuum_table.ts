import { z } from 'zod';
import type { ToolContext } from './types.js';

const VacuumTableInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    table: z.string().optional().describe('Table name (all tables in schema if not specified)'),
    full: z.boolean().optional().default(false).describe('VACUUM FULL (rebuilds table)'),
    analyze: z.boolean().optional().default(true).describe('Also run ANALYZE'),
    verbose: z.boolean().optional().default(false).describe('Print progress'),
});
type VacuumTableInput = z.infer<typeof VacuumTableInputSchema>;

const VacuumTableOutputSchema = z.object({
    success: z.boolean(),
    target: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public' },
        table: { type: 'string', description: 'Table name' },
        full: { type: 'boolean', default: false },
        analyze: { type: 'boolean', default: true },
        verbose: { type: 'boolean', default: false },
    },
    required: [],
};

export const vacuumTableTool = {
    name: 'vacuum_table',
    description: 'Runs VACUUM on a table to reclaim storage and update statistics.',
    inputSchema: VacuumTableInputSchema,
    mcpInputSchema,
    outputSchema: VacuumTableOutputSchema,

    execute: async (input: VacuumTableInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, table, full, analyze, verbose } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const options: string[] = [];
        if (full) options.push('FULL');
        if (analyze) options.push('ANALYZE');
        if (verbose) options.push('VERBOSE');

        const optionsStr = options.length > 0 ? `(${options.join(', ')})` : '';
        const target = table ? `"${schema}"."${table}"` : '';

        const sql = `VACUUM ${optionsStr} ${target};`;

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            target: table ? `${schema}.${table}` : `all tables`,
            message: `VACUUM ${options.join(' ')} completed on ${table ? `${schema}.${table}` : 'all tables'}.`,
        };
    },
};
