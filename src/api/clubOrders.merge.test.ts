/*
 * Etapa 12: "Sloučit do jedné objednávky" — the merge call of the club-orders API module: its body, its answer
 * (the root with the merged orders as addenda) and the 409 that names an order.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('./client', () => ({ default: { get: vi.fn(), post, put: vi.fn() }, client: { get: vi.fn(), post, put: vi.fn() } }));

const { clubOrdersApi, ClubOrderError } = await import('./clubOrders');

beforeEach(() => {
  post.mockReset();
});

describe('clubOrdersApi.merge', () => {
  it('posts the order ids to the root and reads the root back with its addenda', async () => {
    post.mockResolvedValue({
      status: 200,
      data: { id: 'root', parentOrderId: null, groupId: 'root', addenda: [{ id: 'a1', serviceName: 'Sportovní diagnostika', status: 'Confirmed', totalSeats: 16, registered: 0, totalCzk: 8000 }] },
    });
    const root = await clubOrdersApi.merge('root', ['a1']);
    expect(post).toHaveBeenCalledWith('/api/v1/club-orders/root/merge', { orderIds: ['a1'] });
    expect(root.id).toBe('root');
    expect(root.addenda.map((a) => a.id)).toEqual(['a1']);
  });

  it('accepts the wrapped answer too', async () => {
    post.mockResolvedValue({ status: 200, data: { success: true, data: { id: 'root', addenda: [] } } });
    expect((await clubOrdersApi.merge('root', ['a1', 'a2'])).id).toBe('root');
    expect(post).toHaveBeenCalledWith('/api/v1/club-orders/root/merge', { orderIds: ['a1', 'a2'] });
  });

  it('keeps the code, the Czech message and the named order of a 409', async () => {
    post.mockRejectedValue({ response: { status: 409, data: { code: 'club_order.merge_invoiced', message: 'Objednávka už je vyfakturovaná, sloučit ji nelze.', orderId: 'a1' } } });
    const e = (await clubOrdersApi.merge('root', ['a1']).catch((x: unknown) => x)) as InstanceType<typeof ClubOrderError>;
    expect(e).toBeInstanceOf(ClubOrderError);
    expect([e.status, e.code, e.message, e.orderId]).toEqual([409, 'club_order.merge_invoiced', 'Objednávka už je vyfakturovaná, sloučit ji nelze.', 'a1']);
  });

  it('a 404 for a missing root has no named order', async () => {
    post.mockRejectedValue({ response: { status: 404, data: { message: 'Objednávka nenalezena.' } } });
    const e = (await clubOrdersApi.merge('nope', ['a1']).catch((x: unknown) => x)) as InstanceType<typeof ClubOrderError>;
    expect(e.status).toBe(404);
    expect(e.orderId).toBeNull();
  });
});
