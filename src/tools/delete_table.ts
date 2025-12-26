import { z } from 'zod';
import type { ToolContext } from './types.js';

const DeleteTableInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    name: z.string().describe('Table name'),
    cascade: z.boolean().optional().default(false).describe('Drop dependent objects'),
    if_exists: z.boolean().optional().default(true),
});
type DeleteTableInput = z.infer<typeof DeleteTableInputSchema>;

const DeleteTableOutputSchema = z.object({
    success: z.boolean(),
    table_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public' },
        name: { type: 'string', description: 'Table name' },
        cascade: { type: 'boolean', default: false },
        if_exists: { type: 'boolean', default: true },
    },
    required: ['name'],
};

export const deleteTableTool = {
    name: 'delete_table',
    description: 'Deletes a table.',
    inputSchema: DeleteTableInputSchema,
    mcpInputSchema,
    outputSchema: DeleteTableOutputSchema,

    execute: async (input: DeleteTableInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, name, cascade, if_exists } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const ifExistsClause = if_exists ? 'IF EXISTS' : '';
        const cascadeClause = cascade ? 'CASCADE' : 'RESTRICT';
        const sql = `DROP TABLE ${ifExistsClause} "${schema}"."${name}" ${cascadeClause};`;

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            table_name: `${schema}.${name}`,
            message: `Table ${schema}.${name} deleted.`,
        };
    },
};
