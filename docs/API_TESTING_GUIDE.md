# API Route Integration Testing Guide

## Overview

This document specifies the intended test coverage for all Next.js API routes in the application. These tests cannot be executed as Jest unit tests due to Next.js Edge Runtime API incompatibility. See the section below for details and solutions.

**Current Status**: 🟡 In Progress - Test specifications documented, execution framework pending

## Blocker: Jest/Next.js Incompatibility

### Problem

Jest runs in a Node.js environment and cannot mock Web API objects like `Request` and `Response` that are native to Edge Runtime environments.

### Error Pattern

```typescript
ReferenceError: Request is not defined
  at Object.Request (node_modules/next/server.ts)
  at Object.<anonymous> (src/app/api/[route]/route.ts:1:1)
  at Object.<anonymous> (src/app/api/[route]/route.test.ts:1:1)
```

### Solution

Choose one of these approaches to execute API route tests:

1. **HTTP Integration Testing with Supertest** ⭐ Recommended
   * Install: `yarn add -D supertest`
   * Effort: Low (2-4 hours)
   * Speed: Fast (not as fast as Jest unit tests, but acceptable)
   * Setup: Minimal - adapt test specifications below to HTTP requests
   * CI-friendly: Yes, runs alongside Jest

2. **E2E Testing with Playwright**
   * Install: `yarn add -D @playwright/test`
   * Effort: Moderate (1-2 days)
   * Speed: Slower than Supertest (but catches full-stack issues)
   * Setup: Requires test server running
   * Best for: Critical user workflows, not just API contracts

3. **Skip API Route Testing During Development**
   * Effort: None
   * Speed: Immediate
   * Tradeoff: Validate via production monitoring and manual testing
   * Suitable for: Early-stage projects, later E2E addition

## API Routes: Test Specifications

All 7 identified API routes are listed below with their intended test coverage. Use these specifications to implement tests in your chosen framework.

***

## 1. `/api/group/permissions`

**Purpose**: Manage group role-based permission overrides\
**Auth**: Bearer token (Discord OAuth) required, Admin role for POST\
**Database**: Writes to `group_member_permissions` table

### GET /api/group/permissions

**Query Parameters**:

* `group_id` (string, required): UUID of the group
* `member_id` (string, required): UUID of the group member

**Response Codes**:

* `200 OK`: Returns permission overrides for the member
* `400 Bad Request`: Missing/invalid parameters
* `401 Unauthorized`: Missing or expired Bearer token
* `403 Forbidden`: User is not a member of this group
* `404 Not Found`: Group or member not found
* `500 Internal Server Error`: Database error

**Response Format (200)**:

```json
{
  "group_permissions": [
    {
      "id": "uuid",
      "member_id": "uuid",
      "permission_type": "string (enum)",
      "override_value": true,
      "override_reason": "string or null",
      "created_at": "timestamp",
      "updated_at": "timestamp"
    }
  ]
}
```

**Error Scenarios to Test**:

* No Authorization header → 401
* Malformed Bearer token → 401
* Expired token → 401
* User not a group member → 403
* Group doesn't exist → 404
* Member doesn't exist → 404
* Database connection error → 500
* Table does not exist (migrations pending) → 200 with empty array

### POST /api/group/permissions

**Request Body**:

```json
{
  "group_id": "string (UUID)",
  "member_id": "string (UUID)",
  "permission_type": "string (enum)",
  "override_value": true,
  "override_reason": "string or null"
}
```

**Response Codes**:

* `200 OK`: Permission override created/updated
* `400 Bad Request`: Invalid permission\_type, malformed UUID, missing fields
* `401 Unauthorized`: Missing or invalid Bearer token
* `403 Forbidden`: User is not an admin of this group
* `404 Not Found`: Group or member not found
* `503 Service Unavailable`: Migrations not yet applied (table missing)
* `500 Internal Server Error`: Database constraint violation or connection error

**Response Format (200)**:

```json
{
  "success": true,
  "permission": {
    "id": "uuid",
    "member_id": "uuid",
    "permission_type": "string",
    "override_value": true,
    "override_reason": "string or null",
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
}
```

**Error Scenarios to Test**:

