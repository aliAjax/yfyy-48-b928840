import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../index';
import { authHeader, createTestMatter, createTestUser } from '../test/helpers';
import { toJSON } from '../utils/helpers';

describe('application flow routes', () => {
  it('supports applicant creation and submit, then window acceptance', async () => {
    const applicant = createTestUser('applicant');
    const windowUser = createTestUser('window');
    const matter = createTestMatter();

    const created = await request(app)
      .post('/api/applications')
      .set(authHeader(applicant))
      .send({
        matterId: matter.id,
        basicInfo: toJSON({ name: '申请人', phone: '13800000000' }),
        materials: toJSON([{ name: '申请表', checked: true }]),
      })
      .expect(200);
    expect(created.body.success).toBe(true);
    expect(created.body.data.status).toBe('draft');

    const submitted = await request(app)
      .post(`/api/applications/${created.body.data.id}/submit`)
      .set(authHeader(applicant))
      .expect(200);
    expect(submitted.body.data.status).toBe('submitted');

    const accepted = await request(app)
      .post(`/api/applications/${created.body.data.id}/accept`)
      .set(authHeader(windowUser))
      .expect(200);
    expect(accepted.body.data.status).toBe('accepted');
    expect(accepted.body.data.windowUserId).toBe(windowUser.id);
  });

  it('keeps applicants scoped to their own applications', async () => {
    const owner = createTestUser('applicant');
    const other = createTestUser('applicant');
    const matter = createTestMatter();

    const created = await request(app)
      .post('/api/applications')
      .set(authHeader(owner))
      .send({
        matterId: matter.id,
        basicInfo: '{}',
        materials: '[]',
      })
      .expect(200);

    const ownerList = await request(app)
      .get('/api/applications')
      .set(authHeader(owner))
      .expect(200);
    expect(ownerList.body.data.map((item: any) => item.id)).toContain(created.body.data.id);

    const otherList = await request(app)
      .get('/api/applications')
      .set(authHeader(other))
      .expect(200);
    expect(otherList.body.data.map((item: any) => item.id)).not.toContain(created.body.data.id);
  });
});
