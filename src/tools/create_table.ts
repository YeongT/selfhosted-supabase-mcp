import { z } from 'zod';
import type { ToolContext } from './types.js';

const ColumnDefSchema = z.object({
    name: z.string(),
    type: z.string(),
    nullable: z.boolean().optional().default(true),
    default: z.string().optional(),
    primary_key: z.boolean().optional().default(false),
    unique: z.boolean().optional().default(false),
    references: z.object({
        table: z.string(),
        column: z.string(),
        on_delete: z.string().optional(),
    }).optional(),
});

const CreateTableInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    name: z.string().describe('Table name'),
    columns: z.array(ColumnDefSchema).min(1).describe('Column definitions'),
    if_not_exists: z.boolean().optional().default(true),
    enable_rls: z.boolean().optional().default(false).describe('Enable RLS on table'),
});
type CreateTableInput = z.infer<typeof CreateTableInputSchema>;

const CreateTableOutputSchema = z.object({
    success: z.boolean(),
    table_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public' },
        name: { type: 'string', description: 'Table name' },
        columns: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    type: { type: 'string' },
                    nullable: { type: 'boolean', default: true },
                    default: { type: 'string' },
                    primary_key: { type: 'boolean', default: false },
                    unique: { type: 'boolean', default: false },
                    references: {
                        type: 'object',
                        properties: {
                            table: { type: 'string' },
                            column: { type: 'string' },
                            on_delete: { type: 'string' },
                        },
                    },
                },
            },
        },
        if_not_exists: { type: 'boolean', default: true },
        enable_rls: { type: 'boolean', default: false },
    },
    required: ['name', 'columns'],
};

export const createTableTool = {
    name: 'create_table',
    description: 'Creates a new table with specified columns.',
    inputSchema: CreateTableInputSchema,
    mcpInputSchema,
    outputSchema: CreateTableOutputSchema,

    execute: async (input: CreateTableInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, name, columns, if_not_exists, enable_rls } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const columnDefs = columns.map(col => {
            let def = `"${col.name}" ${col.type}`;
            if (!col.nullable) def += ' NOT NULL';
            if (col.default) def += ` DEFAULT ${col.default}`;
            if (col.primary_key) def += ' PRIMARY KEY';
            if (col.unique && !col.primary_key) def += ' UNIQUE';
            if (col.references) {
                def += ` REFERENCES "${col.references.table}"("${col.references.column}")`;
                if (col.references.on_delete) def += ` ON DELETE ${col.references.on_delete}`;
            }
            return def;
        });

        const ifNotExistsClause = if_not_exists ? 'IF NOT EXISTS' : '';
        let sql = `CREATE TABLE ${ifNotExistsClause} "${schema}"."${name}" (\n  ${columnDefs.join(',\n  ')}\n);`;

        await client.executeSqlWithPg(sql);

        if (enable_rls) {
            await client.executeSqlWithPg(`ALTER TABLE "${schema}"."${name}" ENABLE ROW LEVEL SECURITY;`);
        }

        return {
            success: true,
            table_name: `${schema}.${name}`,
            message: `Table ${schema}.${name} created${enable_rls ? ' with RLS enabled' : ''}.`,
        };
    },
};
