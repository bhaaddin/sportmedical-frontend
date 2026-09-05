// PII (Personally Identifiable Information) masking utilities

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}${'*'.repeat(local.length - 2)}@${domain}`;
}

export function maskPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 6) return phone;
  return `${cleaned.slice(0, 3)}***${cleaned.slice(-3)}`;
}

export function maskName(name: string): string {
  if (name.length <= 1) return name;
  return `${name[0]}${'*'.repeat(name.length - 1)}`;
}

export function maskRodneCislo(rc: string): string {
  const cleaned = rc.replace(/\//g, '');
  if (cleaned.length < 6) return rc;
  return `${cleaned.slice(0, 3)}/${cleaned.slice(3, 5)}***`;
}

export function maskInsuranceNumber(number: string): string {
  const cleaned = number.replace(/\s/g, '');
  if (cleaned.length < 6) return number;
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ***`;
}

export function maskAddress(address: string): string {
  const parts = address.split(',');
  if (parts.length <= 1) return '***';
  return `${parts[0].trim().slice(0, 3)}..., ${parts.slice(1).join(',').trim()}`;
}

export function maskCreditCard(cardNumber: string): string {
  const cleaned = cardNumber.replace(/\D/g, '');
  if (cleaned.length < 13) return cardNumber;
  return `****-****-****-${cleaned.slice(-4)}`;
}

export function maskSensitiveData<T extends Record<string, any>>(
  data: T,
  fieldsToMask: string[]
): T {
  const masked = { ...data };
  for (const field of fieldsToMask) {
    if (masked[field]) {
      const value = String(masked[field]);
      if (field.includes('email')) masked[field] = maskEmail(value);
      else if (field.includes('phone')) masked[field] = maskPhone(value);
      else if (field.includes('name') && !field.includes('userName')) masked[field] = maskName(value);
      else masked[field] = maskName(value);
    }
  }
  return masked;
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}
