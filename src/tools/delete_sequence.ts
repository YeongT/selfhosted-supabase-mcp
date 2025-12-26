import { z } from 'zod';
import type { ToolContext } from './types.js';

const DeleteSequenceInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    name: z.string().describe('Sequence name'),
    cascade: z.boolean().optional().default(false).describe('Drop dependent objects'),
    if_exists: z.boolean().optional().default(true).describe('Do not error if sequence does not exist'),
});
type DeleteSequenceInput = z.infer<typeof DeleteSequenceInputSchema>;

const DeleteSequenceOutputSchema = z.object({
    success: z.boolean(),
    sequence_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public' },
        name: { type: 'string', description: 'Sequence name' },
        cascade: { type: 'boolean', default: false },
        if_exists: { type: 'boolean', default: true },
    },
    required: ['name'],
};

export const deleteSequenceTool = {
    name: 'delete_sequence',
    description: 'Deletes a sequence.',
    inputSchema: DeleteSequenceInputSchema,
    mcpInputSchema,
    outputSchema: DeleteSequenceOutputSchema,

    execute: async (input: DeleteSequenceInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, name, cascade, if_exists } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const ifExistsClause = if_exists ? 'IF EXISTS' : '';
        const cascadeClause = cascade ? 'CASCADE' : 'RESTRICT';
        const sql = `DROP SEQUENCE ${ifExistsClause} "${schema}"."${name}" ${cascadeClause};`;

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            sequence_name: `${schema}.${name}`,
            message: `Sequence ${schema}.${name} deleted.`,
        };
    },
};
