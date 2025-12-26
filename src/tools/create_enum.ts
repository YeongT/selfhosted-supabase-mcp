import { z } from 'zod';
import type { ToolContext } from './types.js';

const CreateEnumInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    name: z.string().describe('Enum type name'),
    values: z.array(z.string()).min(1).describe('Enum values'),
});
type CreateEnumInput = z.infer<typeof CreateEnumInputSchema>;

const CreateEnumOutputSchema = z.object({
    success: z.boolean(),
    enum_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public', description: 'Schema name' },
        name: { type: 'string', description: 'Enum type name' },
        values: { type: 'array', items: { type: 'string' }, description: 'Enum values' },
    },
    required: ['name', 'values'],
};

export const createEnumTool = {
    name: 'create_enum',
    description: 'Creates a new enum type.',
    inputSchema: CreateEnumInputSchema,
    mcpInputSchema,
    outputSchema: CreateEnumOutputSchema,

    execute: async (input: CreateEnumInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, name, values } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const valuesStr = values.map(v => `'${v.replace(/'/g, "''")}'`).join(', ');
        const sql = `CREATE TYPE "${schema}"."${name}" AS ENUM (${valuesStr});`;

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            enum_name: `${schema}.${name}`,
            message: `Enum ${schema}.${name} created with values: ${values.join(', ')}.`,
        };
    },
};
