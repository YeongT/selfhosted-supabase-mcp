import { z } from 'zod';
import type { ToolContext } from './types.js';

const DeleteForeignKeyInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    table: z.string().describe('Table name'),
    name: z.string().describe('Constraint name'),
    if_exists: z.boolean().optional().default(true).describe('Do not error if constraint does not exist'),
});
type DeleteForeignKeyInput = z.infer<typeof DeleteForeignKeyInputSchema>;

const DeleteForeignKeyOutputSchema = z.object({
    success: z.boolean(),
    constraint_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public' },
        table: { type: 'string', description: 'Table name' },
        name: { type: 'string', description: 'Constraint name' },
        if_exists: { type: 'boolean', default: true },
    },
    required: ['table', 'name'],
};

export const deleteForeignKeyTool = {
    name: 'delete_foreign_key',
    description: 'Deletes a foreign key constraint.',
    inputSchema: DeleteForeignKeyInputSchema,
    mcpInputSchema,
    outputSchema: DeleteForeignKeyOutputSchema,

    execute: async (input: DeleteForeignKeyInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, table, name, if_exists } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const ifExistsClause = if_exists ? 'IF EXISTS' : '';
        const sql = `ALTER TABLE "${schema}"."${table}" DROP CONSTRAINT ${ifExistsClause} "${name}";`;

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            constraint_name: name,
            message: `Foreign key ${name} deleted from ${schema}.${table}.`,
        };
    },
};
