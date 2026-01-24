import { Router, Request, Response } from 'express';
import { ConfidentialClientApplication, Configuration } from '@azure/msal-node';
import crypto from 'crypto';
import { storage } from '../storage';
import { isPublicEmailDomain, getEmailDomain } from '@shared/schema';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    isAuthenticated?: boolean;
    pkceCodes?: {
      verifier: string;
      challenge: string;
      challengeMethod: string;
    };
    oauthState?: string;
    returnTo?: string;
  }
}

const router = Router();

// MSAL Configuration
// Note: AZURE_TENANT_ID should be set to "common" for multi-tenant mode
// This allows users from ANY Microsoft tenant to authenticate
// The actual tenant ID is captured from the token and stored in the organizations table
// for tenant-specific operations like user directory lookups
const msalConfig: Configuration = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID || '',
    // Use 'common' for multi-tenant: allows any org directory + personal Microsoft accounts
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'common'}`,
    clientSecret: process.env.AZURE_CLIENT_SECRET || '',
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (!containsPii) {
          console.log(`[MSAL] ${message}`);
        }
      },
      piiLoggingEnabled: false,
      logLevel: 3, // Warning
    },
  },
};

// Initialize MSAL client if credentials are configured
let msalClient: ConfidentialClientApplication | null = null;

// PKCE helper functions using native crypto
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function getMsalClient(): ConfidentialClientApplication {
  if (!msalClient) {
    if (!process.env.AZURE_CLIENT_ID || !process.env.AZURE_CLIENT_SECRET) {
      throw new Error('Entra ID SSO is not configured. Missing AZURE_CLIENT_ID or AZURE_CLIENT_SECRET.');
    }
    msalClient = new ConfidentialClientApplication(msalConfig);
  }
  return msalClient;
}

// Redirect URI - dynamically constructed based on environment
function getRedirectUri(req: Request): string {
  // In production with reverse proxy, use x-forwarded headers
  // Handle comma-separated values (multiple proxies)
  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
  
  const protocol = forwardedProto || (process.env.NODE_ENV === 'production' ? 'https' : req.protocol);
  const host = forwardedHost || req.get('host') || 'localhost:5000';
  const redirectUri = `${protocol}://${host}/auth/entra/callback`;
  
  console.log('[Entra SSO] Headers:', {
    'x-forwarded-proto': req.get('x-forwarded-proto'),
    'x-forwarded-host': req.get('x-forwarded-host'),
    'host': req.get('host'),
    'computed': redirectUri
  });
  
  return redirectUri;
}

// Check if Entra SSO is enabled
router.get('/api/auth/entra/status', async (_req: Request, res: Response) => {
  try {
    const isConfigured = !!(process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET);
    
    // Check if SSO is enabled system-wide
    const systemSetting = await storage.getSystemSetting('entra_sso_enabled');
    const isEnabled = systemSetting ? (systemSetting.value as boolean) : isConfigured;
    
    res.json({
      enabled: isEnabled && isConfigured,
      configured: isConfigured,
    });
  } catch (error) {
    console.error('Error checking Entra SSO status:', error);
    res.json({ enabled: false, configured: false });
  }
});

// Generate secure random state for CSRF protection
function generateState(): string {
  return crypto.randomBytes(32).toString('base64url');
}

