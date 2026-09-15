import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const PREFIX = 'enc:v1:';

function getKey(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!raw) return null;
  return createHash('sha256').update(raw, 'utf-8').digest();
}

export function isEncryptedSecret(value?: string | null): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/** Encrypts a provider access token with AES-256-GCM. Returns the value as-is when no key is configured. */
export function encryptSecret(value?: string | null): string | null {
  if (!value) return value ?? null;
  if (isEncryptedSecret(value)) return value;

  const key = getKey();
  if (!key) return value;

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

/** Decrypts a value produced by encryptSecret. Plain-text legacy values pass through unchanged. */
export function decryptSecret(value?: string | null): string | null {
  if (!value) return value ?? null;
  if (!isEncryptedSecret(value)) return value;

  const key = getKey();
  if (!key) return null;

  try {
    const [ivPart, tagPart, dataPart] = value.slice(PREFIX.length).split('.');
    if (!ivPart || !tagPart || !dataPart) return null;

    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivPart, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataPart, 'base64url')),
      decipher.final(),
    ]);

    return decrypted.toString('utf-8');
  } catch (error) {
    console.error('Secret decryption failed', { error });
    return null;
  }
}

/** Safe representation for API responses: never returns the raw secret. */
export function maskSecret(value?: string | null): string | null {
  const plain = decryptSecret(value);
  if (!plain) return null;
  if (plain.length <= 6) return '••••••';
  return `••••••${plain.slice(-4)}`;
}
