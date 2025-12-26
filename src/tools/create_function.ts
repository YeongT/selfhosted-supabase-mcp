import { z } from 'zod';
import type { ToolContext } from './types.js';

const CreateFunctionInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    name: z.string().describe('Function name'),
    arguments: z.string().optional().default('').describe('Function arguments (e.g., "user_id uuid, amount integer")'),
    returns: z.string().describe('Return type (e.g., "void", "json", "table(id uuid, name text)")'),
    language: z.string().optional().default('plpgsql').describe('Language (plpgsql, sql, etc.)'),
    body: z.string().describe('Function body'),
    security_definer: z.boolean().optional().default(false).describe('Run with definer privileges'),
    replace: z.boolean().optional().default(true).describe('Use CREATE OR REPLACE'),
});
type CreateFunctionInput = z.infer<typeof CreateFunctionInputSchema>;

const CreateFunctionOutputSchema = z.object({
    success: z.boolean(),
    function_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public', description: 'Schema name' },
        name: { type: 'string', description: 'Function name' },
        arguments: { type: 'string', description: 'Function arguments' },
        returns: { type: 'string', description: 'Return type' },
        language: { type: 'string', default: 'plpgsql', description: 'Language' },
        body: { type: 'string', description: 'Function body' },
        security_definer: { type: 'boolean', default: false, description: 'Security definer' },
        replace: { type: 'boolean', default: true, description: 'Use CREATE OR REPLACE' },
    },
    required: ['name', 'returns', 'body'],
};

export const createFunctionTool = {
    name: 'create_function',
    description: 'Creates or replaces a PostgreSQL function (RPC).',
    inputSchema: CreateFunctionInputSchema,
    mcpInputSchema,
    outputSchema: CreateFunctionOutputSchema,

    execute: async (input: CreateFunctionInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, name, arguments: args, returns, language, body, security_definer, replace } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const createOrReplace = replace ? 'CREATE OR REPLACE' : 'CREATE';
        const securityClause = security_definer ? 'SECURITY DEFINER' : 'SECURITY INVOKER';

        const sql = `
            ${createOrReplace} FUNCTION "${schema}"."${name}"(${args})
            RETURNS ${returns}
            LANGUAGE ${language}
            ${securityClause}
            AS $function$
            ${body}
            $function$;
        `;

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            function_name: `${schema}.${name}`,
            message: `Function ${schema}.${name} created successfully.`,
        };
    },
};
