import { z } from 'zod';
import type { ToolContext } from './types.js';

const GrantPermissionInputSchema = z.object({
    permissions: z.array(z.enum(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'ALL'])).min(1),
    on_type: z.enum(['TABLE', 'SCHEMA', 'FUNCTION', 'SEQUENCE', 'ALL TABLES IN SCHEMA', 'ALL SEQUENCES IN SCHEMA', 'ALL FUNCTIONS IN SCHEMA']),
    schema: z.string().optional().default('public'),
    object_name: z.string().optional().describe('Object name (table, function, etc.) - not needed for ALL ... IN SCHEMA'),
    to_role: z.string().describe('Role to grant permissions to'),
    with_grant_option: z.boolean().optional().default(false).describe('Allow role to grant to others'),
});
type GrantPermissionInput = z.infer<typeof GrantPermissionInputSchema>;

const GrantPermissionOutputSchema = z.object({
    success: z.boolean(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        permissions: { type: 'array', items: { type: 'string' } },
        on_type: { type: 'string', enum: ['TABLE', 'SCHEMA', 'FUNCTION', 'SEQUENCE', 'ALL TABLES IN SCHEMA', 'ALL SEQUENCES IN SCHEMA', 'ALL FUNCTIONS IN SCHEMA'] },
        schema: { type: 'string', default: 'public' },
        object_name: { type: 'string' },
        to_role: { type: 'string', description: 'Role to grant to' },
        with_grant_option: { type: 'boolean', default: false },
    },
    required: ['permissions', 'on_type', 'to_role'],
};

export const grantPermissionTool = {
    name: 'grant_permission',
    description: 'Grants permissions to a role on database objects.',
    inputSchema: GrantPermissionInputSchema,
    mcpInputSchema,
    outputSchema: GrantPermissionOutputSchema,

    execute: async (input: GrantPermissionInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { permissions, on_type, schema, object_name, to_role, with_grant_option } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const permsStr = permissions.join(', ');
        const grantOption = with_grant_option ? ' WITH GRANT OPTION' : '';

        let sql: string;

        switch (on_type) {
            case 'TABLE':
                if (!object_name) throw new Error('object_name required for TABLE');
                sql = `GRANT ${permsStr} ON TABLE "${schema}"."${object_name}" TO "${to_role}"${grantOption}`;
                break;
            case 'SCHEMA':
                sql = `GRANT USAGE ON SCHEMA "${schema}" TO "${to_role}"${grantOption}`;
                break;
            case 'FUNCTION':
                if (!object_name) throw new Error('object_name required for FUNCTION');
                sql = `GRANT EXECUTE ON FUNCTION "${schema}"."${object_name}" TO "${to_role}"${grantOption}`;
                break;
            case 'SEQUENCE':
                if (!object_name) throw new Error('object_name required for SEQUENCE');
                sql = `GRANT ${permsStr} ON SEQUENCE "${schema}"."${object_name}" TO "${to_role}"${grantOption}`;
                break;
            case 'ALL TABLES IN SCHEMA':
                sql = `GRANT ${permsStr} ON ALL TABLES IN SCHEMA "${schema}" TO "${to_role}"${grantOption}`;
                break;
            case 'ALL SEQUENCES IN SCHEMA':
                sql = `GRANT ${permsStr} ON ALL SEQUENCES IN SCHEMA "${schema}" TO "${to_role}"${grantOption}`;
                break;
            case 'ALL FUNCTIONS IN SCHEMA':
                sql = `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA "${schema}" TO "${to_role}"${grantOption}`;
                break;
            default:
                throw new Error(`Unknown on_type: ${on_type}`);
        }

        sql += ';';

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            message: `Granted ${permsStr} on ${on_type} to ${to_role}.`,
        };
    },
};
