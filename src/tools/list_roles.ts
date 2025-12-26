import { z } from 'zod';
import type { ToolContext } from './types.js';

const ListRolesInputSchema = z.object({
    include_system: z.boolean().optional().default(false).describe('Include system roles'),
});
type ListRolesInput = z.infer<typeof ListRolesInputSchema>;

const RoleSchema = z.object({
    name: z.string(),
    is_superuser: z.boolean(),
    can_login: z.boolean(),
    can_create_db: z.boolean(),
    can_create_role: z.boolean(),
    inherit: z.boolean(),
    replication: z.boolean(),
    connection_limit: z.number(),
    member_of: z.array(z.string()),
});
const ListRolesOutputSchema = z.array(RoleSchema);

const mcpInputSchema = {
    type: 'object',
    properties: {
        include_system: { type: 'boolean', default: false },
    },
    required: [],
};

export const listRolesTool = {
    name: 'list_roles',
    description: 'Lists all database roles.',
    inputSchema: ListRolesInputSchema,
    mcpInputSchema,
    outputSchema: ListRolesOutputSchema,

    execute: async (input: ListRolesInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { include_system } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        let sql = `
            SELECT
                r.rolname as name,
                r.rolsuper as is_superuser,
                r.rolcanlogin as can_login,
                r.rolcreatedb as can_create_db,
                r.rolcreaterole as can_create_role,
                r.rolinherit as inherit,
                r.rolreplication as replication,
                r.rolconnlimit as connection_limit,
                ARRAY(
                    SELECT g.rolname
                    FROM pg_roles g
                    JOIN pg_auth_members m ON m.roleid = g.oid
                    WHERE m.member = r.oid
                ) as member_of
            FROM pg_roles r
        `;

        if (!include_system) {
            sql += ` WHERE r.rolname NOT LIKE 'pg_%'`;
        }

        sql += ` ORDER BY r.rolname;`;

        const result = await client.executeSqlWithPg(sql);
        return ListRolesOutputSchema.parse(result);
    },
};
