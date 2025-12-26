import { z } from 'zod';
import type { ToolContext } from './types.js';

const DeleteConstraintInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    table: z.string().describe('Table name'),
    name: z.string().describe('Constraint name'),
    cascade: z.boolean().optional().default(false).describe('Drop dependent objects'),
    if_exists: z.boolean().optional().default(true),
});
type DeleteConstraintInput = z.infer<typeof DeleteConstraintInputSchema>;

const DeleteConstraintOutputSchema = z.object({
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
        cascade: { type: 'boolean', default: false },
        if_exists: { type: 'boolean', default: true },
    },
    required: ['table', 'name'],
};

export const deleteConstraintTool = {
    name: 'delete_constraint',
    description: 'Deletes a constraint from a table.',
    inputSchema: DeleteConstraintInputSchema,
    mcpInputSchema,
    outputSchema: DeleteConstraintOutputSchema,

    execute: async (input: DeleteConstraintInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, table, name, cascade, if_exists } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const ifExistsClause = if_exists ? 'IF EXISTS' : '';
        const cascadeClause = cascade ? 'CASCADE' : 'RESTRICT';
        const sql = `ALTER TABLE "${schema}"."${table}" DROP CONSTRAINT ${ifExistsClause} "${name}" ${cascadeClause};`;

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            constraint_name: name,
            message: `Constraint ${name} deleted from ${schema}.${table}.`,
        };
    },
};
