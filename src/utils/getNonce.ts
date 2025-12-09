import * as crypto from 'crypto';

/**
 * Generates a cryptographically secure random nonce for Content Security Policy.
 * Each webview instance should get a unique nonce to allow only specific inline scripts.
 * @returns A base64-encoded random string
 */
export function getNonce(): string {
  return crypto.randomBytes(32).toString('base64');
}