// Initiate Entra SSO login
router.get('/auth/entra/login', async (req: Request, res: Response) => {
  try {
    console.log('[Entra SSO Login] Starting, sessionID:', req.sessionID);
    
    const client = getMsalClient();
    
    // Generate PKCE codes
    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);
    
    // Generate state for CSRF protection
    const state = generateState();
    
    // Store PKCE verifier and state in session
    req.session.pkceCodes = {
      verifier,
      challenge,
      challengeMethod: 'S256',
    };
    req.session.oauthState = state;
    
    // Store return URL if provided
    if (req.query.returnTo) {
      req.session.returnTo = req.query.returnTo as string;
    }
    
    // Scopes for SSO - includes User.Read.All for tenant admin user lookup
    // Note: User.Read.All requires admin consent in most tenants
    const authCodeUrlParameters = {
      scopes: ['openid', 'profile', 'email', 'User.Read', 'User.Read.All'],
      redirectUri: getRedirectUri(req),
      codeChallenge: challenge,
      codeChallengeMethod: 'S256',
      prompt: 'select_account', // Allow user to choose account
      state, // Add state for CSRF protection
    };
    
    const authUrl = await client.getAuthCodeUrl(authCodeUrlParameters);
    
    // Explicitly save session before redirect to ensure PKCE codes are persisted
    req.session.save((err) => {
      if (err) {
        console.error('[Entra SSO Login] Session save error:', err);
        return res.redirect(`/auth?error=${encodeURIComponent('Session error')}`);
      }
      console.log('[Entra SSO Login] Session saved, redirecting to Microsoft. SessionID:', req.sessionID);
      res.redirect(authUrl);
    });
  } catch (error: any) {
    console.error('Error initiating Entra login:', error);
    res.redirect(`/auth?error=${encodeURIComponent(error.message || 'Failed to initiate SSO login')}`);
  }
});

// Handle Entra SSO callback
router.get('/auth/entra/callback', async (req: Request, res: Response) => {
  console.log('[Entra SSO Callback] Received callback, sessionID:', req.sessionID);
  console.log('[Entra SSO Callback] Session has PKCE:', !!req.session.pkceCodes, 'has state:', !!req.session.oauthState);
  try {
    const { code, error, error_description, state } = req.query;
    console.log('[Entra SSO Callback] Query params:', { code: code ? 'present' : 'missing', error, state: state ? 'present' : 'missing' });
    
    if (error) {
      console.error('Entra SSO error:', error, error_description);
      // Clear session state on error
      delete req.session.pkceCodes;
      delete req.session.oauthState;
      delete req.session.returnTo;
      return res.redirect(`/auth?error=${encodeURIComponent(error_description as string || error as string)}`);
    }
    
    if (!code) {
      return res.redirect('/login?error=No authorization code received');
    }
    
    // Validate state parameter for CSRF protection
    const storedState = req.session.oauthState;
    if (!storedState || storedState !== state) {
      console.error('State mismatch - potential CSRF attack detected', {
        hasStoredState: !!storedState,
        storedStatePrefix: storedState?.substring(0, 8),
        receivedStatePrefix: (state as string)?.substring(0, 8),
        sessionId: req.sessionID?.substring(0, 8),
        hasSession: !!req.session,
      });
      delete req.session.pkceCodes;
      delete req.session.oauthState;
      delete req.session.returnTo;
      return res.redirect('/login?error=Security validation failed. Please try again.');
    }
    
    const pkceCodes = req.session.pkceCodes;
    if (!pkceCodes?.verifier) {
      return res.redirect('/login?error=Session expired. Please try again.');
    }
    
    const client = getMsalClient();
    
    // Exchange code for tokens
    const tokenRequest = {
      code: code as string,
      scopes: ['openid', 'profile', 'email', 'User.Read', 'User.Read.All'],
      redirectUri: getRedirectUri(req),
      codeVerifier: pkceCodes.verifier,
    };
    
    const tokenResponse = await client.acquireTokenByCode(tokenRequest);
    
    // Clear PKCE codes and state from session
    delete req.session.pkceCodes;
    delete req.session.oauthState;
    
    if (!tokenResponse.account) {
      return res.redirect('/login?error=Failed to get user account from SSO');
    }
    
    // Extract user info from token response
    const email = tokenResponse.account.username.toLowerCase();
    const displayName = tokenResponse.account.name || email.split('@')[0];
    const entraId = tokenResponse.account.localAccountId; // Microsoft Object ID
    const entraTenantId = tokenResponse.account.tenantId;
    
    // Process user with JIT provisioning
    const result = await processEntraUser({
      email,
      displayName,
      entraId,
      entraTenantId,
    });
    
    if (!result.success) {
      return res.redirect(`/auth?error=${encodeURIComponent(result.error || 'Failed to process SSO user')}`);
    }
    
    // Set session
    req.session.userId = result.user!.id;
    req.session.isAuthenticated = true;
    
    // Redirect to return URL or dashboard
    const returnTo = (req.session as any).returnTo || '/';
    delete (req.session as any).returnTo;
    
    // Explicitly save session before redirect to ensure cookie is set
    req.session.save((err) => {
      if (err) {
        console.error('[Entra SSO] Session save error:', err);
        return res.redirect('/login?error=Session error');
      }
      console.log('[Entra SSO] Session saved successfully:', {
        sessionId: req.sessionID,
        userId: req.session.userId,
        isAuthenticated: req.session.isAuthenticated,
        cookie: req.session.cookie,
        returnTo
      });
      res.redirect(returnTo);
    });
  } catch (error: any) {
    console.error('Error processing Entra callback:', error);
    res.redirect(`/auth?error=${encodeURIComponent(error.message || 'SSO authentication failed')}`);
  }
});

