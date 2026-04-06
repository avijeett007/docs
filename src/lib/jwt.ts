// TextEncoder and TextDecoder are available globally in modern browsers and Edge Runtime
const secret = process.env.JWT_SECRET;

if (!secret) {
  throw new Error('JWT_SECRET environment variable is required');
}

// Type-safe secret for use in functions
const jwtSecret: string = secret;

export interface JWTPayload {
  partnerId: string;
  email: string;
  hasChangedPassword?: boolean;
  teamMemberId?: string;
  role?: string;
  isTeamMember?: boolean;
  iat?: number;
  exp?: number;
}

async function base64UrlEncode(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  return btoa(String.fromCharCode(...new Uint8Array(data)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function base64UrlDecode(str: string): Promise<string> {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const decoded = atob(str);
  const decoder = new TextDecoder();
  const data = new Uint8Array(decoded.split('').map(c => c.charCodeAt(0)));
  return decoder.decode(data);
}

async function hmacSign(data: string, key: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
}

async function hmacVerify(signature: string, data: string, key: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signatureData = new Uint8Array(
    atob(signature.replace(/-/g, '+').replace(/_/g, '/'))
      .split('')
      .map(c => c.charCodeAt(0))
  );

  return crypto.subtle.verify(
    'HMAC',
    cryptoKey,
    signatureData,
    encoder.encode(data)
  );
}

export async function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + (24 * 60 * 60) // 24 hours
  };

  const headerStr = await base64UrlEncode(JSON.stringify(header));
  const payloadStr = await base64UrlEncode(JSON.stringify(fullPayload));
  const dataToSign = `${headerStr}.${payloadStr}`;

  const signature = await hmacSign(dataToSign, jwtSecret);
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${dataToSign}.${signatureBase64}`;
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) {
      throw new Error('Invalid token format');
    }

    // Verify signature
    const dataToVerify = `${headerB64}.${payloadB64}`;
    const isValid = await hmacVerify(signatureB64, dataToVerify, jwtSecret);

    if (!isValid) {
      throw new Error('Invalid signature');
    }

    // Decode payload
    const payloadStr = await base64UrlDecode(payloadB64);
    const payload = JSON.parse(payloadStr);

    // Verify expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new Error('Token expired');
    }

    // Type check the payload
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'partnerId' in payload &&
      'email' in payload &&
      typeof payload.partnerId === 'string' &&
      typeof payload.email === 'string'
    ) {
      // Create the base payload
      const jwtPayload: JWTPayload = {
        partnerId: payload.partnerId,
        email: payload.email,
        iat: payload.iat,
        exp: payload.exp
      };

      // Add optional fields if they exist
      if ('hasChangedPassword' in payload) {
        jwtPayload.hasChangedPassword = Boolean(payload.hasChangedPassword);
      }

      if ('teamMemberId' in payload) {
        jwtPayload.teamMemberId = String(payload.teamMemberId);
      }

      if ('role' in payload) {
        jwtPayload.role = String(payload.role);
      }

      if ('isTeamMember' in payload) {
        jwtPayload.isTeamMember = Boolean(payload.isTeamMember);
      }

      return jwtPayload;
    }
    return null;
  } catch (error) {
    return null;
  }
}
