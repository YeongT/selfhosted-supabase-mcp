import { z } from 'zod';
import type { ToolContext } from './types.js';

const ListEnumsInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
});
type ListEnumsInput = z.infer<typeof ListEnumsInputSchema>;

const EnumSchema = z.object({
    schema: z.string(),
    name: z.string(),
    values: z.array(z.string()),
});
const ListEnumsOutputSchema = z.array(EnumSchema);

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public', description: 'Schema name' },
    },
    required: [],
};

export const listEnumsTool = {
    name: 'list_enums',
    description: 'Lists all enum types in the specified schema.',
    inputSchema: ListEnumsInputSchema,
    mcpInputSchema,
    outputSchema: ListEnumsOutputSchema,

    execute: async (input: ListEnumsInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const sql = `
            SELECT
                n.nspname as schema,
                t.typname as name,
                ARRAY(
                    SELECT e.enumlabel
                    FROM pg_enum e
                    WHERE e.enumtypid = t.oid
                    ORDER BY e.enumsortorder
                ) as values
            FROM pg_type t
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE t.typtype = 'e'
              AND n.nspname = $1
            ORDER BY t.typname;
        `;

        const result = await client.executeSqlWithPg(sql, [schema]);
        return ListEnumsOutputSchema.parse(result);
    },
};
