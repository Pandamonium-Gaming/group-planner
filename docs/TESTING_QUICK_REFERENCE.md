# Testing Quick Reference

Quick checklist for developers - bookmark this page!

## Before You Code

* \[ ] Check [TESTING\_ROADMAP.md](./TESTING_ROADMAP.md) to see what's already tested
* \[ ] Consider writing tests first (Test-Driven Development)
* \[ ] Plan what edge cases to test

## While You Code

```bash
# Run tests in watch mode (auto-rerun on changes)
yarn test:watch
```

## Before You Commit

```bash
# Run all checks
yarn lint        # ✅ No style issues
yarn test            # ✅ All tests pass
yarn build       # ✅ Build succeeds
```

## Quick Test Template

```typescript
// src/lib/__tests__/myFeature.test.ts
import { myFunction } from '../myFeature';

describe('myFeature', () => {
  describe('myFunction', () => {
    it('should handle normal case', () => {
      const result = myFunction('input');
      expect(result).toBe('expected');
    });

    it('should handle edge case', () => {
      const result = myFunction(null);
      expect(result).toBeNull();
    });

    it('should throw on invalid input', () => {
      expect(() => myFunction('bad')).toThrow();
    });
  });
});
```

## Common Test Patterns

### Testing Async Functions

```typescript
it('should fetch data', async () => {
  const data = await fetchData('id');
  expect(data).toEqual({ id: 'id', name: 'Test' });
});
```

### Mocking Supabase

```typescript
jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: { /* your mock data */ },
            error: null,
          }),
        })),
      })),
    })),
  },
}));
```

### Testing Permissions

```typescript
it('should allow admin to do X', () => {
  expect(roleHasPermission('admin', 'permission_name')).toBe(true);
});

it('should NOT allow member to do X', () => {
  expect(roleHasPermission('member', 'permission_name')).toBe(false);
});
```

## Test Coverage

```bash
# Generate coverage report
yarn test:coverage

# Open in browser
# File: coverage/lcov-report/index.html
```

**Coverage Targets**:

* Security-critical code: 90%+
* Business logic: 70%+
* UI components: 50%+

## Need Help

1. Read [TESTING.md](./TESTING.md) for detailed guide
2. Check [TESTING\_ROADMAP.md](./TESTING_ROADMAP.md) for what needs testing
3. Look at existing tests for examples
4. Ask the team!

***

**Remember**: Tests are documentation that never goes out of date! 📚
