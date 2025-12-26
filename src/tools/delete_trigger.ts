import { z } from 'zod';
import type { ToolContext } from './types.js';

const DeleteTriggerInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    table: z.string().describe('Table name'),
    name: z.string().describe('Trigger name'),
    cascade: z.boolean().optional().default(false).describe('Drop dependent objects'),
    if_exists: z.boolean().optional().default(true).describe('Do not error if trigger does not exist'),
});
type DeleteTriggerInput = z.infer<typeof DeleteTriggerInputSchema>;

const DeleteTriggerOutputSchema = z.object({
    success: z.boolean(),
    trigger_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public', description: 'Schema name' },
        table: { type: 'string', description: 'Table name' },
        name: { type: 'string', description: 'Trigger name' },
        cascade: { type: 'boolean', default: false },
        if_exists: { type: 'boolean', default: true },
    },
    required: ['table', 'name'],
};

export const deleteTriggerTool = {
    name: 'delete_trigger',
    description: 'Deletes a trigger from a table.',
    inputSchema: DeleteTriggerInputSchema,
    mcpInputSchema,
    outputSchema: DeleteTriggerOutputSchema,

    execute: async (input: DeleteTriggerInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, table, name, cascade, if_exists } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const ifExistsClause = if_exists ? 'IF EXISTS' : '';
        const cascadeClause = cascade ? 'CASCADE' : 'RESTRICT';
        const sql = `DROP TRIGGER ${ifExistsClause} "${name}" ON "${schema}"."${table}" ${cascadeClause};`;

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            trigger_name: name,
            message: `Trigger ${name} deleted from ${schema}.${table}.`,
        };
    },
};
