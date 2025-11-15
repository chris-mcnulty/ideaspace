import express from 'express';
import { OAuthClient } from '../services/oauth-client';
import storage from '../storage';
import { users, type User } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import type { Request, Response } from 'express';

const router = express.Router();

// Get OAuth config from environment
const isDevelopment = process.env.NODE_ENV !== 'production';
const ORION_BASE_URL = process.env.ORION_ISSUER_URL || 'http://localhost:5000';
const NEBULA_BASE_URL = isDevelopment ? 'http://localhost:5001' : process.env.NEBULA_BASE_URL || 'https://nebula.synozur.com';

// Initialize OAuth client
const oauthClient = new OAuthClient({
  client_id: process.env.ORION_CLIENT_ID || 'nebula_dev',
  client_secret: process.env.ORION_CLIENT_SECRET || '',
  redirect_uri: `${NEBULA_BASE_URL}/auth/callback`,
  authorization_endpoint: `${ORION_BASE_URL}/oauth/authorize`,
  token_endpoint: `${ORION_BASE_URL}/oauth/token`,
  userinfo_endpoint: `${ORION_BASE_URL}/oauth/userinfo`,
  jwks_uri: `${ORION_BASE_URL}/.well-known/jwks.json`,
  scopes: 'openid profile email'
});

// SSO login endpoint - redirect to Orion
router.get('/auth/sso/login', (req: Request, res: Response) => {
  try {
    const authUrl = oauthClient.getAuthorizationUrl();
    
    // Store OAuth state and code verifier in session for validation
    req.session.oauth_state = oauthClient.getState();
    req.session.code_verifier = oauthClient.getCodeVerifier();
    
    // Save the original URL they were trying to access (if any)
    if (req.query.returnTo) {
      req.session.returnTo = req.query.returnTo as string;
    }
    
    res.redirect(authUrl);
  } catch (error) {
    console.error('OAuth login error:', error);
    res.status(500).json({ error: 'Failed to initiate SSO login' });
  }
});

// OAuth callback endpoint
router.get('/auth/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error: oauthError } = req.query;
    
    // Handle OAuth errors
    if (oauthError) {
      console.error('OAuth error:', oauthError);
      return res.redirect('/login?error=oauth_failed');
    }
    
    // Validate state to prevent CSRF attacks
    if (state !== req.session.oauth_state) {
      console.error('Invalid state parameter');
      return res.redirect('/login?error=invalid_state');
    }
    
    // Validate code is present
    if (!code) {
      console.error('No authorization code received');
      return res.redirect('/login?error=no_code');
    }
    
    // Restore code verifier from session
    oauthClient.setCodeVerifier(req.session.code_verifier);
    
    // Exchange authorization code for tokens
    const tokens = await oauthClient.exchangeCodeForTokens(code as string);
    
    // Get user info from Orion
    const userInfo = await oauthClient.getUserInfo(tokens.access_token);
    
    // Verify ID token (optional but recommended)
    let idTokenClaims;
    if (tokens.id_token) {
      try {
        idTokenClaims = await oauthClient.verifyIdToken(tokens.id_token);
      } catch (error) {
        console.error('ID token verification failed:', error);
        // Continue without ID token verification for now
      }
    }
    
    // Create or update user in Nebula database
    let user = await db.select().from(users)
      .where(eq(users.orionId, userInfo.sub))
      .limit(1);
    
    if (user.length === 0) {
      // Check if user exists with same email (migration case)
      const existingUser = await db.select().from(users)
        .where(eq(users.email, userInfo.email))
        .limit(1);
      
      if (existingUser.length > 0) {
        // Update existing user to link with Orion
        await db.update(users)
          .set({
            orionId: userInfo.sub,
            authProvider: 'orion',
            orionTenantId: userInfo.tenant_id,
            emailVerified: userInfo.email_verified || false,
            lastLogin: new Date(),
            updatedAt: new Date()
          })
          .where(eq(users.id, existingUser[0].id));
        user = existingUser;
      } else {
        // Create new user
        const newUser = await db.insert(users).values({
          email: userInfo.email,
          username: userInfo.preferred_username || userInfo.email.split('@')[0],
          displayName: userInfo.name,
          orionId: userInfo.sub,
          authProvider: 'orion',
          orionTenantId: userInfo.tenant_id,
          organizationId: null, // Will need to map from tenant_id
          role: mapOrionRoleToNebula(userInfo.roles),
          emailVerified: userInfo.email_verified || false,
          lastLogin: new Date()
        }).returning();
        user = newUser;
      }
    } else {
      // Update last login
      await db.update(users)
        .set({
          lastLogin: new Date(),
          updatedAt: new Date()
        })
        .where(eq(users.id, user[0].id));
    }
    
    // Store user session
    req.session.userId = user[0].id;
    req.session.user = user[0];
    req.session.access_token = tokens.access_token;
    req.session.refresh_token = tokens.refresh_token;
    req.session.id_token = tokens.id_token;
    
    // Clear OAuth state from session
    delete req.session.oauth_state;
    delete req.session.code_verifier;
    
    // Redirect to original destination or dashboard
    const returnTo = req.session.returnTo || '/o';
    delete req.session.returnTo;
    
    res.redirect(returnTo);
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect('/login?error=callback_failed');
  }
});

// SSO logout endpoint
router.post('/auth/sso/logout', (req: Request, res: Response) => {
  const idToken = req.session.id_token;
  
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    
    // If we have an ID token, redirect to Orion's logout endpoint
    if (idToken) {
      const logoutUrl = new URLSearchParams({
        id_token_hint: idToken,
        post_logout_redirect_uri: `${NEBULA_BASE_URL}/login`
      });
      res.json({ 
        success: true, 
        redirectUrl: `${ORION_BASE_URL}/oauth/logout?${logoutUrl}`
      });
    } else {
      res.json({ success: true, redirectUrl: '/login' });
    }
  });
});

// Token refresh endpoint
router.post('/auth/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.session.refresh_token;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token available' });
    }
    
    // Refresh the tokens
    const tokens = await oauthClient.refreshToken(refreshToken);
    
    // Update session with new tokens
    req.session.access_token = tokens.access_token;
    if (tokens.refresh_token) {
      req.session.refresh_token = tokens.refresh_token;
    }
    if (tokens.id_token) {
      req.session.id_token = tokens.id_token;
    }
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ error: 'Token refresh failed' });
  }
});

// Helper function to map Orion roles to Nebula roles
function mapOrionRoleToNebula(orionRoles: string[]): string {
  // Check for nebula-specific roles first
  const nebulaRoles = orionRoles.filter(role => role.startsWith('nebula.'));
  
  if (nebulaRoles.includes('nebula.global_admin')) {
    return 'global_admin';
  }
  if (nebulaRoles.includes('nebula.company_admin')) {
    return 'company_admin';
  }
  if (nebulaRoles.includes('nebula.facilitator')) {
    return 'facilitator';
  }
  
  // Default to user role
  return 'user';
}

export default router;