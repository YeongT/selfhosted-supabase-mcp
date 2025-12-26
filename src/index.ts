import { Command } from 'commander';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
    CallToolRequestSchema,
    ErrorCode,
    ListToolsRequestSchema,
    McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { SelfhostedSupabaseClient } from './client/index.js';
import { listTablesTool } from './tools/list_tables.js';
import { listExtensionsTool } from './tools/list_extensions.js';
import { listMigrationsTool } from './tools/list_migrations.js';
import { applyMigrationTool } from './tools/apply_migration.js';
import { executeSqlTool } from './tools/execute_sql.js';
import { getDatabaseConnectionsTool } from './tools/get_database_connections.js';
import { getDatabaseStatsTool } from './tools/get_database_stats.js';
import { getProjectUrlTool } from './tools/get_project_url.js';
import { getAnonKeyTool } from './tools/get_anon_key.js';
import { getServiceKeyTool } from './tools/get_service_key.js';
import { generateTypesTool } from './tools/generate_typescript_types.js';
import { rebuildHooksTool } from './tools/rebuild_hooks.js';
import { verifyJwtSecretTool } from './tools/verify_jwt_secret.js';
import { listAuthUsersTool } from './tools/list_auth_users.js';
import { getAuthUserTool } from './tools/get_auth_user.js';
import { deleteAuthUserTool } from './tools/delete_auth_user.js';
import { createAuthUserTool } from './tools/create_auth_user.js';
import { updateAuthUserTool } from './tools/update_auth_user.js';
import { z } from 'zod';
import type { ToolContext } from './tools/types.js';
import listStorageBucketsTool from './tools/list_storage_buckets.js';
import listStorageObjectsTool from './tools/list_storage_objects.js';
import listRealtimePublicationsTool from './tools/list_realtime_publications.js';

// Express for SSE mode
import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';

// Node.js built-in modules
import * as fs from 'node:fs';
import * as path from 'node:path';

// Define the structure expected by MCP for tool definitions
interface McpToolSchema {
    name: string;
    description?: string;
    inputSchema: object;
}

// Base structure for our tool objects
interface AppTool {
    name: string;
    description: string;
    inputSchema: z.ZodTypeAny;
    mcpInputSchema: object;
    outputSchema: z.ZodTypeAny;
    execute: (input: unknown, context: ToolContext) => Promise<unknown>;
}

// Session storage for SSE mode
const sessions = new Map<string, { server: Server; transport: SSEServerTransport }>();

// Session storage for HTTP Streamable mode
const httpSessions = new Map<string, { server: Server; transport: StreamableHTTPServerTransport }>();

