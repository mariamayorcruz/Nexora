import jwt from 'jsonwebtoken';

function requireJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return secret;
}

export function signUserToken(payload: { userId: string; email?: string }) {
  return jwt.sign(payload, requireJwtSecret(), { expiresIn: '7d' });
}

export function verifyUserToken(token: string): { userId: string; email?: string } | null {
  try {
    return jwt.verify(token, requireJwtSecret()) as { userId: string; email?: string };
  } catch {
    return null;
  }
}

export function getBearerToken(authHeader?: string | null) {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.substring(7);
}
