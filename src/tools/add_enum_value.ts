import { z } from 'zod';
import type { ToolContext } from './types.js';

const AddEnumValueInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    name: z.string().describe('Enum type name'),
    value: z.string().describe('New value to add'),
    before: z.string().optional().describe('Add before this value'),
    after: z.string().optional().describe('Add after this value'),
    if_not_exists: z.boolean().optional().default(true).describe('Do not error if value already exists'),
});
type AddEnumValueInput = z.infer<typeof AddEnumValueInputSchema>;

const AddEnumValueOutputSchema = z.object({
    success: z.boolean(),
    enum_name: z.string(),
    value: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public', description: 'Schema name' },
        name: { type: 'string', description: 'Enum type name' },
        value: { type: 'string', description: 'New value to add' },
        before: { type: 'string', description: 'Add before this value' },
        after: { type: 'string', description: 'Add after this value' },
        if_not_exists: { type: 'boolean', default: true },
    },
    required: ['name', 'value'],
};

export const addEnumValueTool = {
    name: 'add_enum_value',
    description: 'Adds a new value to an existing enum type.',
    inputSchema: AddEnumValueInputSchema,
    mcpInputSchema,
    outputSchema: AddEnumValueOutputSchema,

    execute: async (input: AddEnumValueInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, name, value, before, after, if_not_exists } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        if (before && after) {
            throw new Error('Cannot specify both before and after.');
        }

        const ifNotExistsClause = if_not_exists ? 'IF NOT EXISTS' : '';
        const escapedValue = value.replace(/'/g, "''");

        let sql = `ALTER TYPE "${schema}"."${name}" ADD VALUE ${ifNotExistsClause} '${escapedValue}'`;

        if (before) {
            sql += ` BEFORE '${before.replace(/'/g, "''")}'`;
        } else if (after) {
            sql += ` AFTER '${after.replace(/'/g, "''")}'`;
        }
        sql += ';';

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            enum_name: `${schema}.${name}`,
            value,
            message: `Value '${value}' added to enum ${schema}.${name}.`,
        };
    },
};
