# Testing Guide

This project uses **Jest** and **React Testing Library** for unit and component testing.

Production builds use `tsconfig.build.json`, extending the strict shared
TypeScript settings while excluding test files and Jest setup. Jest compiles
test files with `ts-jest`; application build success does not replace running
the tests. TypeScript stays on version 6 for test tooling compatibility, and
ESLint stays on version 9 until the Next.js lint plugins support version 10.

## Running Tests

```powershell
# Run all tests
yarn test

# Run tests in watch mode (auto-reruns on file changes)
yarn test:watch

# Run tests with coverage report
yarn test:coverage
```

## Test Structure

Tests are located in `__tests__` directories next to the code they test:

```txt
src/lib/
  ├── permissions.ts
  ├── utils.ts
  ├── gameValidation.ts
  └── __tests__/
      ├── permissions.test.ts
      ├── utils.test.ts
      └── gameValidation.test.ts
```

## Writing Tests

### Basic Test Example

```typescript
import { functionToTest } from '../myModule';

describe('Module Name', () => {
  describe('functionToTest', () => {
    it('should do something specific', () => {
      const result = functionToTest('input');
      expect(result).toBe('expected output');
    });

    it('should handle edge cases', () => {
      const result = functionToTest(null);
      expect(result).toBeNull();
    });
  });
});
```

### Testing Async Functions

```typescript
it('should fetch data successfully', async () => {
  const result = await fetchData('test-id');
  expect(result).toEqual({ id: 'test-id', name: 'Test' });
});
```

### Mocking Supabase

```typescript
// Mock the Supabase client
jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: { /* mock data */ },
            error: null,
          }),
        })),
      })),
    })),
  },
}));
```

## What to Test

### High Priority (Security & Core Logic)

✅ **Permission System** (`permissions.ts`) - CRITICAL  
✅ **Authentication** (`auth.ts`) - CRITICAL  
✅ **Role Management** (`canManageRole`, hierarchy) - CRITICAL  
✅ **Utility Functions** (`utils.ts`)  
✅ **Game Validation** (`gameValidation.ts`)

### Medium Priority

* API Routes (especially permission checks)
* Custom Hooks (`usePermissions`, `useAuth`, `useGroupMembership`)
* Data transformation functions
* Form validation logic

### Lower Priority

* UI Components (can add later with React Testing Library)
* Layout components
* Static configuration

## Test Coverage

Current coverage thresholds (set in `jest.config.ts`):

* **Branches**: 50%
* **Functions**: 50%
* **Lines**: 50%
* **Statements**: 50%

View coverage report:

```powershell
yarn test:coverage
```

This generates a detailed report in `coverage/lcov-report/index.html`.

## Best Practices

### ✅ DO

* Write tests for all security-critical code (permissions, auth)
* Test edge cases and error conditions
* Mock external dependencies (Supabase, APIs)
* Keep tests focused and isolated
* Use descriptive test names: `it('should allow admin to manage all roles', ...)`
* Group related tests with `describe` blocks

### ❌ DON'T

* Test implementation details (test behaviour, not code structure)
* Make tests dependent on each other
* Test third-party libraries (trust they work)
* Commit failing tests without fixing them
* Skip writing tests for "simple" functions (bugs hide there!)

## Example: Permission System Tests

The permission system tests demonstrate comprehensive testing:

```typescript
describe('Permission System', () => {
  // Test data structures
  describe('PERMISSIONS constant', () => {
    it('should have all permissions defined with required fields', () => {
      // Validates structure
    });
  });

  // Test business logic
  describe('roleHasPermission', () => {
    it('should grant admin ALL permissions', () => {
      // Security: verify admin has full access
    });

    it('should NOT allow members to edit other characters', () => {
      // Security: verify permission restrictions
    });
  });

  // Test role hierarchy
  describe('canManageRole', () => {
    it('should allow admin to manage all other roles', () => {
      // Verify hierarchy rules
    });
  });
});
```

## Troubleshooting

### Tests fail with "Cannot find module"

* Check your import paths use the `@/` alias correctly
* Verify `moduleNameMapper` in `jest.config.ts` is set up

### Supabase mocks not working

* Ensure you're mocking before importing the module that uses Supabase
* Check the mock structure matches your actual Supabase calls

### TypeScript errors in tests

* Install `@types/jest` (already included)
* Add test files to `tsconfig.json` include paths if needed

### CSS/Image imports failing

* Jest uses mocks in `__mocks__/styleMock.js` and `__mocks__/fileMock.js`
* These are configured in `jest.config.ts`

## Next Steps

As the codebase grows, consider adding:

1. **Integration Tests** - Test multiple modules working together
2. **Component Tests** - Use React Testing Library for UI components
3. **E2E Tests** - Consider Playwright or Cypress for full user flows
4. **API Route Tests** - Test all API endpoints with mocked Supabase
5. **Hook Tests** - Test custom React hooks with `renderHook`

## Continuous Integration

Before committing:

```powershell
yarn lint       # Check code style
yarn test           # Run all tests
yarn build      # Ensure build succeeds
```

Consider setting up GitHub Actions to run tests automatically on PRs.

---

**Found a bug through tests?** That's the point! Update the code, verify the test passes, and commit both.
