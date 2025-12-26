import { z } from 'zod';
import type { ToolContext } from './types.js';

const CreateForeignKeyInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    table: z.string().describe('Table name'),
    name: z.string().describe('Constraint name'),
    columns: z.array(z.string()).min(1).describe('Columns in this table'),
    foreign_schema: z.string().optional().default('public').describe('Referenced schema'),
    foreign_table: z.string().describe('Referenced table'),
    foreign_columns: z.array(z.string()).min(1).describe('Referenced columns'),
    on_update: z.enum(['NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT']).optional().default('NO ACTION'),
    on_delete: z.enum(['NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT']).optional().default('NO ACTION'),
    deferrable: z.boolean().optional().default(false).describe('Deferrable constraint'),
    initially_deferred: z.boolean().optional().default(false).describe('Initially deferred'),
});
type CreateForeignKeyInput = z.infer<typeof CreateForeignKeyInputSchema>;

const CreateForeignKeyOutputSchema = z.object({
    success: z.boolean(),
    constraint_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public' },
        table: { type: 'string', description: 'Table name' },
        name: { type: 'string', description: 'Constraint name' },
        columns: { type: 'array', items: { type: 'string' } },
        foreign_schema: { type: 'string', default: 'public' },
        foreign_table: { type: 'string', description: 'Referenced table' },
        foreign_columns: { type: 'array', items: { type: 'string' } },
        on_update: { type: 'string', enum: ['NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT'] },
        on_delete: { type: 'string', enum: ['NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT'] },
        deferrable: { type: 'boolean', default: false },
        initially_deferred: { type: 'boolean', default: false },
    },
    required: ['table', 'name', 'columns', 'foreign_table', 'foreign_columns'],
};

export const createForeignKeyTool = {
    name: 'create_foreign_key',
    description: 'Creates a new foreign key constraint.',
    inputSchema: CreateForeignKeyInputSchema,
    mcpInputSchema,
    outputSchema: CreateForeignKeyOutputSchema,

    execute: async (input: CreateForeignKeyInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, table, name, columns, foreign_schema, foreign_table, foreign_columns, on_update, on_delete, deferrable, initially_deferred } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        if (columns.length !== foreign_columns.length) {
            throw new Error('Number of columns must match number of foreign columns.');
        }

        const columnsStr = columns.map(c => `"${c}"`).join(', ');
        const foreignColumnsStr = foreign_columns.map(c => `"${c}"`).join(', ');

        let sql = `ALTER TABLE "${schema}"."${table}" ADD CONSTRAINT "${name}"`;
        sql += ` FOREIGN KEY (${columnsStr})`;
        sql += ` REFERENCES "${foreign_schema}"."${foreign_table}" (${foreignColumnsStr})`;
        sql += ` ON UPDATE ${on_update}`;
        sql += ` ON DELETE ${on_delete}`;

        if (deferrable) {
            sql += ' DEFERRABLE';
            if (initially_deferred) {
                sql += ' INITIALLY DEFERRED';
            }
        }
        sql += ';';

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            constraint_name: name,
            message: `Foreign key ${name} created on ${schema}.${table}.`,
        };
    },
};
