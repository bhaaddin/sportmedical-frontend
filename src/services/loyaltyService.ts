interface LoyaltyPoints {
  total: number;
  earned: number;
  redeemed: number;
  pending: number;
}

interface PointTransaction {
  id: string;
  type: 'earned' | 'redeemed' | 'expired' | 'adjusted';
  points: number;
  description: string;
  appointmentId?: string;
  createdAt: string;
}

interface Reward {
  id: string;
  name: string;
  description: string;
  pointsRequired: number;
  category: string;
  image: string;
  available: boolean;
  stock: number;
}

class LoyaltyService {
  private baseUrl = '/api/loyalty';

  async getPointsBalance(customerId: string): Promise<LoyaltyPoints> {
    try {
      const response = await fetch(`${this.baseUrl}/points/${customerId}`);
      if (!response.ok) throw new Error('Failed to fetch points');
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch loyalty points:', error);
      return { total: 0, earned: 0, redeemed: 0, pending: 0 };
    }
  }

  async getTransactions(customerId: string, page = 1, limit = 20): Promise<PointTransaction[]> {
    try {
      const response = await fetch(`${this.baseUrl}/transactions/${customerId}?page=${page}&limit=${limit}`);
      if (!response.ok) throw new Error('Failed to fetch transactions');
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      return [];
    }
  }

  async awardPoints(customerId: string, appointmentId: string, amount: number): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/award`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, appointmentId, amount }),
      });
      return response.ok;
    } catch (error) {
      console.error('Failed to award points:', error);
      return false;
    }
  }

  async redeemPoints(customerId: string, rewardId: number, points: number): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, rewardId, points }),
      });
      return response.ok;
    } catch (error) {
      console.error('Failed to redeem points:', error);
      return false;
    }
  }

  async getRewards(): Promise<Reward[]> {
    try {
      const response = await fetch(`${this.baseUrl}/rewards`);
      if (!response.ok) throw new Error('Failed to fetch rewards');
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch rewards:', error);
      return [];
    }
  }

  async getTier(customerId: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/tier/${customerId}`);
      if (!response.ok) throw new Error('Failed to fetch tier');
      const data = await response.json();
      return data.tier;
    } catch (error) {
      console.error('Failed to fetch tier:', error);
      return 'Bronze';
    }
  }

  calculateAppointmentPoints(amount: number, tier: string): number {
    const multipliers: Record<string, number> = { Bronze: 1, Silver: 1.5, Gold: 2, Platinum: 2.5 };
    return Math.floor(amount * (multipliers[tier] || 1) / 100);
  }
}

export const loyaltyService = new LoyaltyService();
