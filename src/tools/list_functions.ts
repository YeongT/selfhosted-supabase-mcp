import { z } from 'zod';
import type { ToolContext } from './types.js';

const ListFunctionsInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name to filter functions'),
});
type ListFunctionsInput = z.infer<typeof ListFunctionsInputSchema>;

const FunctionSchema = z.object({
    schema: z.string(),
    name: z.string(),
    language: z.string(),
    return_type: z.string(),
    argument_types: z.string(),
    definition: z.string().nullable(),
    security_definer: z.boolean(),
});
const ListFunctionsOutputSchema = z.array(FunctionSchema);

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public', description: 'Schema name to filter functions' },
    },
    required: [],
};

export const listFunctionsTool = {
    name: 'list_functions',
    description: 'Lists all user-defined functions (RPC) in the specified schema.',
    inputSchema: ListFunctionsInputSchema,
    mcpInputSchema,
    outputSchema: ListFunctionsOutputSchema,

    execute: async (input: ListFunctionsInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const sql = `
            SELECT
                n.nspname as schema,
                p.proname as name,
                l.lanname as language,
                pg_get_function_result(p.oid) as return_type,
                pg_get_function_arguments(p.oid) as argument_types,
                pg_get_functiondef(p.oid) as definition,
                p.prosecdef as security_definer
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            JOIN pg_language l ON p.prolang = l.oid
            WHERE n.nspname = $1
              AND p.prokind = 'f'
              AND NOT p.proisagg
            ORDER BY p.proname;
        `;

        const result = await client.executeSqlWithPg(sql, [schema]);
        return ListFunctionsOutputSchema.parse(result);
    },
};