* Non-admin user attempts update → 403
* Invalid permission\_type enum value → 400
* Invalid UUID format → 400
* Missing required body fields → 400
* Target group doesn't exist → 404
* Target member doesn't exist in group → 404
* Migrations not applied (table missing) → 503
* Concurrent updates to same permission → handle gracefully

***

## 2. `/api/discord`

**Purpose**: Proxy webhook requests to Discord API\
**Auth**: Optional Discord webhook URL validation\
**External API**: Discord API (webhooks endpoint pattern: `https://discord.com/api/webhooks/[id]/[token]`)

### POST /api/discord

**Request Body**:

```json
{
  "webhook_url": "string (Discord webhook URL)",
  "payload": {
    "content": "string",
    "embeds": [...],
    ...
  }
}
```

**Response Codes**:

* `204 No Content`: Successfully sent to Discord
* `400 Bad Request`: Invalid webhook URL format
* `401 Unauthorized`: Webhook URL is invalid/expired (Discord response)
* `404 Not Found`: Discord webhook not found
* `500 Internal Server Error`: Network error or Discord API error

**Error Scenarios to Test**:

* Invalid webhook URL format (not discord.com or discordapp.com) → 400
* Malformed JSON payload → 400
* Valid-looking URL but Discord returns 401 → forward 401
* Valid-looking URL but Discord returns 404 → forward 404
* Network timeout → 500 with appropriate error message
* Discord rate limit (429) → forward 429

***

## 3. `/api/auth-redirect`

**Purpose**: Simple Auth0 OAuth redirect passthrough\
**Auth**: None required\
**Redirect Target**: `/auth/callback`

### GET /api/auth-redirect

**Query Parameters**:

* `origin` (string, optional): Original request origin for redirect validation

**Response Codes**:

* `307 Temporary Redirect`: Redirects to `/auth/callback`
* `400 Bad Request`: Invalid origin parameter

**Expected Behaviour**:

* Redirects to `/auth/callback` with query parameters preserved
* Validates origin to prevent open redirect vulnerabilities (if configured)

**Error Scenarios to Test**:

* Suspicious origin parameter (non-whitelisted domain) → 400
* Valid redirect with origin parameter → 307 to Auth0 callback

***

## 4. `/api/migration-status`

**Purpose**: Check status of Supabase schema migrations\
**Auth**: Optional (can be public)\
**Data Source**: `src/migration_files.json` + Supabase `schema_migrations` table

### GET /api/migration-status

**Response Codes**:

* `200 OK`: Returns migration status
* `500 Internal Server Error`: Database error or file read error

**Response Format (200)**:

```json
{
  "applied": [
    { "name": "001_create_groups.sql", "applied_at": "timestamp" }
  ],
  "pending": [
    { "name": "002_add_permissions_table.sql", "applied_at": null }
  ],
  "total": { "applied": 10, "pending": 2 }
}
```

**Error Scenarios to Test**:

* No migrations applied yet → 200 with empty `applied` array
* Some migrations applied → 200 with correct split
* Database error → 500
* Migration file missing from `migration_files.json` → handle gracefully

***

## 5. `/api/clan-public`

**Purpose**: Fetch public group data (member count, events, characters)\
**Auth**: None required (public data endpoint)\
**Visibility**: Only returns data if group's `is_public` flag is true

### GET /api/clan-public

**Query Parameters**:

* `slug` (string, required): Group slug for lookup

**Response Codes**:

* `200 OK`: Returns group data
* `400 Bad Request`: Missing `slug` parameter
* `403 Forbidden`: Group exists but `is_public` is false
* `404 Not Found`: Group not found
* `500 Internal Server Error`: Database error

**Response Format (200)**:

```json
{
  "group_id": "uuid",
  "slug": "string",
  "name": "string",
  "member_count": 42,
  "character_count": 156,
  "upcoming_events": 5,
  "member_list": [
    { "id": "uuid", "name": "string", "role": "admin|officer|member" }
  ]
}
```

**Error Scenarios to Test**:

* Group not found by slug → 404
* Group exists but `is_public` is false → 403
* Database error during query → 500
* No members → 200 with `member_count: 0`
* No events → 200 with `upcoming_events: 0`

***

## 6. `/api/group/ships-overview`

**Purpose**: Fetch character ships and inventory for a group member\
**Auth**: Bearer token required, User must be group member\
**Data**: Characters and ships for current user

