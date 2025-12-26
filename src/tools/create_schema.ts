import { z } from 'zod';
import type { ToolContext } from './types.js';

const CreateSchemaInputSchema = z.object({
    name: z.string().describe('Schema name'),
    owner: z.string().optional().describe('Owner role'),
    if_not_exists: z.boolean().optional().default(true).describe('Do not error if schema exists'),
});
type CreateSchemaInput = z.infer<typeof CreateSchemaInputSchema>;

const CreateSchemaOutputSchema = z.object({
    success: z.boolean(),
    schema_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        name: { type: 'string', description: 'Schema name' },
        owner: { type: 'string', description: 'Owner role' },
        if_not_exists: { type: 'boolean', default: true },
    },
    required: ['name'],
};

export const createSchemaTool = {
    name: 'create_schema',
    description: 'Creates a new database schema.',
    inputSchema: CreateSchemaInputSchema,
    mcpInputSchema,
    outputSchema: CreateSchemaOutputSchema,

    execute: async (input: CreateSchemaInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { name, owner, if_not_exists } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const ifNotExistsClause = if_not_exists ? 'IF NOT EXISTS' : '';
        let sql = `CREATE SCHEMA ${ifNotExistsClause} "${name}"`;
        if (owner) {
            sql += ` AUTHORIZATION "${owner}"`;
        }
        sql += ';';

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            schema_name: name,
            message: `Schema ${name} created.`,
        };
    },
};
