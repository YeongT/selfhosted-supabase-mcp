import { z } from 'zod';
import type { ToolContext } from './types.js';

const ListPoliciesInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    table: z.string().optional().describe('Filter by table name'),
});
type ListPoliciesInput = z.infer<typeof ListPoliciesInputSchema>;

const PolicySchema = z.object({
    schema: z.string(),
    table: z.string(),
    name: z.string(),
    action: z.string(),
    roles: z.array(z.string()),
    cmd: z.string(),
    using_expression: z.string().nullable(),
    check_expression: z.string().nullable(),
});
const ListPoliciesOutputSchema = z.array(PolicySchema);

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public', description: 'Schema name' },
        table: { type: 'string', description: 'Filter by table name' },
    },
    required: [],
};

export const listPoliciesTool = {
    name: 'list_policies',
    description: 'Lists all RLS policies in the specified schema.',
    inputSchema: ListPoliciesInputSchema,
    mcpInputSchema,
    outputSchema: ListPoliciesOutputSchema,

    execute: async (input: ListPoliciesInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, table } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        let sql = `
            SELECT
                n.nspname as schema,
                c.relname as table,
                pol.polname as name,
                CASE pol.polpermissive WHEN TRUE THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END as action,
                ARRAY(SELECT rolname FROM pg_roles WHERE oid = ANY(pol.polroles)) as roles,
                CASE pol.polcmd
                    WHEN 'r' THEN 'SELECT'
                    WHEN 'a' THEN 'INSERT'
                    WHEN 'w' THEN 'UPDATE'
                    WHEN 'd' THEN 'DELETE'
                    WHEN '*' THEN 'ALL'
                END as cmd,
                pg_get_expr(pol.polqual, pol.polrelid) as using_expression,
                pg_get_expr(pol.polwithcheck, pol.polrelid) as check_expression
            FROM pg_policy pol
            JOIN pg_class c ON c.oid = pol.polrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = $1
        `;

        const params: string[] = [schema];
        if (table) {
            sql += ` AND c.relname = $2`;
            params.push(table);
        }

        sql += ` ORDER BY c.relname, pol.polname;`;

        const result = await client.executeSqlWithPg(sql, params);
        return ListPoliciesOutputSchema.parse(result);
    },
};
