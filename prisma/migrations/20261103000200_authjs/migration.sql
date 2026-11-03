CREATE SCHEMA authjs;
REVOKE ALL ON SCHEMA authjs FROM PUBLIC;

CREATE TABLE authjs.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  email text UNIQUE,
  "emailVerified" timestamptz,
  image text
);
CREATE TABLE authjs.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES authjs.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  provider text NOT NULL,
  "providerAccountId" text NOT NULL,
  refresh_token text,
  access_token text,
  expires_at bigint,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  oauth_token_secret text,
  oauth_token text,
  UNIQUE(provider, "providerAccountId")
);
CREATE TABLE authjs.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionToken" text NOT NULL UNIQUE,
  "userId" uuid NOT NULL REFERENCES authjs.users(id) ON DELETE CASCADE,
  expires timestamptz NOT NULL
);
CREATE INDEX sessions_user_id_idx ON authjs.sessions("userId");
CREATE TABLE authjs.verification_token (
  identifier text NOT NULL,
  token text NOT NULL,
  expires timestamptz NOT NULL,
  PRIMARY KEY(identifier, token)
);
REVOKE ALL ON ALL TABLES IN SCHEMA authjs FROM PUBLIC;
