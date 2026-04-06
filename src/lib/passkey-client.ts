import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable
} from '@simplewebauthn/browser';
import { logger } from './logger';
// Types are used in function signatures but not directly referenced

export interface PasskeySupport {
  isSupported: boolean;
  isPlatformAuthenticatorAvailable: boolean;
  error?: string;
}

export interface PasskeyRegistrationResult {
  success: boolean;
  credential?: {
    id: string;
    deviceName: string;
    createdAt: string;
    deviceType: string;
  };
  error?: string;
}

export interface PasskeyAuthenticationResult {
  success: boolean;
  redirectUrl?: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  authenticatedWith?: string;
  deviceName?: string;
  mfaWarning?: {
    shouldShow: boolean;
    isMandatory: boolean;
    message: string;
  };
  error?: string;
}

/**
 * Check if passkeys are supported in the current browser
 */
export async function checkPasskeySupport(): Promise<PasskeySupport> {
  try {
    // Check if we're on HTTP (not HTTPS)
    if (typeof window !== 'undefined' && window.location.protocol === 'http:' && window.location.hostname === 'localhost') {
      return {
        isSupported: false,
        isPlatformAuthenticatorAvailable: false,
        error: 'Passkeys require HTTPS. Use npm run dev:https to test locally.',
      };
    }

    const isSupported = browserSupportsWebAuthn();
    const isPlatformAuthenticatorAvailable = await platformAuthenticatorIsAvailable();

    return {
      isSupported,
      isPlatformAuthenticatorAvailable,
    };
  } catch (error) {
    return {
      isSupported: false,
      isPlatformAuthenticatorAvailable: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Register a new passkey for partner
 */
export async function registerPartnerPasskey(
  userDisplayName?: string,
  deviceName?: string
): Promise<PasskeyRegistrationResult> {
  try {
    // Check browser support
    if (!browserSupportsWebAuthn()) {
      return {
        success: false,
        error: 'Passkeys are not supported in this browser',
      };
    }

    // Start registration process
    const beginResponse = await fetch('/api/partner/auth/passkey/register-begin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userDisplayName }),
    });

    if (!beginResponse.ok) {
      const error = await beginResponse.json();
      return {
        success: false,
        error: error.error || 'Failed to start passkey registration',
      };
    }

    const { options } = await beginResponse.json();

    // Start WebAuthn registration
    const registrationResponse = await startRegistration(options);

    // Complete registration
    const finishResponse = await fetch('/api/partner/auth/passkey/register-finish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        response: registrationResponse,
        deviceName,
      }),
    });

    if (!finishResponse.ok) {
      const error = await finishResponse.json();
      return {
        success: false,
        error: error.error || 'Failed to complete passkey registration',
      };
    }

    const result = await finishResponse.json();
    return {
      success: true,
      credential: result.credential,
    };

  } catch (error) {
    logger.error('Passkey registration error', error as Error, {
      operation: 'passkey_client'
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed',
    };
  }
}

/**
 * Authenticate with passkey for partner
 */
export async function authenticatePartnerWithPasskey(
  email: string
): Promise<PasskeyAuthenticationResult> {
  try {
    // Check browser support
    if (!browserSupportsWebAuthn()) {
      return {
        success: false,
        error: 'Passkeys are not supported in this browser',
      };
    }

    // Start authentication process
    const beginResponse = await fetch('/api/partner/auth/passkey/authenticate-begin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!beginResponse.ok) {
      const error = await beginResponse.json();
      return {
        success: false,
        error: error.error || 'Failed to start passkey authentication',
      };
    }

    const { options } = await beginResponse.json();

    // Start WebAuthn authentication
    const authenticationResponse = await startAuthentication(options);

    // Complete authentication
    const finishResponse = await fetch('/api/partner/auth/passkey/authenticate-finish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        response: authenticationResponse,
      }),
    });

    if (!finishResponse.ok) {
      const error = await finishResponse.json();
      return {
        success: false,
        error: error.error || 'Failed to complete passkey authentication',
      };
    }

    const result = await finishResponse.json();

    // Store token in localStorage (same as regular login)
    if (result.token) {
      localStorage.setItem('partner_token', result.token);
    }

    return {
      success: true,
      redirectUrl: result.requirePasswordChange ? '/partner/change-password' : '/partner/dashboard',
      user: {
        id: result.partnerId,
        name: result.name,
        email: email,
      },
      authenticatedWith: result.authenticatedWith,
      deviceName: result.deviceName,
      mfaWarning: result.mfaWarning,
    };

  } catch (error) {
    logger.error('Passkey authentication error', error as Error, {
      operation: 'passkey_client'
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed',
    };
  }
}

