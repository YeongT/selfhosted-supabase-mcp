import { z } from 'zod';
import type { ToolContext } from './types.js';

const DeletePolicyInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    table: z.string().describe('Table name'),
    name: z.string().describe('Policy name'),
    if_exists: z.boolean().optional().default(true).describe('Do not error if policy does not exist'),
});
type DeletePolicyInput = z.infer<typeof DeletePolicyInputSchema>;

const DeletePolicyOutputSchema = z.object({
    success: z.boolean(),
    policy_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public', description: 'Schema name' },
        table: { type: 'string', description: 'Table name' },
        name: { type: 'string', description: 'Policy name' },
        if_exists: { type: 'boolean', default: true },
    },
    required: ['table', 'name'],
};

export const deletePolicyTool = {
    name: 'delete_policy',
    description: 'Deletes an RLS policy from a table.',
    inputSchema: DeletePolicyInputSchema,
    mcpInputSchema,
    outputSchema: DeletePolicyOutputSchema,

    execute: async (input: DeletePolicyInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, table, name, if_exists } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const ifExistsClause = if_exists ? 'IF EXISTS' : '';
        const sql = `DROP POLICY ${ifExistsClause} "${name}" ON "${schema}"."${table}";`;

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            policy_name: name,
            message: `Policy ${name} deleted from ${schema}.${table}.`,
        };
    },
};
