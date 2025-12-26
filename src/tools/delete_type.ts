import { z } from 'zod';
import type { ToolContext } from './types.js';

const DeleteTypeInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    name: z.string().describe('Type name'),
    type: z.enum(['TYPE', 'DOMAIN']).optional().default('TYPE').describe('Whether it is TYPE or DOMAIN'),
    cascade: z.boolean().optional().default(false).describe('Drop dependent objects'),
    if_exists: z.boolean().optional().default(true).describe('Do not error if type does not exist'),
});
type DeleteTypeInput = z.infer<typeof DeleteTypeInputSchema>;

const DeleteTypeOutputSchema = z.object({
    success: z.boolean(),
    type_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public' },
        name: { type: 'string', description: 'Type name' },
        type: { type: 'string', enum: ['TYPE', 'DOMAIN'], default: 'TYPE' },
        cascade: { type: 'boolean', default: false },
        if_exists: { type: 'boolean', default: true },
    },
    required: ['name'],
};

export const deleteTypeTool = {
    name: 'delete_type',
    description: 'Deletes a custom type or domain.',
    inputSchema: DeleteTypeInputSchema,
    mcpInputSchema,
    outputSchema: DeleteTypeOutputSchema,

    execute: async (input: DeleteTypeInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, name, type, cascade, if_exists } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const ifExistsClause = if_exists ? 'IF EXISTS' : '';
        const cascadeClause = cascade ? 'CASCADE' : 'RESTRICT';
        const sql = `DROP ${type} ${ifExistsClause} "${schema}"."${name}" ${cascadeClause};`;

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            type_name: `${schema}.${name}`,
            message: `${type} ${schema}.${name} deleted.`,
        };
    },
};
