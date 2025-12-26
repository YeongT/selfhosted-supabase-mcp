import { z } from 'zod';
import type { ToolContext } from './types.js';

const SetCommentInputSchema = z.object({
    object_type: z.enum(['TABLE', 'COLUMN', 'FUNCTION', 'SCHEMA', 'INDEX', 'VIEW', 'TYPE', 'TRIGGER', 'EXTENSION']),
    schema: z.string().optional().default('public').describe('Schema name'),
    object_name: z.string().describe('Object name'),
    column_name: z.string().optional().describe('Column name (for COLUMN type)'),
    comment: z.string().nullable().describe('Comment text (null to remove)'),
});
type SetCommentInput = z.infer<typeof SetCommentInputSchema>;

const SetCommentOutputSchema = z.object({
    success: z.boolean(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        object_type: { type: 'string', enum: ['TABLE', 'COLUMN', 'FUNCTION', 'SCHEMA', 'INDEX', 'VIEW', 'TYPE', 'TRIGGER', 'EXTENSION'] },
        schema: { type: 'string', default: 'public' },
        object_name: { type: 'string', description: 'Object name' },
        column_name: { type: 'string', description: 'Column name (for COLUMN type)' },
        comment: { type: 'string', description: 'Comment text', nullable: true },
    },
    required: ['object_type', 'object_name', 'comment'],
};

export const setCommentTool = {
    name: 'set_comment',
    description: 'Sets or removes a comment on a database object.',
    inputSchema: SetCommentInputSchema,
    mcpInputSchema,
    outputSchema: SetCommentOutputSchema,

    execute: async (input: SetCommentInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { object_type, schema, object_name, column_name, comment } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const commentValue = comment === null ? 'NULL' : `'${comment.replace(/'/g, "''")}'`;

        let sql: string;

        switch (object_type) {
            case 'TABLE':
                sql = `COMMENT ON TABLE "${schema}"."${object_name}" IS ${commentValue}`;
                break;
            case 'COLUMN':
                if (!column_name) throw new Error('column_name required for COLUMN');
                sql = `COMMENT ON COLUMN "${schema}"."${object_name}"."${column_name}" IS ${commentValue}`;
                break;
            case 'FUNCTION':
                sql = `COMMENT ON FUNCTION "${schema}"."${object_name}" IS ${commentValue}`;
                break;
            case 'SCHEMA':
                sql = `COMMENT ON SCHEMA "${object_name}" IS ${commentValue}`;
                break;
            case 'INDEX':
                sql = `COMMENT ON INDEX "${schema}"."${object_name}" IS ${commentValue}`;
                break;
            case 'VIEW':
                sql = `COMMENT ON VIEW "${schema}"."${object_name}" IS ${commentValue}`;
                break;
            case 'TYPE':
                sql = `COMMENT ON TYPE "${schema}"."${object_name}" IS ${commentValue}`;
                break;
            case 'TRIGGER':
                throw new Error('TRIGGER comments require table name - use COMMENT ON TRIGGER name ON table');
            case 'EXTENSION':
                sql = `COMMENT ON EXTENSION "${object_name}" IS ${commentValue}`;
                break;
            default:
                throw new Error(`Unknown object_type: ${object_type}`);
        }

        sql += ';';

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            message: comment === null
                ? `Comment removed from ${object_type} ${object_name}.`
                : `Comment set on ${object_type} ${object_name}.`,
        };
    },
};
