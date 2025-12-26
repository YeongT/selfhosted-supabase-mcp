import { z } from 'zod';
import type { ToolContext } from './types.js';

const DropColumnInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    table: z.string().describe('Table name'),
    name: z.string().describe('Column name'),
    cascade: z.boolean().optional().default(false).describe('Drop dependent objects'),
    if_exists: z.boolean().optional().default(true),
});
type DropColumnInput = z.infer<typeof DropColumnInputSchema>;

const DropColumnOutputSchema = z.object({
    success: z.boolean(),
    column_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public' },
        table: { type: 'string', description: 'Table name' },
        name: { type: 'string', description: 'Column name' },
        cascade: { type: 'boolean', default: false },
        if_exists: { type: 'boolean', default: true },
    },
    required: ['table', 'name'],
};

export const dropColumnTool = {
    name: 'drop_column',
    description: 'Drops a column from a table.',
    inputSchema: DropColumnInputSchema,
    mcpInputSchema,
    outputSchema: DropColumnOutputSchema,

    execute: async (input: DropColumnInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, table, name, cascade, if_exists } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const ifExistsClause = if_exists ? 'IF EXISTS' : '';
        const cascadeClause = cascade ? 'CASCADE' : 'RESTRICT';
        const sql = `ALTER TABLE "${schema}"."${table}" DROP COLUMN ${ifExistsClause} "${name}" ${cascadeClause};`;

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            column_name: name,
            message: `Column ${name} dropped from ${schema}.${table}.`,
        };
    },
};
