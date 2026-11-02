import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { Issuer } from 'openid-client';
import ts from 'typescript';

test('Discord callbacks validate the configured issuer and retain state checks', async () => {
  const source = ts.createSourceFile(
    'auth.ts',
    readFileSync(new URL('../../src/auth.ts', import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  let configuredIssuer: string | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'Discord') {
      const options = node.arguments[0];
      if (options && ts.isObjectLiteralExpression(options)) {
        for (const property of options.properties) {
          if (ts.isPropertyAssignment(property) && property.name.getText(source) === 'issuer'
            && ts.isStringLiteral(property.initializer)) {
            configuredIssuer = property.initializer.text;
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.equal(configuredIssuer, 'https://discord.com');

  const issuer = new Issuer({ issuer: configuredIssuer });
  const client = new issuer.Client({ client_id: 'test-discord-client' });
  const callbackUrl = 'https://example.com/api/auth/callback/discord';
  const params = {
    iss: 'https://discord.com',
    state: 'test-state',
    error: 'access_denied',
  };

  await assert.rejects(
    client.oauthCallback(callbackUrl, params, { state: 'test-state' }),
    /access_denied/
  );
  await assert.rejects(
    client.oauthCallback(callbackUrl, { ...params, iss: 'https://example.com' }, { state: 'test-state' }),
    /iss mismatch/
  );
  await assert.rejects(
    client.oauthCallback(callbackUrl, params, { state: 'different-state' }),
    /state mismatch/
  );
});
