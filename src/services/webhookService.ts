interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  createdAt: string;
}

class WebhookService {
  private baseUrl = '/api/webhooks';

  async createWebhook(webhook: Omit<Webhook, 'id' | 'createdAt'>): Promise<Webhook> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhook),
    });
    if (!response.ok) throw new Error('Failed to create webhook');
    return await response.json();
  }

  async listWebhooks(): Promise<Webhook[]> {
    const response = await fetch(this.baseUrl);
    if (!response.ok) throw new Error('Failed to list webhooks');
    return await response.json();
  }

  async updateWebhook(id: string, updates: Partial<Webhook>): Promise<Webhook> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update webhook');
    return await response.json();
  }

  async deleteWebhook(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete webhook');
  }

  async testWebhook(id: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/${id}/test`, { method: 'POST' });
    return response.ok;
  }

  async getWebhookLogs(id: string): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/${id}/logs`);
    if (!response.ok) throw new Error('Failed to fetch webhook logs');
    return await response.json();
  }
}

export const webhookService = new WebhookService();
