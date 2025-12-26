# Self-Hosted Supabase MCP Server (with OAuth 2.1)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Fork of [HenkDz/selfhosted-supabase-mcp](https://github.com/HenkDz/selfhosted-supabase-mcp) with **OAuth 2.1 authentication** for secure internet exposure.
>
> **Repository**: [YeongT/selfhosted-supabase-mcp](https://github.com/YeongT/selfhosted-supabase-mcp)

## What's New (YeongT Fork)

| Feature | Original | This Fork |
|---------|----------|-----------|
| OAuth 2.1 (PKCE) | ❌ | ✅ |
| Dynamic Client Registration | ❌ | ✅ |
| Bearer Token Auth | ❌ | ✅ |
| HTTP Streamable Transport | ❌ | ✅ |
| SSE Transport | ❌ | ✅ |
| Session Management | ❌ | ✅ |
| Docker Deployment | ❌ | ✅ |
| Internet Exposure | ❌ Unsafe | ✅ Safe |

## Architecture

```
┌─────────────────┐      OAuth 2.1 / Bearer       ┌─────────────────┐
│  Claude Code    │ ─────────────────────────────▶│   MCP Server    │
│  (MCP Client)   │       MCP_API_KEY             │   (This Fork)   │
└─────────────────┘                               └────────┬────────┘
                                                          │
                                                          │ SERVICE_ROLE_KEY
                                                          │ (Server-side only)
                                                          ▼
                                                  ┌─────────────────┐
                                                  │    Supabase     │
                                                  │   (PostgreSQL)  │
                                                  └─────────────────┘
```

## Quick Start (Docker)

### 1. Environment Variables

```bash
# .env
MCP_API_KEY=your-secure-api-key
MCP_PUBLIC_URL=https://your-domain.com

SUPABASE_URL=http://kong:8000
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
DATABASE_URL=postgresql://postgres:password@db:5432/postgres
```

### 2. Docker Compose

```yaml
mcp-server:
  build: ./mcp
  environment:
    - MCP_API_KEY=${MCP_API_KEY}
    - MCP_PUBLIC_URL=${MCP_PUBLIC_URL:-https://supabase.example.com}
    - SUPABASE_URL=http://kong:8000
    - SUPABASE_ANON_KEY=${ANON_KEY}
    - SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
    - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/postgres
  command: ["node", "dist/index.js", "--sse"]
  ports:
    - "8100:3000"
  healthcheck:
    test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/health"]
```

### 3. Client Configuration (Claude Code)

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://your-domain.com/mcp",
      "headers": {
        "Authorization": "Bearer your-secure-api-key"
      }
    }
  }
}
```

## OAuth 2.1 Endpoints

| Endpoint | Description |
|----------|-------------|
| `/.well-known/oauth-authorization-server` | OAuth server metadata |
| `/.well-known/oauth-protected-resource` | Protected resource metadata |
| `/register` | Dynamic Client Registration (RFC 7591) |
| `/oauth/authorize` | Authorization endpoint |
| `/oauth/token` | Token endpoint |

## MCP Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | POST | HTTP Streamable transport |
| `/` | GET | SSE stream (with session) |
| `/` | DELETE | Session termination |
| `/sse` | GET | SSE connection |
| `/messages/:sessionId` | POST | SSE message handler |
| `/health` | GET | Health check |

## Available Tools (21)

### Schema & Migrations
- `list_tables` - List database tables
- `list_extensions` - List PostgreSQL extensions
- `list_migrations` - List applied migrations
- `apply_migration` - Apply SQL migration

### Database Operations
- `execute_sql` - Execute arbitrary SQL
- `get_database_connections` - Show active connections
- `get_database_stats` - Database statistics

### Project Configuration
- `get_project_url` - Get Supabase URL
- `get_anon_key` - Get anon key
- `get_service_key` - Get service role key
- `verify_jwt_secret` - Verify JWT secret

### Development Tools
- `generate_typescript_types` - Generate TypeScript types
- `rebuild_hooks` - Restart pg_net worker

### Auth User Management
- `list_auth_users` - List users
- `get_auth_user` - Get user details
- `create_auth_user` - Create user
- `update_auth_user` - Update user
- `delete_auth_user` - Delete user

### Storage
- `list_storage_buckets` - List buckets
- `list_storage_objects` - List objects

### Realtime
- `list_realtime_publications` - List publications

## Security

### Two-Layer Authentication

1. **MCP_API_KEY**: Client ↔ MCP Server authentication
2. **SERVICE_ROLE_KEY**: MCP Server ↔ Database (never exposed to clients)

### Best Practices

- Rotate `MCP_API_KEY` every 3-6 months
- Never expose `SERVICE_ROLE_KEY` to clients
- Use HTTPS in production
- Configure proper CORS if needed

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MCP_API_KEY` | Yes | API key for client authentication |
| `MCP_PUBLIC_URL` | Yes | Public URL for OAuth endpoints |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Recommended | Service role key |
| `DATABASE_URL` | Recommended | Direct PostgreSQL connection |
| `SUPABASE_AUTH_JWT_SECRET` | Optional | JWT secret for verification |

### CLI Options

```bash
node dist/index.js \
  --sse \                    # Enable SSE/HTTP mode (required for remote access)
  --port 3000 \              # Server port
  --url <supabase-url> \
  --anon-key <key> \
  --service-key <key> \
  --db-url <postgres-url> \
  --jwt-secret <secret> \
  --tools-config <path>      # Optional tool whitelist
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in stdio mode (local development)
node dist/index.js --url http://localhost:8000 --anon-key <key>

# Run in SSE mode (remote access)
node dist/index.js --sse --port 3000 --url http://localhost:8000 --anon-key <key>
```

## Comparison with Official Supabase MCP

| Feature | Official (Cloud) | Official (Self-hosted) | This Fork |
|---------|-----------------|----------------------|-----------|
| Target | Supabase Cloud | SSH tunnel only | Internet |
| OAuth | ✅ | ❌ | ✅ |
| Tools | Cloud API | 0 (empty) | 21 |
| Setup | Easy | Complex | Easy |

## Credits

- Original: [HenkDz/selfhosted-supabase-mcp](https://github.com/HenkDz/selfhosted-supabase-mcp)
- This Fork: [YeongT/selfhosted-supabase-mcp](https://github.com/YeongT/selfhosted-supabase-mcp)
- OAuth 2.1 implementation: YeongT

## License

MIT License
