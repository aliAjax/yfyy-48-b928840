import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../index';
import { authHeader, createTestUser } from '../test/helpers';

describe('user routes', () => {
  it('logs in and returns the current user without password', async () => {
    const user = createTestUser('admin', { username: 'admin', password: 'admin123', name: '管理员' });

    const login = await request(app)
      .post('/api/users/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);

    expect(login.body.success).toBe(true);
    expect(login.body.data.token).toBeTruthy();
    expect(login.body.data.user.password).toBeUndefined();

    const me = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${login.body.data.token}`)
      .expect(200);

    expect(me.body.data.id).toBe(user.id);
    expect(me.body.data.password).toBeUndefined();
  });

  it('registers applicants and rejects duplicate usernames', async () => {
    const payload = { username: 'applicant', password: '123456', name: '申请人' };

    const created = await request(app).post('/api/users/register').send(payload).expect(200);
    expect(created.body.success).toBe(true);
    expect(created.body.data.user.role).toBe('applicant');

    const duplicate = await request(app).post('/api/users/register').send(payload).expect(200);
    expect(duplicate.body.success).toBe(false);
  });

  it('restricts user management to admins', async () => {
    const admin = createTestUser('admin');
    const applicant = createTestUser('applicant');

    const forbidden = await request(app)
      .get('/api/users')
      .set(authHeader(applicant))
      .expect(403);
    expect(forbidden.body.success).toBe(false);

    const users = await request(app)
      .get('/api/users')
      .set(authHeader(admin))
      .expect(200);
    expect(users.body.success).toBe(true);
    expect(users.body.data.length).toBeGreaterThanOrEqual(2);
    expect(users.body.data[0].password).toBeUndefined();
  });
});
