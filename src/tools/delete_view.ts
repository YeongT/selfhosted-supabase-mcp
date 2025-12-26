import { z } from 'zod';
import type { ToolContext } from './types.js';

const DeleteViewInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    name: z.string().describe('View name'),
    materialized: z.boolean().optional().default(false).describe('Is materialized view'),
    cascade: z.boolean().optional().default(false).describe('Drop dependent objects'),
    if_exists: z.boolean().optional().default(true).describe('Do not error if view does not exist'),
});
type DeleteViewInput = z.infer<typeof DeleteViewInputSchema>;

const DeleteViewOutputSchema = z.object({
    success: z.boolean(),
    view_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public', description: 'Schema name' },
        name: { type: 'string', description: 'View name' },
        materialized: { type: 'boolean', default: false },
        cascade: { type: 'boolean', default: false },
        if_exists: { type: 'boolean', default: true },
    },
    required: ['name'],
};

export const deleteViewTool = {
    name: 'delete_view',
    description: 'Deletes a view or materialized view.',
    inputSchema: DeleteViewInputSchema,
    mcpInputSchema,
    outputSchema: DeleteViewOutputSchema,

    execute: async (input: DeleteViewInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, name, materialized, cascade, if_exists } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const viewType = materialized ? 'MATERIALIZED VIEW' : 'VIEW';
        const ifExistsClause = if_exists ? 'IF EXISTS' : '';
        const cascadeClause = cascade ? 'CASCADE' : 'RESTRICT';
        const sql = `DROP ${viewType} ${ifExistsClause} "${schema}"."${name}" ${cascadeClause};`;

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            view_name: `${schema}.${name}`,
            message: `${viewType} ${schema}.${name} deleted.`,
        };
    },
};