// Create MCP Server with tools
function createMcpServer(
    registeredTools: Record<string, AppTool>,
    availableTools: Record<string, AppTool>,
    capabilities: { tools: Record<string, McpToolSchema> },
    selfhostedClient: SelfhostedSupabaseClient,
    workspacePath: string
): Server {
    const server = new Server(
        {
            name: 'self-hosted-supabase-mcp',
            version: '1.0.0',
        },
        {
            capabilities,
        },
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: Object.values(capabilities.tools),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const toolName = request.params.name;
        const tool = registeredTools[toolName as keyof typeof registeredTools];

        if (!tool) {
            if (availableTools[toolName as keyof typeof availableTools]) {
                throw new McpError(ErrorCode.MethodNotFound, `Tool "${toolName}" is available but not enabled.`);
            }
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
        }

        try {
            if (typeof tool.execute !== 'function') {
                throw new Error(`Tool ${toolName} does not have an execute method.`);
            }

            let parsedArgs = request.params.arguments;
            if (tool.inputSchema && typeof tool.inputSchema.parse === 'function') {
                parsedArgs = (tool.inputSchema as z.ZodTypeAny).parse(request.params.arguments);
            }

            const context: ToolContext = {
                selfhostedClient,
                workspacePath,
                log: (message, level = 'info') => {
                    console.error(`[${level.toUpperCase()}] ${message}`);
                }
            };

            const result = await tool.execute(parsedArgs as unknown, context);

            return {
                content: [
                    {
                        type: 'text',
                        text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
                    },
                ],
            };
        } catch (error: unknown) {
            console.error(`Error executing tool ${toolName}:`, error);
            let errorMessage = `Error executing tool ${toolName}: `;
            if (error instanceof z.ZodError) {
                errorMessage += `Input validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
            } else if (error instanceof Error) {
                errorMessage += error.message;
            } else {
                errorMessage += String(error);
            }
            return {
                content: [{ type: 'text', text: errorMessage }],
                isError: true,
            };
        }
    });

    return server;
}

// Main function
async function main() {
    const program = new Command();

    program
        .name('self-hosted-supabase-mcp')
        .description('MCP Server for self-hosted Supabase instances')
        .option('--url <url>', 'Supabase project URL', process.env.SUPABASE_URL)
        .option('--anon-key <key>', 'Supabase anonymous key', process.env.SUPABASE_ANON_KEY)
        .option('--service-key <key>', 'Supabase service role key (optional)', process.env.SUPABASE_SERVICE_ROLE_KEY)
        .option('--db-url <url>', 'Direct database connection string (optional)', process.env.DATABASE_URL)
        .option('--jwt-secret <secret>', 'Supabase JWT secret (optional)', process.env.SUPABASE_AUTH_JWT_SECRET)
        .option('--workspace-path <path>', 'Workspace root path', process.cwd())
        .option('--tools-config <path>', 'Path to tools config JSON file')
        .option('--sse', 'Run in SSE mode instead of stdio', false)
        .option('--port <port>', 'Port for SSE mode', process.env.PORT || '3000')
        .parse(process.argv);

    const options = program.opts();

    if (!options.url) {
        console.error('Error: Supabase URL is required. Use --url or SUPABASE_URL.');
        throw new Error('Supabase URL is required.');
    }
    if (!options.anonKey) {
        console.error('Error: Supabase Anon Key is required. Use --anon-key or SUPABASE_ANON_KEY.');
        throw new Error('Supabase Anon Key is required.');
    }

    console.error('Initializing Self-Hosted Supabase MCP Server...');

    try {
        const selfhostedClient = await SelfhostedSupabaseClient.create({
            supabaseUrl: options.url,
            supabaseAnonKey: options.anonKey,
            supabaseServiceRoleKey: options.serviceKey,
            databaseUrl: options.dbUrl,
            jwtSecret: options.jwtSecret,
        });

        console.error('Supabase client initialized successfully.');

        const availableTools: Record<string, AppTool> = {
            [listTablesTool.name]: listTablesTool as AppTool,
            [listExtensionsTool.name]: listExtensionsTool as AppTool,
            [listMigrationsTool.name]: listMigrationsTool as AppTool,
            [applyMigrationTool.name]: applyMigrationTool as AppTool,
            [executeSqlTool.name]: executeSqlTool as AppTool,
            [getDatabaseConnectionsTool.name]: getDatabaseConnectionsTool as AppTool,
            [getDatabaseStatsTool.name]: getDatabaseStatsTool as AppTool,
            [getProjectUrlTool.name]: getProjectUrlTool as AppTool,
            [getAnonKeyTool.name]: getAnonKeyTool as AppTool,
            [getServiceKeyTool.name]: getServiceKeyTool as AppTool,
            [generateTypesTool.name]: generateTypesTool as AppTool,
            [rebuildHooksTool.name]: rebuildHooksTool as AppTool,
            [verifyJwtSecretTool.name]: verifyJwtSecretTool as AppTool,
            [listAuthUsersTool.name]: listAuthUsersTool as AppTool,
            [getAuthUserTool.name]: getAuthUserTool as AppTool,
            [deleteAuthUserTool.name]: deleteAuthUserTool as AppTool,
            [createAuthUserTool.name]: createAuthUserTool as AppTool,
            [updateAuthUserTool.name]: updateAuthUserTool as AppTool,
            [listStorageBucketsTool.name]: listStorageBucketsTool as AppTool,
            [listStorageObjectsTool.name]: listStorageObjectsTool as AppTool,
            [listRealtimePublicationsTool.name]: listRealtimePublicationsTool as AppTool,
        };

        // Tool filtering logic
        let registeredTools: Record<string, AppTool> = { ...availableTools };
        const toolsConfigPath = options.toolsConfig as string | undefined;
        let enabledToolNames: Set<string> | null = null;

        if (toolsConfigPath) {
            try {
                const resolvedPath = path.resolve(toolsConfigPath);
                console.error(`Loading tool configuration from: ${resolvedPath}`);
                if (!fs.existsSync(resolvedPath)) {
                    throw new Error(`Tool configuration file not found at ${resolvedPath}`);
                }
                const configFileContent = fs.readFileSync(resolvedPath, 'utf-8');
                const configJson = JSON.parse(configFileContent);

                if (!configJson || typeof configJson !== 'object' || !Array.isArray(configJson.enabledTools)) {
                    throw new Error('Invalid config format. Expected { "enabledTools": ["tool1", ...] }.');
                }

                const toolNames = configJson.enabledTools as unknown[];
                if (!toolNames.every((name): name is string => typeof name === 'string')) {
                    throw new Error('"enabledTools" must be an array of strings.');
                }

                enabledToolNames = new Set(toolNames.map(name => name.trim()).filter(name => name.length > 0));
            } catch (error: unknown) {
                console.error(`Error loading tool config:`, error instanceof Error ? error.message : String(error));
                enabledToolNames = null;
            }
        }

        if (enabledToolNames !== null) {
            console.error(`Whitelisting tools: ${Array.from(enabledToolNames).join(', ')}`);
            registeredTools = {};
            for (const toolName in availableTools) {
                if (enabledToolNames.has(toolName)) {
                    registeredTools[toolName] = availableTools[toolName];
                }
            }
        } else {
            console.error("Enabling all available tools.");
        }

        // Prepare capabilities
        const capabilitiesTools: Record<string, McpToolSchema> = {};
        for (const tool of Object.values(registeredTools)) {
            const staticInputSchema = tool.mcpInputSchema || { type: 'object', properties: {} };
            capabilitiesTools[tool.name] = {
                name: tool.name,
                description: tool.description || 'Tool description missing',
                inputSchema: staticInputSchema,
            };
        }

        const capabilities = { tools: capabilitiesTools };

        // SSE Mode
        if (options.sse) {
            const port = parseInt(options.port as string, 10);
            const app = express();

            app.use(cors());
            // Skip JSON parsing for MCP HTTP endpoint (StreamableHTTPServerTransport parses itself)
            app.use((req, res, next) => {
                if (req.path === '/' || req.path === '/http') {
                    next();
                } else {
                    express.json({ limit: '50mb' })(req, res, next);
                }
            });
            app.use((req, res, next) => {
                if (req.path === '/' || req.path === '/http') {
                    next();
                } else {
                    express.urlencoded({ extended: true })(req, res, next);
                }
            });

            // API Key for authentication
            const MCP_API_KEY = process.env.MCP_API_KEY;
            if (!MCP_API_KEY) {
                console.error('WARNING: MCP_API_KEY not set! Server is running WITHOUT authentication.');
            } else {
                console.error('MCP API Key authentication enabled.');
            }

            // Authentication middleware
            const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
                if (!MCP_API_KEY) {
                    // No API key configured, allow all (with warning above)
                    return next();
                }

                const authHeader = req.headers.authorization;
                const apiKeyHeader = req.headers['x-api-key'];

                // Check Authorization: Bearer <token>
                if (authHeader?.startsWith('Bearer ')) {
                    const token = authHeader.slice(7);
                    if (token === MCP_API_KEY) {
                        return next();
                    }
                }

                // Check X-API-Key header
                if (apiKeyHeader === MCP_API_KEY) {
                    return next();
                }

                console.error(`Unauthorized access attempt from ${req.ip}`);
                res.status(401).json({ error: 'unauthorized', error_description: 'Invalid or missing API key' });
            };

            // Health check (no auth required)
            app.get('/health', (req, res) => {
                res.json({
                    status: 'ok',
                    mode: 'sse',
                    timestamp: new Date().toISOString(),
                    sessions: sessions.size,
                    authenticated: !!MCP_API_KEY
                });
            });

            // Simple OAuth server implementation for MCP auth
            const PUBLIC_URL = process.env.MCP_PUBLIC_URL || 'https://supabase.kanduit.tech';
            const oauthCodes = new Map<string, { clientId: string; redirectUri: string; codeChallenge?: string }>();

            // OAuth Authorization Server Metadata
            app.get('/.well-known/oauth-authorization-server', (req, res) => {
                res.json({
                    issuer: PUBLIC_URL,
                    authorization_endpoint: `${PUBLIC_URL}/oauth/authorize`,
                    token_endpoint: `${PUBLIC_URL}/oauth/token`,
                    registration_endpoint: `${PUBLIC_URL}/register`,
                    response_types_supported: ['code'],
                    grant_types_supported: ['authorization_code', 'refresh_token'],
                    code_challenge_methods_supported: ['S256'],
                    token_endpoint_auth_methods_supported: ['none']
                });
            });
            app.get('/.well-known/oauth-authorization-server/*', (req, res) => {
                res.json({
                    issuer: PUBLIC_URL,
                    authorization_endpoint: `${PUBLIC_URL}/oauth/authorize`,
                    token_endpoint: `${PUBLIC_URL}/oauth/token`,
                    registration_endpoint: `${PUBLIC_URL}/register`,
                    response_types_supported: ['code'],
                    grant_types_supported: ['authorization_code', 'refresh_token'],
                    code_challenge_methods_supported: ['S256'],
                    token_endpoint_auth_methods_supported: ['none']
                });
            });

            // OAuth Protected Resource Metadata
            app.get('/.well-known/oauth-protected-resource', (req, res) => {
                res.json({
                    resource: `${PUBLIC_URL}/mcp`,
                    authorization_servers: [PUBLIC_URL],
                    bearer_methods_supported: ['header']
                });
            });
            app.get('/.well-known/oauth-protected-resource/*', (req, res) => {
                res.json({
                    resource: `${PUBLIC_URL}/mcp`,
                    authorization_servers: [PUBLIC_URL],
                    bearer_methods_supported: ['header']
                });
            });

            app.get('/.well-known/openid-configuration', (req, res) => {
                res.status(404).json({ error: 'not_found', error_description: 'OpenID Connect not supported' });
            });
            app.get('/.well-known/openid-configuration/*', (req, res) => {
                res.status(404).json({ error: 'not_found', error_description: 'OpenID Connect not supported' });
            });

            // OAuth client registration
            app.post('/register', (req, res) => {
                console.error('OAuth client registration:', req.body);
                const clientId = crypto.randomUUID();
                const redirectUris = req.body?.redirect_uris || [];
                res.status(201).json({
                    client_id: clientId,
                    client_id_issued_at: Math.floor(Date.now() / 1000),
                    token_endpoint_auth_method: 'none',
                    redirect_uris: redirectUris,
                    grant_types: ['authorization_code', 'refresh_token'],
                    response_types: ['code'],
                    scope: 'mcp'
                });
            });

            // OAuth authorize endpoint - auto-approve and redirect
            app.get('/oauth/authorize', (req, res) => {
                console.error('OAuth authorize request:', req.query);
                const { client_id, redirect_uri, state, code_challenge, code_challenge_method, response_type } = req.query;

                if (response_type !== 'code') {
                    res.status(400).json({ error: 'unsupported_response_type' });
                    return;
                }

                // Generate authorization code
                const code = crypto.randomUUID();
                oauthCodes.set(code, {
                    clientId: client_id as string,
                    redirectUri: redirect_uri as string,
                    codeChallenge: code_challenge as string
                });

                // Auto-approve and redirect back
                const redirectUrl = new URL(redirect_uri as string);
                redirectUrl.searchParams.set('code', code);
                if (state) redirectUrl.searchParams.set('state', state as string);

                console.error('Redirecting to:', redirectUrl.toString());
                res.redirect(redirectUrl.toString());
            });

            // OAuth token endpoint
            app.post('/oauth/token', (req, res) => {
                console.error('OAuth token request:', req.body);
                const { grant_type, code, code_verifier, refresh_token } = req.body;

                if (grant_type === 'authorization_code') {
                    const codeData = oauthCodes.get(code);
                    if (!codeData) {
                        res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid authorization code' });
                        return;
                    }
                    oauthCodes.delete(code);

                    // Return access token (use the configured API key)
                    res.json({
                        access_token: MCP_API_KEY || crypto.randomUUID(),
                        token_type: 'Bearer',
                        expires_in: 3600,
                        refresh_token: crypto.randomUUID()
                    });
                } else if (grant_type === 'refresh_token') {
                    res.json({
                        access_token: MCP_API_KEY || crypto.randomUUID(),
                        token_type: 'Bearer',
                        expires_in: 3600,
                        refresh_token: crypto.randomUUID()
                    });
                } else {
                    res.status(400).json({ error: 'unsupported_grant_type' });
                }
            });

            // SSE endpoint (auth required)
            app.get('/sse', authMiddleware, async (req, res) => {
                const sessionId = crypto.randomUUID();
                console.error(`New SSE connection: ${sessionId}`);

                const server = createMcpServer(
                    registeredTools,
                    availableTools,
                    capabilities,
                    selfhostedClient,
                    options.workspacePath as string
                );

                const transport = new SSEServerTransport(`/mcp/messages/${sessionId}`, res);
                sessions.set(sessionId, { server, transport });

                res.on('close', () => {
                    console.error(`SSE connection closed: ${sessionId}`);
                    sessions.delete(sessionId);
                });

                await server.connect(transport);
            });

            // Messages endpoint for SSE (auth required)
            app.post('/messages/:sessionId', authMiddleware, async (req, res) => {
                const { sessionId } = req.params;
                const session = sessions.get(sessionId);

                if (!session) {
                    res.status(404).json({ error: 'not_found', error_description: 'Session not found' });
                    return;
                }

                try {
                    await session.transport.handlePostMessage(req, res);
                } catch (error) {
                    console.error(`Error handling message for session ${sessionId}:`, error);
                    res.status(500).json({ error: 'server_error', error_description: 'Internal server error' });
                }
            });

            // HTTP Streamable transport at root (auth required) - /mcp maps to / via Kong
            app.post('/', authMiddleware, async (req, res) => {
                const sessionId = req.headers['mcp-session-id'] as string | undefined;
                console.error('New HTTP request received at /');
                console.error('Session ID:', sessionId);
                console.error('Content-Type:', req.headers['content-type']);

                // Check for existing session
                if (sessionId && httpSessions.has(sessionId)) {
                    console.error('Reusing existing session:', sessionId);
                    const session = httpSessions.get(sessionId)!;
                    await session.transport.handleRequest(req, res);
                    return;
                }

                // Create new session
                console.error('Creating new HTTP session');
                const server = createMcpServer(
                    registeredTools,
                    availableTools,
                    capabilities,
                    selfhostedClient,
                    options.workspacePath as string
                );

                const transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => crypto.randomUUID(),
                });

                // Clean up on close
                transport.onclose = () => {
                    const sid = transport.sessionId;
                    if (sid) {
                        console.error('HTTP session closed:', sid);
                        httpSessions.delete(sid);
                    }
                };

                await server.connect(transport);
                await transport.handleRequest(req, res);

                // Save the session if one was created
                const createdSessionId = transport.sessionId;
                if (createdSessionId) {
                    console.error('HTTP session created:', createdSessionId);
                    httpSessions.set(createdSessionId, { server, transport });
                }
            });

            // Also support /http for backwards compatibility
            app.post('/http', authMiddleware, async (req, res) => {
                const sessionId = req.headers['mcp-session-id'] as string | undefined;
                console.error('New HTTP request received at /http');
                console.error('Session ID:', sessionId);

                // Check for existing session
                if (sessionId && httpSessions.has(sessionId)) {
                    console.error('Reusing existing session:', sessionId);
                    const session = httpSessions.get(sessionId)!;
                    await session.transport.handleRequest(req, res);
                    return;
                }

                // Create new session
                console.error('Creating new HTTP session');
                const server = createMcpServer(
                    registeredTools,
                    availableTools,
                    capabilities,
                    selfhostedClient,
                    options.workspacePath as string
                );

                const transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => crypto.randomUUID(),
                });

                transport.onclose = () => {
                    const sid = transport.sessionId;
                    if (sid) {
                        console.error('HTTP session closed:', sid);
                        httpSessions.delete(sid);
                    }
                };

                await server.connect(transport);
                await transport.handleRequest(req, res);

                const createdSessionId = transport.sessionId;
                if (createdSessionId) {
                    console.error('HTTP session created:', createdSessionId);
                    httpSessions.set(createdSessionId, { server, transport });
                }
            });

            // DELETE handler for session termination
            app.delete('/', authMiddleware, async (req, res) => {
                const sessionId = req.headers['mcp-session-id'] as string | undefined;
                if (sessionId && httpSessions.has(sessionId)) {
                    const session = httpSessions.get(sessionId)!;
                    await session.transport.handleRequest(req, res);
                    httpSessions.delete(sessionId);
                } else {
                    res.status(404).json({ error: 'not_found', error_description: 'Session not found' });
                }
            });

            // GET handler for SSE streams (if client requests it)
            app.get('/', authMiddleware, async (req, res) => {
                const sessionId = req.headers['mcp-session-id'] as string | undefined;
                if (sessionId && httpSessions.has(sessionId)) {
                    const session = httpSessions.get(sessionId)!;
                    await session.transport.handleRequest(req, res);
                } else {
                    res.status(400).json({ error: 'bad_request', error_description: 'Session ID required for GET requests' });
                }
            });

            app.listen(port, () => {
                console.error(`MCP Server running on port ${port}`);
                console.error(`HTTP endpoint: http://localhost:${port}/http`);
                console.error(`SSE endpoint: http://localhost:${port}/sse`);
                console.error(`Health check: http://localhost:${port}/health`);
            });

        } else {
            // Stdio Mode
            console.error('Starting MCP Server in stdio mode...');
            const server = createMcpServer(
                registeredTools,
                availableTools,
                capabilities,
                selfhostedClient,
                options.workspacePath as string
            );
            const transport = new StdioServerTransport();
            await server.connect(transport);
            console.error('MCP Server connected to stdio.');
        }

    } catch (error) {
        console.error('Failed to initialize MCP server:', error);
        throw error;
    }
}

main().catch((error) => {
    console.error('Unhandled error in main function:', error);
    process.exit(1);
});
