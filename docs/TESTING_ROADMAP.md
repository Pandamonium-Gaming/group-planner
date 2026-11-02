# Testing Improvement Roadmap

This document outlines the phased approach to expanding test coverage across the Group Planner application.

## Current Status ✅ | Phase 1.3 in Progress

**Test Suites**: 17 (13 hook suites, 4 lib suites)\
**Tests**: 321 passing\
**Coverage**: Statements: 32.85% | Branches: 65.39% | Functions: 49.35% | Lines: 32.85%\
**Phase 1 Status**: 1.1 (Auth) ✅ Complete | 1.2 (Permissions) ✅ Complete | 1.3 (API routes) 🟡 In Progress\
**Coverage Areas**: Permission system (99-100%), auth (99%), utilities (100%), game validation (63%), permissions hook (100%), data hooks (44-100%), API routes scaffolded

⚠️ **Note on Coverage**: Global threshold not met (50% target). This is expected—most coverage comes from tested lib + hook files. Untested areas (config, contexts, pages/api) drag down global average. See detailed breakdown below.

### Completed (Phases 0-1.2)

* \[x] Jest and React Testing Library infrastructure
* \[x] Test configuration for Next.js
* \[x] Comprehensive permission system tests (30+ tests)
* \[x] Utility function tests (100% coverage)
* \[x] Game validation tests (63% coverage)
* \[x] Auth system tests (99% coverage)
* \[x] Permissions hook tests (100% coverage)
* \[x] Multiple data hooks tests (13 suites)
* \[x] Test documentation ([TESTING.md](./TESTING.md))

**Bug Found & Fixed**: Missing `guild_bank_manage` permission definition

***

## Phase 1: Core Security & Business Logic (High Priority)

**Goal**: Test all security-critical code to prevent permission bypasses and auth failures.

### 1.1 Authentication System (`src/lib/auth.ts`)

**Priority**: 🔴 Critical\
**Estimated Tests**: 15-20

* \[x] `signInWithDiscord()` - OAuth flow
* \[x] `signOut()` - Session cleanup
* \[x] `getSession()` - Session retrieval
* \[x] `getUserProfile()` - Auto-create profile logic
* \[ ] `updateUserProfile()` - Update validation
* \[x] `getGroupById()` - Group lookup
* \[x] `updateDisplayName()` - Display name update flow
* \[ ] Edge cases: Missing user data, invalid IDs, concurrent requests (partial coverage for missing data/invalid IDs)

**Why**: Authentication is the gateway - any bug here affects the entire system.

### 1.2 Permission Hooks (`src/hooks/usePermissions.ts`)

**Priority**: 🔴 Critical\
**Estimated Tests**: 15-20

* \[x] `hasPermission()` - Permission checks with custom overrides
* \[x] `getUserRole()` - Role retrieval
* \[ ] `canManageUser()` - Role management checks
* \[x] Permission fetching from API
* \[x] Fallback to default permissions when fetch fails
* \[x] Loading states and error handling

**Why**: This hook is used throughout the UI to show/hide actions. Bugs = security holes.

### 1.3 API Route Tests (`src/app/api/`)

**Priority**: 🔴 Critical\
**Estimated Tests**: 70+\
**Status**: 🟡 **In Progress - Specifications Documented, Framework Selection Pending**

**Test Specifications Created (7 routes, 70+ test cases)**\
📖 **See [API\_TESTING\_GUIDE.md](./API_TESTING_GUIDE.md) for comprehensive test specifications and implementation options**

1. ✔️ `/api/group/permissions` - Core permission system (GET/POST)
2. ✔️ `/api/discord` - Discord webhook proxy (POST)
3. ✔️ `/api/auth-redirect` - OAuth redirect passthrough (GET)
4. ✔️ `/api/migration-status` - Schema migration status (GET)
5. ✔️ `/api/clan-public` - Public group data (GET)
6. ✔️ `/api/group/ships-overview` - Character/ship inventory (GET)
7. ✔️ `/api/group/achievements/sync` - Achievement calculator (POST)

#### Implementation Path: Choose One

**📌 See [API\_TESTING\_GUIDE.md](./API_TESTING_GUIDE.md) for**:

* Complete test specifications for all 7 routes (70+ test cases documented)
* Supertest integration template (easiest option)
* E2E/Playwright guidance
* Jest/Next.js incompatibility explanation
* Step-by-step implementation checklist

