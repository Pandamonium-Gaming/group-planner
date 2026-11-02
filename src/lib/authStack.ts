export type AuthStack = 'v1' | 'v2';

function normalizeAuthStack(value: string | undefined): AuthStack {
  return value === 'v2' ? 'v2' : 'v1';
}

export function getClientAuthStack(): AuthStack {
  return normalizeAuthStack(process.env.NEXT_PUBLIC_AUTH_STACK);
}

export function getServerAuthStack(): AuthStack {
  return normalizeAuthStack(process.env.AUTH_STACK || process.env.NEXT_PUBLIC_AUTH_STACK);
}
