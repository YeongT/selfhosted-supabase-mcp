import { z } from 'zod';
import type { ToolContext } from './types.js';

const CreateTriggerInputSchema = z.object({
    schema: z.string().optional().default('public').describe('Schema name'),
    table: z.string().describe('Table name'),
    name: z.string().describe('Trigger name'),
    timing: z.enum(['BEFORE', 'AFTER', 'INSTEAD OF']).describe('Trigger timing'),
    events: z.array(z.enum(['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'])).min(1).describe('Events to trigger on'),
    for_each: z.enum(['ROW', 'STATEMENT']).optional().default('ROW').describe('For each row or statement'),
    function_schema: z.string().optional().default('public').describe('Function schema'),
    function_name: z.string().describe('Function to execute'),
    function_args: z.array(z.string()).optional().default([]).describe('Arguments to pass to function'),
    when: z.string().optional().describe('WHEN condition'),
    replace: z.boolean().optional().default(true).describe('Use CREATE OR REPLACE'),
});
type CreateTriggerInput = z.infer<typeof CreateTriggerInputSchema>;

const CreateTriggerOutputSchema = z.object({
    success: z.boolean(),
    trigger_name: z.string(),
    message: z.string(),
});

const mcpInputSchema = {
    type: 'object',
    properties: {
        schema: { type: 'string', default: 'public', description: 'Schema name' },
        table: { type: 'string', description: 'Table name' },
        name: { type: 'string', description: 'Trigger name' },
        timing: { type: 'string', enum: ['BEFORE', 'AFTER', 'INSTEAD OF'] },
        events: { type: 'array', items: { type: 'string', enum: ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] } },
        for_each: { type: 'string', enum: ['ROW', 'STATEMENT'], default: 'ROW' },
        function_schema: { type: 'string', default: 'public' },
        function_name: { type: 'string', description: 'Function to execute' },
        function_args: { type: 'array', items: { type: 'string' } },
        when: { type: 'string', description: 'WHEN condition' },
        replace: { type: 'boolean', default: true },
    },
    required: ['table', 'name', 'timing', 'events', 'function_name'],
};

export const createTriggerTool = {
    name: 'create_trigger',
    description: 'Creates a new trigger on a table.',
    inputSchema: CreateTriggerInputSchema,
    mcpInputSchema,
    outputSchema: CreateTriggerOutputSchema,

    execute: async (input: CreateTriggerInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { schema, table, name, timing, events, for_each, function_schema, function_name, function_args, when, replace } = input;

        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection required.');
        }

        const createOrReplace = replace ? 'CREATE OR REPLACE' : 'CREATE';
        const eventsStr = events.join(' OR ');
        const argsStr = function_args.map(a => `'${a.replace(/'/g, "''")}'`).join(', ');

        let sql = `${createOrReplace} TRIGGER "${name}"`;
        sql += ` ${timing} ${eventsStr}`;
        sql += ` ON "${schema}"."${table}"`;
        sql += ` FOR EACH ${for_each}`;

        if (when) {
            sql += ` WHEN (${when})`;
        }

        sql += ` EXECUTE FUNCTION "${function_schema}"."${function_name}"(${argsStr});`;

        await client.executeSqlWithPg(sql);

        return {
            success: true,
            trigger_name: name,
            message: `Trigger ${name} created on ${schema}.${table}.`,
        };
    },
};
