interface WearableData {
  type: 'fitbit' | 'garmin' | 'apple' | 'samsung';
  userId: string;
  date: string;
  steps?: number;
  heartRate?: number[];
  sleep?: {
    duration: number;
    quality: number;
    stages: { deep: number; light: number; rem: number };
  };
  activity?: {
    calories: number;
    distance: number;
    activeMinutes: number;
  };
}

class WearableService {
  private baseUrl = '/api/wearables';

  async connectDevice(type: string): Promise<{ authUrl: string } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      if (!response.ok) throw new Error('Failed to initiate connection');
      return await response.json();
    } catch (error) {
      console.error('Failed to connect device:', error);
      return null;
    }
  }

  async getHealthData(userId: string, startDate: string, endDate: string): Promise<WearableData[]> {
    try {
      const response = await fetch(`${this.baseUrl}/data?userId=${userId}&start=${startDate}&end=${endDate}`);
      if (!response.ok) throw new Error('Failed to fetch health data');
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch health data:', error);
      return [];
    }
  }

  async getRealTimeHeartRate(userId: string): Promise<number | null> {
    try {
      const response = await fetch(`${this.baseUrl}/heartrate/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch heart rate');
      const data = await response.json();
      return data.heartRate;
    } catch (error) {
      console.error('Failed to fetch heart rate:', error);
      return null;
    }
  }

  async syncData(userId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/sync/${userId}`, { method: 'POST' });
      return response.ok;
    } catch (error) {
      console.error('Failed to sync wearable data:', error);
      return false;
    }
  }

  async getSleepAnalysis(userId: string, date: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/sleep/${userId}?date=${date}`);
      if (!response.ok) throw new Error('Failed to fetch sleep data');
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch sleep analysis:', error);
      return null;
    }
  }
}

export const wearableService = new WearableService();
