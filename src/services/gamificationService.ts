interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  points: number;
  unlockedAt?: string;
  progress: number;
  maxProgress: number;
}

interface Challenge {
  id: string;
  name: string;
  description: string;
  type: 'daily' | 'weekly' | 'monthly';
  target: number;
  current: number;
  reward: number;
  expiresAt: string;
}

class GamificationService {
  private baseUrl = '/api/gamification';

  async getAchievements(customerId: string): Promise<Achievement[]> {
    try {
      const response = await fetch(`${this.baseUrl}/achievements/${customerId}`);
      if (!response.ok) throw new Error('Failed to fetch achievements');
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch achievements:', error);
      return [];
    }
  }

  async getChallenges(customerId: string): Promise<Challenge[]> {
    try {
      const response = await fetch(`${this.baseUrl}/challenges/${customerId}`);
      if (!response.ok) throw new Error('Failed to fetch challenges');
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch challenges:', error);
      return [];
    }
  }

  async updateProgress(customerId: string, challengeId: string, progress: number): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, challengeId, progress }),
      });
      return response.ok;
    } catch (error) {
      console.error('Failed to update progress:', error);
      return false;
    }
  }

  async claimReward(customerId: string, challengeId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, challengeId }),
      });
      return response.ok;
    } catch (error) {
      console.error('Failed to claim reward:', error);
      return false;
    }
  }

  async getLeaderboard(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/leaderboard`);
      if (!response.ok) throw new Error('Failed to fetch leaderboard');
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
      return [];
    }
  }

  async getUserRank(customerId: string): Promise<number> {
    try {
      const response = await fetch(`${this.baseUrl}/rank/${customerId}`);
      if (!response.ok) throw new Error('Failed to fetch rank');
      const data = await response.json();
      return data.rank;
    } catch (error) {
      console.error('Failed to fetch rank:', error);
      return 0;
    }
  }
}

export const gamificationService = new GamificationService();
