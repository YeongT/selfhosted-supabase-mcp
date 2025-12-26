import { z } from 'zod';
import type { ToolContext } from './types.js';

const DeleteEnumInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    name: z.string().describe('Enum type name'),
    cascade: z.boolean().optional().default(false).describe('Drop dependent objects'),
    if_exists: z.boolean().optional().default(true).describe('Do not error if type does not exist'),
});
type DeleteEnumInput = z.infer<typeof DeleteEnumInputSchema>;

const DeleteEnumOutputSchema = z.object({
    success: z.boolean(),
    enum_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public', description: 'Schema name' },
        name: { type: 'string', description: 'Enum type name' },
        cascade: { type: 'boolean', default: false, description: 'Drop dependent objects' },
        if_exists: { type: 'boolean', default: true },
    },
    required: ['name'],
};

export const deleteEnumTool = {
    name: 'delete_enum',
    description: 'Deletes an enum type.',
    inputSchema: DeleteEnumInputSchema,
    mcpInputSchema,
    outputSchema: DeleteEnumOutputSchema,

    execute: async (input: DeleteEnumInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, name, cascade, if_exists } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const ifExistsClause = if_exists ? 'IF EXISTS' : '';
        const cascadeClause = cascade ? 'CASCADE' : 'RESTRICT';
        const sql = `DROP TYPE ${ifExistsClause} "${schema}"."${name}" ${cascadeClause};`;

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            enum_name: `${schema}.${name}`,
            message: `Enum ${schema}.${name} deleted.`,
        };
    },
};
