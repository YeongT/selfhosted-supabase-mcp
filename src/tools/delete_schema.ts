import { z } from 'zod';
import type { ToolContext } from './types.js';

const DeleteSchemaInputSchema = z.object({
    name: z.string().describe('Schema name'),
    cascade: z.boolean().optional().default(false).describe('Drop all objects in schema'),
    if_exists: z.boolean().optional().default(true).describe('Do not error if schema does not exist'),
});
type DeleteSchemaInput = z.infer<typeof DeleteSchemaInputSchema>;

const DeleteSchemaOutputSchema = z.object({
    success: z.boolean(),
    schema_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        name: { type: 'string', description: 'Schema name' },
        cascade: { type: 'boolean', default: false },
        if_exists: { type: 'boolean', default: true },
    },
    required: ['name'],
};

export const deleteSchemaTool = {
    name: 'delete_schema',
    description: 'Deletes a database schema.',
    inputSchema: DeleteSchemaInputSchema,
    mcpInputSchema,
    outputSchema: DeleteSchemaOutputSchema,

    execute: async (input: DeleteSchemaInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { name, cascade, if_exists } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const ifExistsClause = if_exists ? 'IF EXISTS' : '';
        const cascadeClause = cascade ? 'CASCADE' : 'RESTRICT';
        const sql = `DROP SCHEMA ${ifExistsClause} "${name}" ${cascadeClause};`;

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            schema_name: name,
            message: `Schema ${name} deleted.`,
        };
    },
};
