import { describe, it, expect, vi, beforeEach } from 'vitest';

const get = vi.fn();
const post = vi.fn();
vi.mock('./client', () => ({ default: { get, post } }));

const { onSiteConsentsApi } = await import('./onSiteConsents');

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe('onSiteConsentsApi', () => {
  it('asks the options endpoint with the činnost, or with no parameter at all', async () => {
    get.mockResolvedValue({ data: { activityId: 'a', options: [{ code: 'treatment', label: 'x', required: true }] } });
    const res = await onSiteConsentsApi.getOptions('a');
    expect(get).toHaveBeenCalledWith('/api/patients/consents/on-site/options', { params: { activityId: 'a' } });
    expect(res.options).toHaveLength(1);
    await onSiteConsentsApi.getOptions(null);
    expect(get).toHaveBeenLastCalledWith('/api/patients/consents/on-site/options', { params: undefined });
  });

  it('posts the record body to the patient and tolerates missing arrays', async () => {
    post.mockResolvedValue({ data: { patientId: 'p1' } });
    const res = await onSiteConsentsApi.record('p1', { activityId: null, consents: ['treatment'], note: null });
    expect(post).toHaveBeenCalledWith('/api/patients/p1/consents/on-site', {
      activityId: null, consents: ['treatment'], note: null,
    });
    expect(res).toEqual({ patientId: 'p1', recorded: [], alreadyOnFile: [], missingConsents: [], paperwork: null });
  });
});
