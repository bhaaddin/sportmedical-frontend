// Password hashing utility (SHA-256 via Web Crypto API)
// For production, use bcrypt/argon2 on backend

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

export interface PasswordStrength {
  score: number;
  label: string;
  color: string;
  suggestions: string[];
}

export function checkPasswordStrength(password: string): PasswordStrength {
  let score = 0;
  const suggestions: string[] = [];

  if (password.length >= 8) score++;
  else suggestions.push('Použijte alespoň 8 znaků');

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  else suggestions.push('Použijte velká i malá písmena');

  if (/[0-9]/.test(password)) score++;
  else suggestions.push('Přidejte číslice');

  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
  else suggestions.push('Přidejte speciální znaky');

  const labels = ['Velmi slabé', 'Slabé', 'Střední', 'Silné', 'Velmi silné'];
  const colors = ['#F44336', '#FF9800', '#FFC107', '#4CAF50', '#2E7D32'];

  return {
    score,
    label: labels[score],
    color: colors[score],
    suggestions,
  };
}

export function generatePassword(length: number = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    password += chars[array[i] % chars.length];
  }
  return password;
}

export function maskPassword(password: string): string {
  return password.replace(/./g, '*');
}

export function validatePasswordRequirements(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) errors.push('Minimální délka 8 znaků');
  if (!/[a-z]/.test(password)) errors.push('Alespoň jedno malé písmeno');
  if (!/[A-Z]/.test(password)) errors.push('Alespoň jedno velké písmeno');
  if (!/[0-9]/.test(password)) errors.push('Alespoň jedna číslice');
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('Alespoň jeden speciální znak');

  return { isValid: errors.length === 0, errors };
}
