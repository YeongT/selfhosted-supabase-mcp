import { z } from 'zod';
import type { ToolContext } from './types.js';

const ListSequencesInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
});
type ListSequencesInput = z.infer<typeof ListSequencesInputSchema>;

const SequenceSchema = z.object({
    schema: z.string(),
    name: z.string(),
    data_type: z.string(),
    start_value: z.string(),
    min_value: z.string(),
    max_value: z.string(),
    increment: z.string(),
    cycle: z.boolean(),
    last_value: z.string().nullable(),
    owner_table: z.string().nullable(),
    owner_column: z.string().nullable(),
});
const ListSequencesOutputSchema = z.array(SequenceSchema);

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public', description: 'Schema name' },
    },
    required: [],
};

export const listSequencesTool = {
    name: 'list_sequences',
    description: 'Lists all sequences in the specified schema.',
    inputSchema: ListSequencesInputSchema,
    mcpInputSchema,
    outputSchema: ListSequencesOutputSchema,

    execute: async (input: ListSequencesInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const sql = `
            SELECT
                n.nspname as schema,
                c.relname as name,
                format_type(s.seqtypid, NULL) as data_type,
                s.seqstart::text as start_value,
                s.seqmin::text as min_value,
                s.seqmax::text as max_value,
                s.seqincrement::text as increment,
                s.seqcycle as cycle,
                (SELECT last_value::text FROM pg_sequences WHERE schemaname = n.nspname AND sequencename = c.relname) as last_value,
                d.refobjid::regclass::text as owner_table,
                a.attname as owner_column
            FROM pg_sequence s
            JOIN pg_class c ON c.oid = s.seqrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            LEFT JOIN pg_depend d ON d.objid = s.seqrelid AND d.deptype = 'a'
            LEFT JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
            WHERE n.nspname = $1
            ORDER BY c.relname;
        `;

        const result = await client.executeSqlWithPg(sql, [schema]);
        return ListSequencesOutputSchema.parse(result);
    },
};
