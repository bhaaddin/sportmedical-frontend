// CSRF (Cross-Site Request Forgery) protection utilities

export class CSRFProtection {
  private static TOKEN_KEY = 'csrf_token';

  static generateToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  static setToken(token: string): void {
    sessionStorage.setItem(this.TOKEN_KEY, token);
  }

  static getToken(): string {
    let token = sessionStorage.getItem(this.TOKEN_KEY);
    if (!token) {
      token = this.generateToken();
      this.setToken(token);
    }
    return token;
  }

  static clearToken(): void {
    sessionStorage.removeItem(this.TOKEN_KEY);
  }

  static getHeaders(): Record<string, string> {
    return { 'X-CSRF-Token': this.getToken() };
  }

  static validateToken(token: string, storedToken: string): boolean {
    if (token.length !== storedToken.length) return false;
    let result = 0;
    for (let i = 0; i < token.length; i++) {
      result |= token.charCodeAt(i) ^ storedToken.charCodeAt(i);
    }
    return result === 0;
  }
}

export function addCSRFProtection(): void {
  const originalFetch = window.fetch;
  window.fetch = async function (input, init = {}) {
    if (init.method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(init.method.toUpperCase())) {
      init.headers = { ...init.headers, ...CSRFProtection.getHeaders() };
    }
    return originalFetch.call(this, input, init);
  };
}
