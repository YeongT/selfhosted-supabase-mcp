import { z } from 'zod';
import type { ToolContext } from './types.js';

const ListTypesInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
});
type ListTypesInput = z.infer<typeof ListTypesInputSchema>;

const TypeSchema = z.object({
    schema: z.string(),
    name: z.string(),
    type: z.string(),
    owner: z.string(),
    description: z.string().nullable(),
});
const ListTypesOutputSchema = z.array(TypeSchema);

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public', description: 'Schema name' },
    },
    required: [],
};

export const listTypesTool = {
    name: 'list_types',
    description: 'Lists all custom types (composite, enum, domain, range) in the specified schema.',
    inputSchema: ListTypesInputSchema,
    mcpInputSchema,
    outputSchema: ListTypesOutputSchema,

    execute: async (input: ListTypesInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const sql = `
            SELECT
                n.nspname as schema,
                t.typname as name,
                CASE t.typtype
                    WHEN 'c' THEN 'composite'
                    WHEN 'e' THEN 'enum'
                    WHEN 'd' THEN 'domain'
                    WHEN 'r' THEN 'range'
                    ELSE 'other'
                END as type,
                pg_get_userbyid(t.typowner) as owner,
                d.description
            FROM pg_type t
            JOIN pg_namespace n ON n.oid = t.typnamespace
            LEFT JOIN pg_description d ON d.objoid = t.oid
            WHERE n.nspname = $1
              AND t.typtype IN ('c', 'e', 'd', 'r')
              AND NOT EXISTS (
                  SELECT 1 FROM pg_class c
                  WHERE c.reltype = t.oid AND c.relkind != 'c'
              )
            ORDER BY t.typname;
        `;

        const result = await client.executeSqlWithPg(sql, [schema]);
        return ListTypesOutputSchema.parse(result);
    },
};
