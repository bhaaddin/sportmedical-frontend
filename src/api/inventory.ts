import client from './client';

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  minQuantity: number;
  unit: string;
  lastRestockedAt?: string;
  expiresAt?: string;
  location: string;
  notes?: string;
}

export interface CreateInventoryRequest {
  name: string;
  category: string;
  quantity: number;
  minQuantity: number;
  unit: string;
  location: string;
  expiresAt?: string;
  notes?: string;
}

export const inventoryApi = {
  getAll: async (): Promise<InventoryItem[]> => {
    const res = await client.get('/api/inventory');
    return res.data?.value ?? res.data ?? [];
  },

  getById: async (id: string): Promise<InventoryItem> => {
    const res = await client.get(`/api/inventory/${id}`);
    return res.data?.value ?? res.data;
  },

  create: async (data: CreateInventoryRequest): Promise<InventoryItem> => {
    const res = await client.post('/api/inventory', data);
    return res.data?.value ?? res.data;
  },

  update: async (id: string, data: Partial<CreateInventoryRequest>): Promise<InventoryItem> => {
    const res = await client.put(`/api/inventory/${id}`, data);
    return res.data?.value ?? res.data;
  },

  restock: async (id: string, quantity: number): Promise<InventoryItem> => {
    const res = await client.patch(`/api/inventory/${id}/restock`, { quantity });
    return res.data?.value ?? res.data;
  },

  getLowStock: async (): Promise<InventoryItem[]> => {
    const res = await client.get('/api/inventory/low-stock');
    return res.data?.value ?? res.data ?? [];
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/api/inventory/${id}`);
  },
};