**Why Phase 1.3 is Critical**: API routes are the server-side gateway for authentication, authorization, and data integrity. Bugs directly impact security and data consistency.

***

## Phase 2: Data Layer & Integration Tests (Medium Priority)

**Goal**: Ensure data operations work correctly and modules integrate properly.

### 2.1 Database Operations (`src/lib/`)

**Priority**: 🟡 Medium\
**Estimated Tests**: 15-25

* \[ ] `getGroupMembers()` - Filter and sort logic
* \[ ] `updateMemberRole()` - Role change validation
* \[ ] `createCharacter()` - Character creation constraints
* \[ ] `deleteCharacter()` - Ownership checks
* \[ ] Transaction rollback scenarios
* \[ ] Concurrent update handling

**Why**: Data integrity prevents bugs that corrupt user data.

### 2.2 Custom Hooks (Data Fetching)

**Priority**: 🟡 Medium\
**Estimated Tests**: 20-30

* \[ ] `useAuth` - User state management
* \[ ] `useGroupMembership` - Membership loading
* \[x] `useGroupData` - Group information
* \[ ] `useCharacters` - Character list management
* \[x] `useEvents` - Event scheduling
* \[ ] Hook error states and retry logic

Additional hook tests already present:
`useActivity`, `useAchievements`, `useBuilds`, `useCaravans`, `useFreeholds`, `useGuildBank`, `useLootSystem`, `useParties`, `useProcessingSet`, `useSiegeEvents`.

**Why**: Hooks manage application state - bugs create inconsistent UIs.

### 2.3 Game-Specific Logic (`src/games/`)

**Priority**: 🟡 Medium\
**Estimated Tests**: 10-15 per game

* \[ ] Ashes of Creation: Profession validation
* \[ ] Star Citizen: Ship management
* \[ ] Return of Reckoning: Warband logic
* \[ ] Game-specific permission checks
* \[ ] Resource constraints and dependencies

**Why**: Game logic is complex - tests prevent regression when adding features.

***

## Phase 3: Component & UI Tests (Medium-Low Priority)

**Goal**: Test critical user-facing components for correct rendering and interaction.

### 3.1 Settings Components

**Priority**: 🟡 Medium\
**Estimated Tests**: 15-20

* \[ ] `PermissionsSettings.tsx` - Permission editor
* \[ ] `RoleManagement.tsx` - Role assignment UI
* \[ ] `MemberManagement.tsx` - Accept/reject flow
* \[ ] Form validation and error messages
* \[ ] Loading and success states

**Why**: Settings components control powerful actions - bugs frustrate admins.

### 3.2 Form Components

**Priority**: 🟢 Low-Medium\
**Estimated Tests**: 10-15

* \[ ] Character creation form
* \[ ] Event creation form
* \[ ] Group creation wizard
* \[ ] Input validation
* \[ ] Submission handling

**Why**: Forms are user entry points - validation tests prevent bad data.

### 3.3 Display Components

**Priority**: 🟢 Low\
**Estimated Tests**: 5-10

* \[ ] Coverage matrix rendering
* \[ ] Event calendar display
* \[ ] Member lists with filtering
* \[ ] Responsive behaviour

**Why**: Lower priority since display bugs don't affect data integrity.

***

## Phase 4: Integration & E2E Tests (Lower Priority)

**Goal**: Test complete user workflows from start to finish.

### 4.1 Integration Tests

**Priority**: 🟢 Low-Medium\
**Estimated Tests**: 10-15

* \[ ] Auth + Permission flow (login → check permission → perform action)
* \[ ] Group creation + member invitation + role assignment
* \[ ] Character creation + profession selection + group bank
* \[ ] Multi-game scenarios

**Why**: Integration tests catch issues between modules.

### 4.2 End-to-End Tests (Playwright/Cypress)

**Priority**: 🟢 Low\
**Estimated Tests**: 5-10 critical paths

* \[ ] New user signup and group join
* \[ ] Admin creates event, member RSVPs
* \[ ] Permission change affecting UI visibility
* \[ ] Cross-browser testing

**Why**: E2E tests are expensive to maintain but catch real user issues.

***

## Additional Improvements

### Code Quality Enhancements

#### TypeScript Strictness

**Impact**: High\
**Effort**: Medium

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

**Why**: Catches type errors at compile time instead of runtime.

#### Error Handling Standardization

**Impact**: Medium\
**Effort**: Low-Medium

Create `src/lib/errors.ts`:

