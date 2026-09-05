/* ══════════════════════════════════════════════════════════════
   SECURITY — Data hashing and encryption utilities
   Client-side hashing for sensitive fields before sending to API.
   Uses Web Crypto API for SHA-256 hashing.
   ══════════════════════════════════════════════════════════════ */

/**
 * SHA-256 hash using Web Crypto API
 */
export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Simple reversible obfuscation for non-critical data display
 * (NOT true encryption — use only for display masking)
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local.slice(-1)}@${domain}`;
}

export function maskPhone(phone: string): string {
  if (!phone || phone.length < 6) return phone;
  return phone.slice(0, 3) + '***' + phone.slice(-3);
}

/**
 * Validate password strength
 * Returns: { valid, score, message }
 */
export function validatePassword(password: string): { valid: boolean; score: number; message: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score < 3) return { valid: false, score, message: 'Slabé heslo — použijte alespoň 8 znaků s písmeny a číslicemi' };
  if (score < 5) return { valid: true, score, message: 'Přijatelné heslo' };
  return { valid: true, score, message: 'Silné heslo' };
}
