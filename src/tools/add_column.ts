import { z } from 'zod';
import type { ToolContext } from './types.js';

const AddColumnInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    table: z.string().describe('Table name'),
    name: z.string().describe('Column name'),
    type: z.string().describe('Column data type'),
    nullable: z.boolean().optional().default(true).describe('Allow NULL values'),
    default: z.string().optional().describe('Default value'),
    unique: z.boolean().optional().default(false).describe('Add unique constraint'),
    if_not_exists: z.boolean().optional().default(true).describe('Do not error if column exists'),
});
type AddColumnInput = z.infer<typeof AddColumnInputSchema>;

const AddColumnOutputSchema = z.object({
    success: z.boolean(),
    column_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public' },
        table: { type: 'string', description: 'Table name' },
        name: { type: 'string', description: 'Column name' },
        type: { type: 'string', description: 'Data type' },
        nullable: { type: 'boolean', default: true },
        default: { type: 'string' },
        unique: { type: 'boolean', default: false },
        if_not_exists: { type: 'boolean', default: true },
    },
    required: ['table', 'name', 'type'],
};

export const addColumnTool = {
    name: 'add_column',
    description: 'Adds a new column to a table.',
    inputSchema: AddColumnInputSchema,
    mcpInputSchema,
    outputSchema: AddColumnOutputSchema,

    execute: async (input: AddColumnInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, table, name, type, nullable, default: defaultValue, unique, if_not_exists } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const ifNotExistsClause = if_not_exists ? 'IF NOT EXISTS' : '';
        let sql = `ALTER TABLE "${schema}"."${table}" ADD COLUMN ${ifNotExistsClause} "${name}" ${type}`;
        if (!nullable) sql += ' NOT NULL';
        if (defaultValue) sql += ` DEFAULT ${defaultValue}`;
        if (unique) sql += ' UNIQUE';
        sql += ';';

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            column_name: name,
            message: `Column ${name} added to ${schema}.${table}.`,
        };
    },
};
