import { z } from 'zod';
import type { ToolContext } from './types.js';

const CreateBucketInputSchema = z.object({
    name: z.string().describe('Bucket name (id)'),
    public: z.boolean().optional().default(false).describe('Make bucket public'),
    file_size_limit: z.number().optional().describe('Max file size in bytes'),
    allowed_mime_types: z.array(z.string()).optional().describe('Allowed MIME types'),
});
type CreateBucketInput = z.infer<typeof CreateBucketInputSchema>;

const CreateBucketOutputSchema = z.object({
    success: z.boolean(),
    bucket_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        name: { type: 'string', description: 'Bucket name' },
        public: { type: 'boolean', default: false },
        file_size_limit: { type: 'number', description: 'Max file size in bytes' },
        allowed_mime_types: { type: 'array', items: { type: 'string' } },
    },
    required: ['name'],
};

export const createBucketTool = {
    name: 'create_bucket',
    description: 'Creates a new storage bucket.',
    inputSchema: CreateBucketInputSchema,
    mcpInputSchema,
    outputSchema: CreateBucketOutputSchema,

    execute: async (input: CreateBucketInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { name, public: isPublic, file_size_limit, allowed_mime_types } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const fileSizeValue = file_size_limit ? file_size_limit : 'NULL';
        const mimeTypesValue = allowed_mime_types && allowed_mime_types.length > 0
            ? `ARRAY[${allowed_mime_types.map(t => `'${t}'`).join(', ')}]`
            : 'NULL';

        const sql = `
            INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
            VALUES ($1, $1, $2, ${fileSizeValue}, ${mimeTypesValue});
        `;

        await client.executeSqlWithPg(sql, [name, isPublic]);

        return {
            success: true,
            bucket_name: name,
            message: `Bucket ${name} created${isPublic ? ' (public)' : ''}.`,
        };
    },
};
