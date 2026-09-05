interface PaymentIntent {
  amount: number;
  currency: string;
  customerId?: string;
  description?: string;
  metadata?: Record<string, string>;
}

interface PaymentResult {
  success: boolean;
  paymentIntentId?: string;
  error?: string;
}

export const paymentService = {
  createPaymentIntent: async (data: PaymentIntent): Promise<PaymentResult> => {
    try {
      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create payment intent');
      const { clientSecret } = await response.json();
      return { success: true, paymentIntentId: clientSecret };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },

  processPayment: async (paymentMethodId: string, amount: number, currency = 'czk'): Promise<PaymentResult> => {
    try {
      const response = await fetch('/api/payments/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodId, amount, currency }),
      });
      if (!response.ok) throw new Error('Payment processing failed');
      const result = await response.json();
      return { success: true, paymentIntentId: result.paymentIntentId };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },

  refundPayment: async (paymentIntentId: string, amount?: number): Promise<PaymentResult> => {
    try {
      const response = await fetch('/api/payments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId, amount }),
      });
      if (!response.ok) throw new Error('Refund failed');
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },

  getPaymentHistory: async (customerId: string): Promise<any[]> => {
    try {
      const response = await fetch(`/api/payments/history/${customerId}`);
      if (!response.ok) throw new Error('Failed to fetch payment history');
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch payment history:', error);
      return [];
    }
  },
};