interface EntraUserInfo {
  email: string;
  displayName: string;
  entraId: string;
  entraTenantId: string;
}

interface ProcessUserResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    role: string;
    organizationId: string | null;
  };
  error?: string;
  isNewUser?: boolean;
  isNewTenant?: boolean;
}

interface FindOrCreateOrgParams {
  entraTenantId: string;
  emailDomain: string;
  isPublicDomain: boolean;
  displayName: string;
  entraId: string;
}

interface FindOrCreateOrgResult {
  success: boolean;
  org?: {
    id: string;
    name: string;
    inviteOnly: boolean;
  };
  isNew: boolean;
  error?: string;
}

// Find or create organization with race condition handling
async function findOrCreateOrganization(params: FindOrCreateOrgParams): Promise<FindOrCreateOrgResult> {
  const { entraTenantId, emailDomain, isPublicDomain, displayName, entraId } = params;
  
  // For corporate domains: lookup by Entra tenant ID first, then by domain
  if (!isPublicDomain) {
    // First check by Entra tenant ID
    let org = await storage.getOrganizationByEntraTenantId(entraTenantId);
    if (org) {
      // Existing org found by tenant ID
      if (org.inviteOnly) {
        return {
          success: false,
          isNew: false,
          error: 'This organization requires an invitation to join. Please contact your administrator.',
        };
      }
      return { success: true, org: { id: org.id, name: org.name, inviteOnly: org.inviteOnly }, isNew: false };
    }
    
    // Check by email domain
    org = await storage.getOrganizationByDomain(emailDomain);
    if (org) {
      // Existing org found by domain - update with Entra tenant ID if not set
      if (!org.entraTenantId) {
        await storage.updateOrganization(org.id, { entraTenantId, ssoEnabled: true, ssoProvider: 'entra' });
      }
      if (org.inviteOnly) {
        return {
          success: false,
          isNew: false,
          error: 'This organization requires an invitation to join. Please contact your administrator.',
        };
      }
      return { success: true, org: { id: org.id, name: org.name, inviteOnly: org.inviteOnly }, isNew: false };
    }
    
    // Create new corporate organization
    const orgName = emailDomain.split('.')[0].charAt(0).toUpperCase() + emailDomain.split('.')[0].slice(1);
    const slug = await generateUniqueSlug(orgName);
    const trialPlan = await storage.getServicePlanByName('trial');
    
    try {
      const newOrg = await storage.createOrganization({
        name: orgName,
        slug,
        domain: emailDomain,
        inviteOnly: false,
        ssoEnabled: true,
        ssoProvider: 'entra',
        entraTenantId,
        servicePlanId: trialPlan?.id || null,
        subscriptionStartedAt: new Date(),
        subscriptionExpiresAt: trialPlan?.trialDays 
          ? new Date(Date.now() + trialPlan.trialDays * 24 * 60 * 60 * 1000)
          : null,
      });
      
      console.log(`[Entra SSO] Created new corporate org: ${orgName} for domain ${emailDomain}`);
      return { success: true, org: { id: newOrg.id, name: newOrg.name, inviteOnly: false }, isNew: true };
    } catch (error: any) {
      // Race condition: another request created the org first
      // Re-fetch and return that org
      console.log(`[Entra SSO] Race condition detected, re-fetching org for domain: ${emailDomain}`);
      const existingOrg = await storage.getOrganizationByEntraTenantId(entraTenantId) || 
                          await storage.getOrganizationByDomain(emailDomain);
      if (existingOrg) {
        if (existingOrg.inviteOnly) {
          return {
            success: false,
            isNew: false,
            error: 'This organization requires an invitation to join. Please contact your administrator.',
          };
        }
        return { success: true, org: { id: existingOrg.id, name: existingOrg.name, inviteOnly: existingOrg.inviteOnly }, isNew: false };
      }
      // Still couldn't find - something else went wrong
      throw error;
    }
  }
  
  // For public domains: create personal invite-only tenant
  // Use entraId as the key to ensure idempotency
  const personalOrgSlug = `personal-${entraId.substring(0, 8)}`;
  
  // Check if personal org already exists
  const existingPersonalOrg = await storage.getOrganizationBySlug(personalOrgSlug);
  if (existingPersonalOrg) {
    return { 
      success: true, 
      org: { id: existingPersonalOrg.id, name: existingPersonalOrg.name, inviteOnly: existingPersonalOrg.inviteOnly }, 
      isNew: false 
    };
  }
  
  // Create personal org
  const orgName = `${displayName}'s Workspace`;
  const trialPlan = await storage.getServicePlanByName('trial');
  
  try {
    const newOrg = await storage.createOrganization({
      name: orgName,
      slug: personalOrgSlug,
      domain: null, // No domain for personal orgs
      inviteOnly: true, // Personal orgs are invite-only
      ssoEnabled: true,
      ssoProvider: 'entra',
      entraTenantId: null, // No tenant mapping for personal orgs
      servicePlanId: trialPlan?.id || null,
      subscriptionStartedAt: new Date(),
      subscriptionExpiresAt: trialPlan?.trialDays 
        ? new Date(Date.now() + trialPlan.trialDays * 24 * 60 * 60 * 1000)
        : null,
    });
    
    console.log(`[Entra SSO] Created personal org for user ${displayName} (${entraId})`);
    return { success: true, org: { id: newOrg.id, name: newOrg.name, inviteOnly: true }, isNew: true };
  } catch (error: any) {
    // Race condition: re-fetch
    console.log(`[Entra SSO] Race condition for personal org, re-fetching: ${personalOrgSlug}`);
    const existingOrg = await storage.getOrganizationBySlug(personalOrgSlug);
    if (existingOrg) {
      return { success: true, org: { id: existingOrg.id, name: existingOrg.name, inviteOnly: existingOrg.inviteOnly }, isNew: false };
    }
    throw error;
  }
}

