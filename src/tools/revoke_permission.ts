import { z } from 'zod';
import type { ToolContext } from './types.js';

const RevokePermissionInputSchema = z.object({
    permissions: z.array(z.enum(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'ALL'])).min(1),
    on_type: z.enum(['TABLE', 'SCHEMA', 'FUNCTION', 'SEQUENCE', 'ALL TABLES IN SCHEMA', 'ALL SEQUENCES IN SCHEMA', 'ALL FUNCTIONS IN SCHEMA']),
    schema: z.string().optional().default('public'),
    object_name: z.string().optional().describe('Object name'),
    from_role: z.string().describe('Role to revoke permissions from'),
    cascade: z.boolean().optional().default(false).describe('Revoke from dependent privileges'),
});
type RevokePermissionInput = z.infer<typeof RevokePermissionInputSchema>;

const RevokePermissionOutputSchema = z.object({
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
        from_role: { type: 'string', description: 'Role to revoke from' },
        cascade: { type: 'boolean', default: false },
    },
    required: ['permissions', 'on_type', 'from_role'],
};

export const revokePermissionTool = {
    name: 'revoke_permission',
    description: 'Revokes permissions from a role on database objects.',
    inputSchema: RevokePermissionInputSchema,
    mcpInputSchema,
    outputSchema: RevokePermissionOutputSchema,

    execute: async (input: RevokePermissionInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { permissions, on_type, schema, object_name, from_role, cascade } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const permsStr = permissions.join(', ');
        const cascadeClause = cascade ? ' CASCADE' : '';

        let sql: string;

        switch (on_type) {
            case 'TABLE':
                if (!object_name) throw new Error('object_name required for TABLE');
                sql = `REVOKE ${permsStr} ON TABLE "${schema}"."${object_name}" FROM "${from_role}"${cascadeClause}`;
                break;
            case 'SCHEMA':
                sql = `REVOKE USAGE ON SCHEMA "${schema}" FROM "${from_role}"${cascadeClause}`;
                break;
            case 'FUNCTION':
                if (!object_name) throw new Error('object_name required for FUNCTION');
                sql = `REVOKE EXECUTE ON FUNCTION "${schema}"."${object_name}" FROM "${from_role}"${cascadeClause}`;
                break;
            case 'SEQUENCE':
                if (!object_name) throw new Error('object_name required for SEQUENCE');
                sql = `REVOKE ${permsStr} ON SEQUENCE "${schema}"."${object_name}" FROM "${from_role}"${cascadeClause}`;
                break;
            case 'ALL TABLES IN SCHEMA':
                sql = `REVOKE ${permsStr} ON ALL TABLES IN SCHEMA "${schema}" FROM "${from_role}"${cascadeClause}`;
                break;
            case 'ALL SEQUENCES IN SCHEMA':
                sql = `REVOKE ${permsStr} ON ALL SEQUENCES IN SCHEMA "${schema}" FROM "${from_role}"${cascadeClause}`;
                break;
            case 'ALL FUNCTIONS IN SCHEMA':
                sql = `REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA "${schema}" FROM "${from_role}"${cascadeClause}`;
                break;
            default:
                throw new Error(`Unknown on_type: ${on_type}`);
        }

        sql += ';';

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            message: `Revoked ${permsStr} on ${on_type} from ${from_role}.`,
        };
    },
};
