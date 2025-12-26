import { z } from 'zod';
import type { ToolContext } from './types.js';

const EnableExtensionInputSchema = z.object({
    name: z.string().describe('Extension name'),
    schema: z.string().optional().describe('Schema to install into'),
    version: z.string().optional().describe('Specific version to install'),
    if_not_exists: z.boolean().optional().default(true),
});
type EnableExtensionInput = z.infer<typeof EnableExtensionInputSchema>;

const EnableExtensionOutputSchema = z.object({
    success: z.boolean(),
    extension_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        name: { type: 'string', description: 'Extension name' },
        schema: { type: 'string', description: 'Schema to install into' },
        version: { type: 'string', description: 'Specific version' },
        if_not_exists: { type: 'boolean', default: true },
    },
    required: ['name'],
};

export const enableExtensionTool = {
    name: 'enable_extension',
    description: 'Enables (installs) a PostgreSQL extension.',
    inputSchema: EnableExtensionInputSchema,
    mcpInputSchema,
    outputSchema: EnableExtensionOutputSchema,

    execute: async (input: EnableExtensionInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { name, schema, version, if_not_exists } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const ifNotExistsClause = if_not_exists ? 'IF NOT EXISTS' : '';
        let sql = `CREATE EXTENSION ${ifNotExistsClause} "${name}"`;
        if (schema) sql += ` SCHEMA "${schema}"`;
        if (version) sql += ` VERSION '${version}'`;
        sql += ';';

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            extension_name: name,
            message: `Extension ${name} enabled.`,
        };
    },
};
