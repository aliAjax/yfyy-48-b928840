import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../index';
import { authHeader, createTestMatter, createTestUser } from '../test/helpers';

describe('matter and guide routes', () => {
  it('lets admins create, update, list and delete matters', async () => {
    const admin = createTestUser('admin');

    const created = await request(app)
      .post('/api/matters')
      .set(authHeader(admin))
      .send({
        code: 'TEST-001',
        name: '测试事项',
        department: '测试部门',
        promiseDays: 3,
      })
      .expect(200);
    expect(created.body.success).toBe(true);

    const updated = await request(app)
      .put(`/api/matters/${created.body.data.id}`)
      .set(authHeader(admin))
      .send({ name: '更新事项', status: 'inactive' })
      .expect(200);
    expect(updated.body.data.name).toBe('更新事项');

    const list = await request(app)
      .get('/api/matters?keyword=更新')
      .set(authHeader(admin))
      .expect(200);
    expect(list.body.total).toBe(1);

    const deleted = await request(app)
      .delete(`/api/matters/${created.body.data.id}`)
      .set(authHeader(admin))
      .expect(200);
    expect(deleted.body.success).toBe(true);
  });

  it('prevents applicants from creating matters', async () => {
    const applicant = createTestUser('applicant');

    const response = await request(app)
      .post('/api/matters')
      .set(authHeader(applicant))
      .send({ code: 'NOPE', name: '无权事项', department: '测试部门', promiseDays: 1 })
      .expect(403);

    expect(response.body.success).toBe(false);
  });

  it('exposes only active matters through guide APIs', async () => {
    const applicant = createTestUser('applicant');
    const active = createTestMatter({ name: '可办事项', department: '指南部门', status: 'active' });
    const inactive = createTestMatter({ name: '停用事项', department: '指南部门', status: 'inactive' });

    const matters = await request(app)
      .get('/api/guide/matters')
      .set(authHeader(applicant))
      .expect(200);

    const names = matters.body.data.map((item: any) => item.name);
    expect(names).toContain(active.name);
    expect(names).not.toContain(inactive.name);

    const detail = await request(app)
      .get(`/api/guide/matters/${active.id}`)
      .set(authHeader(applicant))
      .expect(200);
    expect(detail.body.success).toBe(true);

    const inactiveDetail = await request(app)
      .get(`/api/guide/matters/${inactive.id}`)
      .set(authHeader(applicant))
      .expect(200);
    expect(inactiveDetail.body.success).toBe(false);
  });
});
