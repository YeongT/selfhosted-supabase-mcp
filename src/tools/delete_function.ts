import { z } from 'zod';
import type { ToolContext } from './types.js';

const DeleteFunctionInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    name: z.string().describe('Function name'),
    arguments: z.string().optional().describe('Function argument types for overloaded functions (e.g., "uuid, integer")'),
    cascade: z.boolean().optional().default(false).describe('Drop dependent objects'),
    if_exists: z.boolean().optional().default(true).describe('Do not error if function does not exist'),
});
type DeleteFunctionInput = z.infer<typeof DeleteFunctionInputSchema>;

const DeleteFunctionOutputSchema = z.object({
    success: z.boolean(),
    function_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public', description: 'Schema name' },
        name: { type: 'string', description: 'Function name' },
        arguments: { type: 'string', description: 'Argument types for overloaded functions' },
        cascade: { type: 'boolean', default: false, description: 'Drop dependent objects' },
        if_exists: { type: 'boolean', default: true, description: 'Ignore if not exists' },
    },
    required: ['name'],
};

export const deleteFunctionTool = {
    name: 'delete_function',
    description: 'Deletes a PostgreSQL function (RPC).',
    inputSchema: DeleteFunctionInputSchema,
    mcpInputSchema,
    outputSchema: DeleteFunctionOutputSchema,

    execute: async (input: DeleteFunctionInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, name, arguments: args, cascade, if_exists } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const ifExistsClause = if_exists ? 'IF EXISTS' : '';
        const cascadeClause = cascade ? 'CASCADE' : 'RESTRICT';
        const argsClause = args ? `(${args})` : '';

        const sql = `DROP FUNCTION ${ifExistsClause} "${schema}"."${name}"${argsClause} ${cascadeClause};`;

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            function_name: `${schema}.${name}`,
            message: `Function ${schema}.${name} deleted successfully.`,
        };
    },
};
