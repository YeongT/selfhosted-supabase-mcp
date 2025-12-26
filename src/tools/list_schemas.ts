import { z } from 'zod';
import type { ToolContext } from './types.js';

const ListSchemasInputSchema = z.object({
    include_system: z.boolean().optional().default(false).describe('Include system schemas'),
});
type ListSchemasInput = z.infer<typeof ListSchemasInputSchema>;

const SchemaSchema = z.object({
    name: z.string(),
    owner: z.string(),
    description: z.string().nullable(),
});
const ListSchemasOutputSchema = z.array(SchemaSchema);

const mcpInputSchema = {
    type: 'object',
    properties: {
        include_system: { type: 'boolean', default: false, description: 'Include system schemas' },
    },
    required: [],
};

export const listSchemasTool = {
    name: 'list_schemas',
    description: 'Lists all database schemas.',
    inputSchema: ListSchemasInputSchema,
    mcpInputSchema,
    outputSchema: ListSchemasOutputSchema,

    execute: async (input: ListSchemasInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { include_system } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        let sql = `
            SELECT
                n.nspname as name,
                pg_get_userbyid(n.nspowner) as owner,
                d.description
            FROM pg_namespace n
            LEFT JOIN pg_description d ON d.objoid = n.oid AND d.classoid = 'pg_namespace'::regclass
        `;

        if (!include_system) {
            sql += ` WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
                     AND n.nspname NOT LIKE 'pg_temp_%'
                     AND n.nspname NOT LIKE 'pg_toast_temp_%'`;
        }

        sql += ` ORDER BY n.nspname;`;

        const result = await client.executeSqlWithPg(sql);
        return ListSchemasOutputSchema.parse(result);
    },
};
