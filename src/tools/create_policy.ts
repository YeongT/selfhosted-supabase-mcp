import { z } from 'zod';
import type { ToolContext } from './types.js';

const CreatePolicyInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    table: z.string().describe('Table name'),
    name: z.string().describe('Policy name'),
    action: z.enum(['PERMISSIVE', 'RESTRICTIVE']).optional().default('PERMISSIVE').describe('Policy action'),
    command: z.enum(['ALL', 'SELECT', 'INSERT', 'UPDATE', 'DELETE']).optional().default('ALL').describe('Command'),
    roles: z.array(z.string()).optional().default(['public']).describe('Roles to apply policy to'),
    using: z.string().optional().describe('USING expression for SELECT/UPDATE/DELETE'),
    check: z.string().optional().describe('WITH CHECK expression for INSERT/UPDATE'),
});
type CreatePolicyInput = z.infer<typeof CreatePolicyInputSchema>;

const CreatePolicyOutputSchema = z.object({
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
        action: { type: 'string', enum: ['PERMISSIVE', 'RESTRICTIVE'], default: 'PERMISSIVE' },
        command: { type: 'string', enum: ['ALL', 'SELECT', 'INSERT', 'UPDATE', 'DELETE'], default: 'ALL' },
        roles: { type: 'array', items: { type: 'string' }, default: ['public'] },
        using: { type: 'string', description: 'USING expression' },
        check: { type: 'string', description: 'WITH CHECK expression' },
    },
    required: ['table', 'name'],
};

export const createPolicyTool = {
    name: 'create_policy',
    description: 'Creates a new RLS policy on a table.',
    inputSchema: CreatePolicyInputSchema,
    mcpInputSchema,
    outputSchema: CreatePolicyOutputSchema,

    execute: async (input: CreatePolicyInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, table, name, action, command, roles, using, check } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const rolesStr = roles.map(r => `"${r}"`).join(', ');

        let sql = `CREATE POLICY "${name}" ON "${schema}"."${table}"`;
        sql += ` AS ${action}`;
        sql += ` FOR ${command}`;
        sql += ` TO ${rolesStr}`;

        if (using) {
            sql += ` USING (${using})`;
        }
        if (check) {
            sql += ` WITH CHECK (${check})`;
        }
        sql += ';';

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            policy_name: name,
            message: `Policy ${name} created on ${schema}.${table}.`,
        };
    },
};
