import { z } from 'zod';
import type { ToolContext } from './types.js';

const UpdateBucketInputSchema = z.object({
    name: z.string().describe('Bucket name'),
    public: z.boolean().optional().describe('Set public/private'),
    file_size_limit: z.number().nullable().optional().describe('Max file size (null to remove)'),
    allowed_mime_types: z.array(z.string()).nullable().optional().describe('Allowed MIME types (null to remove)'),
});
type UpdateBucketInput = z.infer<typeof UpdateBucketInputSchema>;

const UpdateBucketOutputSchema = z.object({
    success: z.boolean(),
    bucket_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        name: { type: 'string', description: 'Bucket name' },
        public: { type: 'boolean' },
        file_size_limit: { type: 'number', nullable: true },
        allowed_mime_types: { type: 'array', items: { type: 'string' }, nullable: true },
    },
    required: ['name'],
};

export const updateBucketTool = {
    name: 'update_bucket',
    description: 'Updates a storage bucket settings.',
    inputSchema: UpdateBucketInputSchema,
    mcpInputSchema,
    outputSchema: UpdateBucketOutputSchema,

    execute: async (input: UpdateBucketInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { name, public: isPublic, file_size_limit, allowed_mime_types } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const updates: string[] = [];
        const params: any[] = [name];
        let paramIndex = 2;

        if (isPublic !== undefined) {
            updates.push(`public = $${paramIndex++}`);
            params.push(isPublic);
        }

        if (file_size_limit !== undefined) {
            if (file_size_limit === null) {
                updates.push(`file_size_limit = NULL`);
            } else {
                updates.push(`file_size_limit = $${paramIndex++}`);
                params.push(file_size_limit);
            }
        }

        if (allowed_mime_types !== undefined) {
            if (allowed_mime_types === null) {
                updates.push(`allowed_mime_types = NULL`);
            } else {
                updates.push(`allowed_mime_types = $${paramIndex++}`);
                params.push(allowed_mime_types);
            }
        }

        if (updates.length === 0) {
            throw new Error('No updates specified.');
        }

        const sql = `UPDATE storage.buckets SET ${updates.join(', ')} WHERE id = $1;`;

        await client.executeSqlWithPg(sql, params);

        return {
            success: true,
            bucket_name: name,
            message: `Bucket ${name} updated.`,
        };
    },
};
