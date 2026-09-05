class AIService {
  private baseUrl = '/api/ai';

  async getDiagnosisSuggestions(symptoms: string[], patientHistory: any): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/diagnosis/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symptoms, patientHistory }),
      });
      if (!response.ok) throw new Error('Failed to get suggestions');
      const data = await response.json();
      return data.suggestions;
    } catch (error) {
      console.error('AI diagnosis suggestion failed:', error);
      return [];
    }
  }

  async getTreatmentRecommendations(diagnosis: string, patientData: any): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/treatment/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagnosis, patientData }),
      });
      if (!response.ok) throw new Error('Failed to get recommendations');
      const data = await response.json();
      return data.recommendations;
    } catch (error) {
      console.error('AI treatment recommendation failed:', error);
      return [];
    }
  }

  async generatePatientSummary(patientId: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/summary/${patientId}`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to generate summary');
      const data = await response.json();
      return data.summary;
    } catch (error) {
      console.error('AI summary generation failed:', error);
      return '';
    }
  }

  async assessRisk(patientData: any, conditions: string[]): Promise<{ riskLevel: string; factors: string[] }> {
    try {
      const response = await fetch(`${this.baseUrl}/risk/assess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientData, conditions }),
      });
      if (!response.ok) throw new Error('Failed to assess risk');
      return await response.json();
    } catch (error) {
      console.error('AI risk assessment failed:', error);
      return { riskLevel: 'unknown', factors: [] };
    }
  }

  async naturalLanguageQuery(query: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (!response.ok) throw new Error('Query failed');
      return await response.json();
    } catch (error) {
      console.error('AI query failed:', error);
      return null;
    }
  }
}

export const aiService = new AIService();
