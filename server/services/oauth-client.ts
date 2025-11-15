import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import * as jose from 'node-jose';

interface OAuthConfig {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  scopes: string;
}

export class OAuthClient {
  private config: OAuthConfig;
  private codeVerifier?: string;
  private codeChallenge?: string;
  private state?: string;

  constructor(config: OAuthConfig) {
    this.config = config;
  }

  // Generate PKCE challenge
  generatePKCE() {
    this.codeVerifier = crypto.randomBytes(32).toString('base64url');
    const hash = crypto.createHash('sha256').update(this.codeVerifier).digest();
    this.codeChallenge = hash.toString('base64url');
    return {
      code_verifier: this.codeVerifier,
      code_challenge: this.codeChallenge,
      code_challenge_method: 'S256'
    };
  }

  // Generate state for CSRF protection
  generateState() {
    this.state = crypto.randomBytes(16).toString('base64url');
    return this.state;
  }

  // Build authorization URL
  getAuthorizationUrl() {
    const pkce = this.generatePKCE();
    const state = this.generateState();
    
    const params = new URLSearchParams({
      client_id: this.config.client_id,
      redirect_uri: this.config.redirect_uri,
      response_type: 'code',
      scope: this.config.scopes,
      state: state,
      code_challenge: pkce.code_challenge,
      code_challenge_method: pkce.code_challenge_method
    });

    return `${this.config.authorization_endpoint}?${params.toString()}`;
  }

  // Exchange authorization code for tokens
  async exchangeCodeForTokens(code: string) {
    const response = await fetch(this.config.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.config.client_id}:${this.config.client_secret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: this.config.redirect_uri,
        code_verifier: this.codeVerifier!
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error_description || 'Token exchange failed');
    }

    return response.json();
  }

  // Get user info
  async getUserInfo(accessToken: string) {
    const response = await fetch(this.config.userinfo_endpoint, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    return response.json();
  }

  // Verify ID token
  async verifyIdToken(idToken: string) {
    // Fetch JWKS
    const jwksResponse = await fetch(this.config.jwks_uri);
    const jwks = await jwksResponse.json();
    
    // Create keystore
    const keystore = await jose.JWK.asKeyStore(jwks);
    
    // Verify and decode token
    const result = await jose.JWS.createVerify(keystore).verify(idToken);
    const claims = JSON.parse(result.payload.toString());
    
    // Verify standard claims
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp && claims.exp < now) {
      throw new Error('ID token has expired');
    }
    
    if (claims.aud !== this.config.client_id) {
      throw new Error('Invalid audience in ID token');
    }
    
    return claims;
  }

  // Refresh access token
  async refreshToken(refreshToken: string) {
    const response = await fetch(this.config.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.config.client_id}:${this.config.client_secret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error_description || 'Token refresh failed');
    }

    return response.json();
  }

  // Getters for state and code verifier (needed for session storage)
  getState() {
    return this.state;
  }

  getCodeVerifier() {
    return this.codeVerifier;
  }

  // Setters for restoring from session
  setState(state: string) {
    this.state = state;
  }

  setCodeVerifier(codeVerifier: string) {
    this.codeVerifier = codeVerifier;
  }
}