```typescript
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class PermissionError extends Error {
  constructor(message: string, public requiredPermission: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

**Why**: Consistent error types enable better error handling and logging.

#### API Response Types

**Impact**: Medium\
**Effort**: Low

Create `src/types/api.ts`:

```typescript
export type ApiResponse<T> = 
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export type PaginatedResponse<T> = {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};
```

**Why**: Type-safe API responses reduce bugs in client-server communication.

### CI/CD Pipeline

**Impact**: High\
**Effort**: Low

Create `.github/workflows/test.yml`:

```yaml
name: Tests
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'yarn'
      
      - name: Install dependencies
        run: yarn install --immutable
      
      - name: Run linter
        run: yarn lint
      
      - name: Run type check
        run: yarn tsc --noEmit
      
      - name: Run tests
        run: yarn test --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        if: success()
```

**Why**: Automated testing prevents merging broken code.

### Code Organization

**Impact**: Medium\
**Effort**: Medium

* Move server-only code to `src/lib/server/`
* Split large hooks into composable pieces
* Extract complex components into smaller units
* Separate business logic from UI components

**Example**:

```txt
src/lib/
  ├── server/          # Server-only code
  │   ├── auth.ts
  │   ├── database.ts
  │   └── permissions.ts
  ├── client/          # Client-side utilities
  │   ├── hooks/
  │   └── utils/
  └── shared/          # Shared types and constants
      ├── types.ts
      └── constants.ts
```

**Why**: Better separation prevents server code from leaking to client bundles.

***

## Testing Metrics & Goals

### Coverage Targets

| Area | Current | Target (3 months) | Target (6 months) |
| ---- | ------- | ----------------- | ----------------- |
| **Overall** | ~5% | 50% | 70% |
| **src/lib/** | 15% | 80% | 90% |
| **src/hooks/** | 0% | 70% | 85% |
| **src/app/api/** | 0% | 80% | 95% |
| **src/components/** | 0% | 40% | 60% |

### Success Metrics

* **Zero high-severity bugs in production** (permission/auth failures)
* **All PRs include tests** for new features
* **Test suite runs in < 10 seconds** (for rapid feedback)
* **90%+ coverage on security-critical code**

***

## Recommended Sequence

### Sprint 1 (Week 1-2): Security Foundation

1. Authentication tests (`auth.ts`)
2. Permission hook tests (`usePermissions.ts`)
3. Permission API route tests

**Deliverable**: No auth/permission bugs can slip through

### Sprint 2 (Week 3-4): Critical APIs

1. Group membership API tests
2. Character management API tests
3. Role update API tests

**Deliverable**: Server-side validation fully tested

### Sprint 3 (Week 5-6): Data Layer

1. Database operation tests
2. Data fetching hook tests
3. Integration tests for auth + data flow

**Deliverable**: Data integrity guaranteed

### Sprint 4 (Week 7-8): UI Critical Path

1. Settings component tests
2. Form validation tests
3. CI/CD pipeline setup

**Deliverable**: Automated testing in place

***

## Getting Started

### For Developers

**Before you start coding**:

1. Read [TESTING.md](./TESTING.md) for testing basics
2. Check this roadmap to see what's tested
3. Write tests for new code before implementation (TDD)

**Adding a new feature**:

```bash
# 1. Create test file first
touch src/lib/__tests__/myFeature.test.ts

# 2. Write failing tests
yarn test:watch

# 3. Implement feature until tests pass

# 4. Check coverage
yarn test:coverage
```

**Before committing**:

```bash
yarn lint        # Fix style issues
yarn test            # All tests must pass
yarn build       # Build must succeed
```

### For Reviewers

**PR Checklist**:

* \[ ] New features have tests
* \[ ] Existing tests still pass
* \[ ] Coverage doesn't decrease significantly
* \[ ] Tests follow patterns in existing test files
* \[ ] No console.log in production code

***

## Resources

### Documentation

* [Jest Documentation](https://jestjs.io/)
* [React Testing Library](https://testing-library.com/react)
* [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

### Internal Docs

* [TESTING.md](./TESTING.md) - How to write and run tests
* [This file](./TESTING_ROADMAP.md) - What to test next

### Questions

* Ask in team chat or create an issue
* Check existing tests for patterns
* Pair with someone who's written tests before

***

**Last Updated**: February 7, 2026\
**Status**: Phase 0 Complete ✅ - Ready for Phase 1
