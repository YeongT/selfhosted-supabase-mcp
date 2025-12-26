import { z } from 'zod';
import type { ToolContext } from './types.js';

const AlterColumnInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    table: z.string().describe('Table name'),
    name: z.string().describe('Column name'),
    new_name: z.string().optional().describe('Rename column to'),
    type: z.string().optional().describe('Change data type'),
    using: z.string().optional().describe('USING expression for type conversion'),
    set_nullable: z.boolean().optional().describe('Set or drop NOT NULL'),
    set_default: z.string().optional().describe('Set default value'),
    drop_default: z.boolean().optional().describe('Drop default value'),
});
type AlterColumnInput = z.infer<typeof AlterColumnInputSchema>;

const AlterColumnOutputSchema = z.object({
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
        new_name: { type: 'string' },
        type: { type: 'string' },
        using: { type: 'string' },
        set_nullable: { type: 'boolean' },
        set_default: { type: 'string' },
        drop_default: { type: 'boolean' },
    },
    required: ['table', 'name'],
};

export const alterColumnTool = {
    name: 'alter_column',
    description: 'Alters a column (rename, change type, set/drop NOT NULL, set/drop default).',
    inputSchema: AlterColumnInputSchema,
    mcpInputSchema,
    outputSchema: AlterColumnOutputSchema,

    execute: async (input: AlterColumnInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, table, name, new_name, type, using, set_nullable, set_default, drop_default } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const alterations: string[] = [];

        if (new_name) {
            alterations.push(`ALTER TABLE "${schema}"."${table}" RENAME COLUMN "${name}" TO "${new_name}"`);
        }

        const colName = new_name || name;

        if (type) {
            let typeChange = `ALTER TABLE "${schema}"."${table}" ALTER COLUMN "${colName}" TYPE ${type}`;
            if (using) typeChange += ` USING ${using}`;
            alterations.push(typeChange);
        }

        if (set_nullable !== undefined) {
            if (set_nullable) {
                alterations.push(`ALTER TABLE "${schema}"."${table}" ALTER COLUMN "${colName}" DROP NOT NULL`);
            } else {
                alterations.push(`ALTER TABLE "${schema}"."${table}" ALTER COLUMN "${colName}" SET NOT NULL`);
            }
        }

        if (set_default) {
            alterations.push(`ALTER TABLE "${schema}"."${table}" ALTER COLUMN "${colName}" SET DEFAULT ${set_default}`);
        }

        if (drop_default) {
            alterations.push(`ALTER TABLE "${schema}"."${table}" ALTER COLUMN "${colName}" DROP DEFAULT`);
        }

        if (alterations.length === 0) {
            throw new Error('No alterations specified.');
        }

        for (const sql of alterations) {
            await client.executeSqlWithPg(sql + ';');
        }

        return {
            success: true,
            column_name: colName,
            message: `Column ${name} altered in ${schema}.${table}.`,
        };
    },
};
