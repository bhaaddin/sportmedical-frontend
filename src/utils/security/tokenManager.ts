// JWT token management utilities

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export class TokenManager {
  private static ACCESS_TOKEN_KEY = 'accessToken';
  private static REFRESH_TOKEN_KEY = 'refreshToken';

  static setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
  }

  static getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  static getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  static clearTokens(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
  }

  static decodeToken(token: string): TokenPayload | null {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  }

  static isTokenExpired(token: string): boolean {
    const payload = this.decodeToken(token);
    if (!payload) return true;
    return payload.exp * 1000 < Date.now();
  }

  static getTokenExpiration(token: string): Date | null {
    const payload = this.decodeToken(token);
    if (!payload) return null;
    return new Date(payload.exp * 1000);
  }

  static needsRefresh(token: string): boolean {
    const payload = this.decodeToken(token);
    if (!payload) return true;
    const fiveMinutes = 5 * 60 * 1000;
    return payload.exp * 1000 - Date.now() < fiveMinutes;
  }

  static getUserFromToken(token: string): Omit<TokenPayload, 'iat' | 'exp'> | null {
    const payload = this.decodeToken(token);
    if (!payload) return null;
    return { sub: payload.sub, email: payload.email, role: payload.role };
  }

  static hasRole(token: string, requiredRole: string): boolean {
    const user = this.getUserFromToken(token);
    if (!user) return false;
    return user.role === requiredRole;
  }

  static hasAnyRole(token: string, requiredRoles: string[]): boolean {
    const user = this.getUserFromToken(token);
    if (!user) return false;
    return requiredRoles.includes(user.role);
  }
}
