interface ReferralStats {
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalRewards: number;
  referralCode: string;
  referralLink: string;
}

class ReferralService {
  private baseUrl = '/api/referrals';

  async getStats(customerId: string): Promise<ReferralStats> {
    try {
      const response = await fetch(`${this.baseUrl}/stats/${customerId}`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch referral stats:', error);
      return { totalReferrals: 0, completedReferrals: 0, pendingReferrals: 0, totalRewards: 0, referralCode: '', referralLink: '' };
    }
  }

  async getReferrals(customerId: string): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/${customerId}`);
      if (!response.ok) throw new Error('Failed to fetch referrals');
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch referrals:', error);
      return [];
    }
  }

  async sendReferral(referrerId: string, email: string, name?: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referrerId, email, name }),
      });
      return response.ok;
    } catch (error) {
      console.error('Failed to send referral:', error);
      return false;
    }
  }

  async applyReferralCode(code: string, newCustomerId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, newCustomerId }),
      });
      return response.ok;
    } catch (error) {
      console.error('Failed to apply referral code:', error);
      return false;
    }
  }

  generateReferralLink(referralCode: string): string {
    return `${window.location.origin}/register?ref=${referralCode}`;
  }

  async copyReferralLink(referralCode: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(this.generateReferralLink(referralCode));
      return true;
    } catch (error) {
      console.error('Failed to copy link:', error);
      return false;
    }
  }

  async shareReferral(referralCode: string, method: 'email' | 'whatsapp' | 'facebook' | 'twitter'): Promise<boolean> {
    const link = this.generateReferralLink(referralCode);
    const text = 'Přidejte se ke CGM MEDISTAR a získejte bonusové body!';
    const urls: Record<string, string> = {
      email: `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(link)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(text + ' ' + link)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`,
    };
    window.open(urls[method]);
    return true;
  }
}

export const referralService = new ReferralService();
