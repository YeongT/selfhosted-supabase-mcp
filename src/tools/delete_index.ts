import { z } from 'zod';
import type { ToolContext } from './types.js';

const DeleteIndexInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    name: z.string().describe('Index name'),
    cascade: z.boolean().optional().default(false).describe('Drop dependent objects'),
    concurrently: z.boolean().optional().default(false).describe('Drop index concurrently'),
    if_exists: z.boolean().optional().default(true).describe('Do not error if index does not exist'),
});
type DeleteIndexInput = z.infer<typeof DeleteIndexInputSchema>;

const DeleteIndexOutputSchema = z.object({
    success: z.boolean(),
    index_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public' },
        name: { type: 'string', description: 'Index name' },
        cascade: { type: 'boolean', default: false },
        concurrently: { type: 'boolean', default: false },
        if_exists: { type: 'boolean', default: true },
    },
    required: ['name'],
};

export const deleteIndexTool = {
    name: 'delete_index',
    description: 'Deletes an index.',
    inputSchema: DeleteIndexInputSchema,
    mcpInputSchema,
    outputSchema: DeleteIndexOutputSchema,

    execute: async (input: DeleteIndexInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, name, cascade, concurrently, if_exists } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const concurrentlyClause = concurrently ? 'CONCURRENTLY' : '';
        const ifExistsClause = if_exists ? 'IF EXISTS' : '';
        const cascadeClause = cascade ? 'CASCADE' : 'RESTRICT';
        const sql = `DROP INDEX ${concurrentlyClause} ${ifExistsClause} "${schema}"."${name}" ${cascadeClause};`;

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            index_name: `${schema}.${name}`,
            message: `Index ${schema}.${name} deleted.`,
        };
    },
};
