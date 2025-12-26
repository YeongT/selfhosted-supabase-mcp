import { z } from 'zod';
import type { ToolContext } from './types.js';

const AnalyzeTableInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    table: z.string().optional().describe('Table name (all tables if not specified)'),
    columns: z.array(z.string()).optional().describe('Specific columns to analyze'),
    verbose: z.boolean().optional().default(false).describe('Print progress'),
});
type AnalyzeTableInput = z.infer<typeof AnalyzeTableInputSchema>;

const AnalyzeTableOutputSchema = z.object({
    success: z.boolean(),
    target: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public' },
        table: { type: 'string', description: 'Table name' },
        columns: { type: 'array', items: { type: 'string' } },
        verbose: { type: 'boolean', default: false },
    },
    required: [],
};

export const analyzeTableTool = {
    name: 'analyze_table',
    description: 'Runs ANALYZE on a table to update query planner statistics.',
    inputSchema: AnalyzeTableInputSchema,
    mcpInputSchema,
    outputSchema: AnalyzeTableOutputSchema,

    execute: async (input: AnalyzeTableInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, table, columns, verbose } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const verboseClause = verbose ? 'VERBOSE' : '';
        let target = '';

        if (table) {
            target = `"${schema}"."${table}"`;
            if (columns && columns.length > 0) {
                target += ` (${columns.map(c => `"${c}"`).join(', ')})`;
            }
        }

        const sql = `ANALYZE ${verboseClause} ${target};`;

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            target: table ? `${schema}.${table}` : 'all tables',
            message: `ANALYZE completed on ${table ? `${schema}.${table}` : 'all tables'}.`,
        };
    },
};