async function processEntraUser(userInfo: EntraUserInfo): Promise<ProcessUserResult> {
  const { email, displayName, entraId, entraTenantId } = userInfo;
  const emailDomain = getEmailDomain(email);
  const isPublicDomain = isPublicEmailDomain(email);
  
  // Check if user already exists by Entra ID (idempotent check)
  let existingUser = await storage.getUserByEntraId(entraId);
  
  if (existingUser) {
    // Check if user's organization has SSO enabled
    if (existingUser.organizationId) {
      const org = await storage.getOrganization(existingUser.organizationId);
      if (org && !org.ssoEnabled) {
        return {
          success: false,
          error: 'SSO is not enabled for your organization. Please use email and password to sign in.',
        };
      }
    }
    
    // Update last login
    await storage.updateUser(existingUser.id, { lastLogin: new Date() });
    return {
      success: true,
      user: {
        id: existingUser.id,
        email: existingUser.email,
        role: existingUser.role,
        organizationId: existingUser.organizationId,
      },
      isNewUser: false,
    };
  }
  
  // Check if user exists by email (might have local account)
  existingUser = await storage.getUserByEmail(email);
  
  if (existingUser) {
    // Check if user's organization has SSO enabled before linking
    if (existingUser.organizationId) {
      const org = await storage.getOrganization(existingUser.organizationId);
      if (org && !org.ssoEnabled) {
        return {
          success: false,
          error: 'SSO is not enabled for your organization. Please use email and password to sign in.',
        };
      }
    }
    
    // Link existing user to Entra ID
    await storage.updateUser(existingUser.id, {
      entraId,
      entraTenantId,
      authProvider: 'entra',
      emailVerified: true, // SSO users are verified by Microsoft
      lastLogin: new Date(),
    });
    return {
      success: true,
      user: {
        id: existingUser.id,
        email: existingUser.email,
        role: existingUser.role,
        organizationId: existingUser.organizationId,
      },
      isNewUser: false,
    };
  }
  
  // New user - determine organization
  // Use create-or-fetch pattern to handle race conditions
  let organization = await findOrCreateOrganization({
    entraTenantId,
    emailDomain,
    isPublicDomain,
    displayName,
    entraId, // Used for personal tenant mapping
  });
  
  if (!organization.success) {
    return {
      success: false,
      error: organization.error,
    };
  }
  
  const org = organization.org!;
  const isNewTenant = organization.isNew;
  
  // For existing orgs, check if SSO is enabled before allowing new user provisioning
  if (!isNewTenant) {
    const fullOrg = await storage.getOrganization(org.id);
    if (fullOrg && !fullOrg.ssoEnabled) {
      return {
        success: false,
        error: 'SSO is not enabled for your organization. Please use email and password to sign in, or contact your administrator to enable SSO.',
      };
    }
  }
  
  // Determine role: first user in a new tenant becomes admin
  // For existing tenants, check if there are any existing users with admin role
  let userRole = 'user';
  if (isNewTenant) {
    userRole = 'company_admin';
  } else {
    // Check if org has any company admins - if not, this user becomes admin
    const existingOrgUsers = await storage.getUsersByOrganization(org.id);
    const hasAdmin = existingOrgUsers.some(u => u.role === 'company_admin');
    if (!hasAdmin) {
      userRole = 'company_admin';
    }
  }
  
  // Create the user
  const username = await generateUniqueUsername(email);
  
  const newUser = await storage.createUser({
    email,
    username,
    displayName,
    password: null, // SSO users don't have passwords
    organizationId: org.id,
    role: userRole,
    authProvider: 'entra',
    entraId,
    entraTenantId,
    emailVerified: true, // SSO users are verified by Microsoft
  });
  
  // Create company admin association if they're an admin
  if (userRole === 'company_admin') {
    await storage.createCompanyAdmin({
      userId: newUser.id,
      organizationId: org.id,
    });
  }
  
  console.log(`[Entra SSO] New user provisioned: ${email}, org: ${org.name}, role: ${userRole}`);
  
  return {
    success: true,
    user: {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      organizationId: newUser.organizationId,
    },
    isNewUser: true,
    isNewTenant,
  };
}

async function generateUniqueSlug(name: string): Promise<string> {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
  
  let slug = baseSlug;
  let counter = 1;
  
  while (await storage.getOrganizationBySlug(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  return slug;
}

async function generateUniqueUsername(email: string): Promise<string> {
  const baseUsername = email.split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 30);
  
  let username = baseUsername;
  let counter = 1;
  
  while (await storage.getUserByUsername(username)) {
    username = `${baseUsername}${counter}`;
    counter++;
  }
  
  return username;
}

// Logout from Entra SSO
router.post('/auth/entra/logout', (req: Request, res: Response) => {
  const tenantId = process.env.AZURE_TENANT_ID || 'common';
  const logoutUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(getRedirectUri(req).replace('/callback', '/logout-complete'))}`;
  
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
    }
    res.json({ logoutUrl });
  });
});

router.get('/auth/entra/logout-complete', (_req: Request, res: Response) => {
  res.redirect('/login?message=You have been signed out');
});

export default router;
