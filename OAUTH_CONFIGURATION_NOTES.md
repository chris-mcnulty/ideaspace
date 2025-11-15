# OAuth Configuration - Resume Next Week

## Current Status
OAuth 2.1 integration with Orion identity provider is partially complete but cannot authenticate due to application registration mismatch.

## Error Encountered
**Error**: "Application Not Found - The requesting application could not be found or is not authorized"

**Root Cause**: The Nebula application needs to be registered (or updated) in the Orion identity provider with the current Replit domain.

## Current Configuration

### Environment Variables
- **Client ID**: `nebula_dev_eed8c7f6ed8ffbdd`
- **Issuer URL**: `https://de9b7c40-dcaa-46b2-b0c0-d28fd76a0dab-00-2enzqmoszfuzm.janeway.replit.dev/`
- **Current Redirect URI**: `https://e790b9bb-142e-4283-ad40-0d97909b078e-00-2m5ydpw5a67dn.spock.replit.dev/auth/callback`

### OAuth Client Configuration
```javascript
{
  client_id: process.env.ORION_CLIENT_ID,
  client_secret: process.env.ORION_CLIENT_SECRET,
  redirect_uri: `${NEBULA_BASE_URL}/auth/callback`,
  authorization_endpoint: `${ORION_BASE_URL}/oauth/authorize`,
  token_endpoint: `${ORION_BASE_URL}/oauth/token`,
  userinfo_endpoint: `${ORION_BASE_URL}/oauth/userinfo`,
  jwks_uri: `${ORION_BASE_URL}/.well-known/jwks.json`,
  scopes: 'openid profile email'
}
```

## Steps to Complete OAuth Integration (Next Week)

### 1. Register Application in Orion
Go to the Orion identity provider admin panel and register/update the Nebula application:

- **Application Name**: Nebula
- **Client ID**: `nebula_dev_eed8c7f6ed8ffbdd` (from ORION_CLIENT_ID secret)
- **Redirect URI**: `https://e790b9bb-142e-4283-ad40-0d97909b078e-00-2m5ydpw5a67dn.spock.replit.dev/auth/callback`
  - **IMPORTANT**: Must match EXACTLY including protocol (https://) and path (/auth/callback)
  - **NOTE**: Replit domains change when the repl is forked or recreated, so you'll need to update this
- **Grant Types**: Authorization Code with PKCE
- **Scopes**: `openid profile email`
- **Token Endpoint Auth Method**: client_secret_post or client_secret_basic

### 2. Common OAuth Registration Issues to Avoid

1. **Redirect URI Mismatch**
   - No trailing slashes unless registered that way
   - Protocol must match (https:// vs http://)
   - Check for typos in domain name
   - Case sensitivity matters in some providers

2. **Client Credentials**
   - Ensure Client ID has no extra quotes, commas, or whitespace
   - Verify Client Secret is correct
   - Make sure credentials match what's in Orion console

3. **Scopes**
   - Ensure requested scopes match what's configured in Orion
   - Minimum: `openid profile email`

### 3. Testing After Configuration

Once the application is registered in Orion:

1. **Disable the killswitch** (re-enable OAuth):
   ```sql
   UPDATE system_settings 
   SET value = 'true'::jsonb 
   WHERE key = 'oauth_enabled' AND organization_id IS NULL;
   ```
   
   Or via API (as admin):
   ```javascript
   await storage.setSystemSetting({
     key: 'oauth_enabled',
     value: true,
     description: 'System-wide OAuth toggle',
     organizationId: null,
     updatedBy: userId
   });
   ```

2. **Test the OAuth flow**:
   - Navigate to `/login`
   - Click "Sign in with Synozur account"
   - Should redirect to Orion login
   - After successful login, should redirect back to Nebula

3. **Verify user creation/linking**:
   - Check that user is created in `users` table
   - Verify `orionId`, `authProvider`, and role mapping
   - Test both new user creation and existing user linking

## OAuth Killswitch Feature

### Current Implementation
- **System Settings Table**: Controls OAuth on/off state
- **API Endpoint**: `GET /api/auth/oauth-status` returns `{ enabled: boolean }`
- **Login Page**: Conditionally renders SSO button based on status
- **Default Behavior**: OAuth enabled if credentials are configured

### Activate Killswitch (Disable OAuth)
```sql
INSERT INTO system_settings (id, key, value, description, updated_at, created_at) 
VALUES (gen_random_uuid(), 'oauth_enabled', 'false'::jsonb, 'System-wide OAuth toggle', now(), now())
ON CONFLICT (key, organization_id) DO UPDATE SET value = 'false'::jsonb;
```

### Deactivate Killswitch (Enable OAuth)
```sql
UPDATE system_settings 
SET value = 'true'::jsonb 
WHERE key = 'oauth_enabled' AND organization_id IS NULL;
```

### Check Current Status
```sql
SELECT * FROM system_settings WHERE key = 'oauth_enabled';
```

## Files Modified for OAuth Integration

1. **Database Schema**: `shared/schema.ts`
   - Added `systemSettings` table
   - Updated `users` table with OAuth fields

2. **Storage Layer**: `server/storage.ts`
   - Added system settings CRUD methods

3. **OAuth Routes**: `server/routes/auth-oauth.ts`
   - OAuth status endpoint
   - SSO login flow
   - Callback handling
   - User creation/linking logic

4. **OAuth Client**: `server/services/oauth-client.ts`
   - PKCE implementation
   - Token exchange
   - ID token verification

5. **Login Page**: `client/src/pages/Login.tsx`
   - Conditional SSO button rendering
   - OAuth status check on mount

6. **Documentation**: `replit.md`
   - OAuth integration details
   - Killswitch documentation

## Production Recommendations (Future)

1. **Persistent Session Store**: Use PostgreSQL-based session store instead of memory store
2. **Tenant-to-Organization Mapping**: Implement automatic organization assignment based on `orionTenantId`
3. **Token Rotation**: Implement refresh token rotation and storage
4. **Error Handling**: Add user-friendly error messages for OAuth failures
5. **Audit Logging**: Track OAuth authentication events
6. **Multi-Environment Support**: Different OAuth apps for dev/staging/production

## Contact for OAuth Configuration
When ready to resume OAuth configuration, the Orion admin panel owner will need to register the application with the current redirect URI.
