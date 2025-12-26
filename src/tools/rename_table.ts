import { z } from 'zod';
import type { ToolContext } from './types.js';

const RenameTableInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    name: z.string().describe('Current table name'),
    new_name: z.string().describe('New table name'),
});
type RenameTableInput = z.infer<typeof RenameTableInputSchema>;

const RenameTableOutputSchema = z.object({
    success: z.boolean(),
    old_name: z.string(),
    new_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public' },
        name: { type: 'string', description: 'Current table name' },
        new_name: { type: 'string', description: 'New table name' },
    },
    required: ['name', 'new_name'],
};

export const renameTableTool = {
    name: 'rename_table',
    description: 'Renames a table.',
    inputSchema: RenameTableInputSchema,
    mcpInputSchema,
    outputSchema: RenameTableOutputSchema,

    execute: async (input: RenameTableInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, name, new_name } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const sql = `ALTER TABLE "${schema}"."${name}" RENAME TO "${new_name}";`;

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            old_name: `${schema}.${name}`,
            new_name: `${schema}.${new_name}`,
            message: `Table renamed from ${name} to ${new_name}.`,
        };
    },
};