/**
 * Register a new passkey for customer
 */
export async function registerCustomerPasskey(
  userDisplayName?: string,
  deviceName?: string
): Promise<PasskeyRegistrationResult> {
  try {
    // Check browser support
    if (!browserSupportsWebAuthn()) {
      return {
        success: false,
        error: 'Passkeys are not supported in this browser',
      };
    }

    // Start registration process
    const beginResponse = await fetch('/api/whitelabel/auth/passkey/register-begin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userDisplayName }),
    });

    if (!beginResponse.ok) {
      const error = await beginResponse.json();
      return {
        success: false,
        error: error.error || 'Failed to start passkey registration',
      };
    }

    const { options } = await beginResponse.json();

    // Start WebAuthn registration
    const registrationResponse = await startRegistration(options);

    // Complete registration
    const finishResponse = await fetch('/api/whitelabel/auth/passkey/register-finish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        response: registrationResponse,
        deviceName,
      }),
    });

    if (!finishResponse.ok) {
      const error = await finishResponse.json();
      return {
        success: false,
        error: error.error || 'Failed to complete passkey registration',
      };
    }

    const result = await finishResponse.json();
    return {
      success: true,
      credential: result.credential,
    };

  } catch (error) {
    logger.error('Customer passkey registration error', error as Error, {
      operation: 'passkey_client'
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed',
    };
  }
}

/**
 * Authenticate with passkey for customer
 */
export async function authenticateCustomerWithPasskey(
  email: string
): Promise<PasskeyAuthenticationResult> {
  try {
    // Check browser support
    if (!browserSupportsWebAuthn()) {
      return {
        success: false,
        error: 'Passkeys are not supported in this browser',
      };
    }

    // Start authentication process
    const beginResponse = await fetch('/api/whitelabel/auth/passkey/authenticate-begin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!beginResponse.ok) {
      const error = await beginResponse.json();
      return {
        success: false,
        error: error.error || 'Failed to start passkey authentication',
      };
    }

    const { options } = await beginResponse.json();

    // Start WebAuthn authentication
    const authenticationResponse = await startAuthentication(options);

    // Complete authentication
    const finishResponse = await fetch('/api/whitelabel/auth/passkey/authenticate-finish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        response: authenticationResponse,
      }),
    });

    if (!finishResponse.ok) {
      const error = await finishResponse.json();
      return {
        success: false,
        error: error.error || 'Failed to complete passkey authentication',
      };
    }

    const result = await finishResponse.json();

    // Token is automatically stored in httpOnly cookies by the server
    // No need to store in localStorage for security

    return {
      success: true,
      redirectUrl: result.redirectUrl,
      user: result.customer,
      authenticatedWith: result.authenticatedWith,
      deviceName: result.deviceName,
      mfaWarning: result.mfaWarning,
    };

  } catch (error) {
    logger.error('Customer passkey authentication error', error as Error, {
      operation: 'passkey_client'
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed',
    };
  }
}

/**
 * Get user's passkey credentials
 */
export async function getPasskeyCredentials(isCustomer: boolean = false) {
  try {
    const endpoint = isCustomer 
      ? '/api/whitelabel/auth/passkey/credentials'
      : '/api/partner/auth/passkey/credentials';

    const response = await fetch(endpoint);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch credentials');
    }

    return await response.json();
  } catch (error) {
    logger.error('Get passkey credentials error', error as Error, {
      operation: 'passkey_client'
    });
    throw error;
  }
}

/**
 * Remove a passkey credential
 */
export async function removePasskeyCredential(credentialId: string, isCustomer: boolean = false) {
  try {
    const endpoint = isCustomer 
      ? `/api/whitelabel/auth/passkey/credentials/${credentialId}`
      : `/api/partner/auth/passkey/credentials/${credentialId}`;

    const response = await fetch(endpoint, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to remove credential');
    }

    return await response.json();
  } catch (error) {
    logger.error('Remove passkey credential error', error as Error, {
      operation: 'passkey_client'
    });
    throw error;
  }
}