### GET /api/group/ships-overview

**Query Parameters**:

* `group_id` (string, required): UUID of the group
* `game_slug` (string, optional): Game identifier (defaults to "aoc")

**Response Codes**:

* `200 OK`: Returns character and ship data
* `400 Bad Request`: Missing `group_id`
* `401 Unauthorized`: Missing or invalid Bearer token
* `403 Forbidden`: User is not a member of this group
* `404 Not Found`: Group not found
* `500 Internal Server Error`: Database error

**Response Format (200)**:

```json
{
  "characters": [
    {
      "id": "uuid",
      "name": "string",
      "game_slug": "aoc|rwr|sc",
      "ships": [
        { "id": "uuid", "name": "string", "class": "string" }
      ]
    }
  ],
  "total_ships": 42
}
```

**Error Scenarios to Test**:

* No Authorization header → 401
* User not a group member → 403
* Invalid game\_slug → 400 or ignore gracefully
* No characters for user → 200 with empty `characters` array
* Characters exist but no ships → 200 with empty `ships` arrays

***

## 7. `/api/group/achievements/sync`

**Purpose**: Calculate and sync achievement progress for group members\
**Auth**: Bearer token required, Admin or Officer role only\
**Action**: POST-only (read-only endpoint not available)

### POST /api/group/achievements/sync

**Request Body**:

```json
{
  "group_id": "string (UUID)",
  "member_ids": ["uuid", "uuid", ...]
}
```

**Response Codes**:

* `200 OK`: Achievements synced successfully
* `400 Bad Request`: Missing required fields
* `401 Unauthorized`: Missing or invalid Bearer token
* `403 Forbidden`: User is not an admin or officer
* `404 Not Found`: Group not found
* `503 Service Unavailable`: Achievement calculation service unavailable
* `500 Internal Server Error`: Database error

**Response Format (200)**:

```json
{
  "success": true,
  "synced_count": 10,
  "achievements": [
    {
      "member_id": "uuid",
      "achievement_id": "string",
      "progress": 75,
      "completed_at": "timestamp or null"
    }
  ]
}
```

**Error Scenarios to Test**:

* User with "member" role attempts sync → 403
* User with "officer" role syncs → 200 (allowed)
* User with "admin" role syncs → 200 (allowed)
* No group members found → 200 with `synced_count: 0`
* Achievement calculation fails → 503
* Database constraint violation → 500

***

## Implementation: Supertest Example

For the recommended Supertest approach, here's a template:

```typescript
// src/app/api/group/permissions/route.test.ts
import request from 'supertest';

const baseURL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

describe('GET /api/group/permissions', () => {
  it('should return 401 when authorization header is missing', async () => {
    const res = await request(baseURL)
      .get('/api/group/permissions')
      .query({ group_id: 'test-group', member_id: 'test-member' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('should return 403 when user is not a group member', async () => {
    const res = await request(baseURL)
      .get('/api/group/permissions')
      .set('Authorization', `Bearer ${testToken}`)
      .query({ group_id: 'test-group', member_id: 'test-member' });

    expect(res.status).toBe(403);
  });

  it('should return 200 with permissions for authorized member', async () => {
    const res = await request(baseURL)
      .get('/api/group/permissions')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ group_id: 'test-group', member_id: 'test-member' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.group_permissions)).toBe(true);
  });
});
```

### Migration Checklist

When implementing Supertest tests:

* \[ ] Add `supertest` dependency: `yarn add -D supertest`
* \[ ] Import `request` from `supertest`
* \[ ] Use `request(baseURL)` instead of `NextRequest`
* \[ ] Replace test setup/mocks with real database fixtures or `@supabase/supabase-js` test client
* \[ ] Consider setting up test database (separate Supabase project or local instance)
* \[ ] Run full test suite with: `yarn test --testTimeout=30000`
* \[ ] Add CI step to run integration tests after Jest

***

## Phase 1.3 Completion Criteria

✅ **Complete when**:

* \[ ] Tests implemented in chosen framework (Supertest, Playwright, or monitoring)
* \[ ] All 7 API routes covered with auth, error, and success scenarios
* \[ ] CI/CD pipeline runs tests on every commit
* \[ ] Coverage reports available (even if not enforced)

**Current Status**: Scaffolds documented, framework selection pending user decision
