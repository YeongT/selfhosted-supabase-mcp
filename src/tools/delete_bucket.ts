import { z } from 'zod';
import type { ToolContext } from './types.js';

const DeleteBucketInputSchema = z.object({
    name: z.string().describe('Bucket name'),
    force: z.boolean().optional().default(false).describe('Delete even if not empty'),
});
type DeleteBucketInput = z.infer<typeof DeleteBucketInputSchema>;

const DeleteBucketOutputSchema = z.object({
    success: z.boolean(),
    bucket_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        name: { type: 'string', description: 'Bucket name' },
        force: { type: 'boolean', default: false, description: 'Delete even if not empty' },
    },
    required: ['name'],
};

export const deleteBucketTool = {
    name: 'delete_bucket',
    description: 'Deletes a storage bucket.',
    inputSchema: DeleteBucketInputSchema,
    mcpInputSchema,
    outputSchema: DeleteBucketOutputSchema,

    execute: async (input: DeleteBucketInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { name, force } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        if (force) {
            // Delete all objects in the bucket first
            await client.executeSqlWithPg(`DELETE FROM storage.objects WHERE bucket_id = $1;`, [name]);
        }

        const sql = `DELETE FROM storage.buckets WHERE id = $1;`;

        const result = await client.executeSqlWithPg(sql, [name]);

        return {
            success: true,
            bucket_name: name,
            message: `Bucket ${name} deleted.`,
        };
    },
};
