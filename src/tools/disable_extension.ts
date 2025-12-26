import { z } from 'zod';
import type { ToolContext } from './types.js';

const DisableExtensionInputSchema = z.object({
    name: z.string().describe('Extension name'),
    cascade: z.boolean().optional().default(false).describe('Drop dependent objects'),
    if_exists: z.boolean().optional().default(true),
});
type DisableExtensionInput = z.infer<typeof DisableExtensionInputSchema>;

const DisableExtensionOutputSchema = z.object({
    success: z.boolean(),
    extension_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        name: { type: 'string', description: 'Extension name' },
        cascade: { type: 'boolean', default: false },
        if_exists: { type: 'boolean', default: true },
    },
    required: ['name'],
};

export const disableExtensionTool = {
    name: 'disable_extension',
    description: 'Disables (drops) a PostgreSQL extension.',
    inputSchema: DisableExtensionInputSchema,
    mcpInputSchema,
    outputSchema: DisableExtensionOutputSchema,

    execute: async (input: DisableExtensionInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { name, cascade, if_exists } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const ifExistsClause = if_exists ? 'IF EXISTS' : '';
        const cascadeClause = cascade ? 'CASCADE' : 'RESTRICT';
        const sql = `DROP EXTENSION ${ifExistsClause} "${name}" ${cascadeClause};`;

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            extension_name: name,
            message: `Extension ${name} disabled.`,
        };
    },
};
