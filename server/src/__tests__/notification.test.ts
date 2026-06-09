import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../index';
import { authHeader, createTestNotification, createTestUser } from '../test/helpers';

describe('notification routes', () => {
  it('lists unread notifications and marks them as read', async () => {
    const user = createTestUser('applicant');
    const otherUser = createTestUser('applicant');
    const notification = createTestNotification(user);
    createTestNotification(user, { title: '第二条' });
    createTestNotification(otherUser, { title: '其他用户通知' });

    const unread = await request(app)
      .get('/api/notifications/unread-count')
      .set(authHeader(user))
      .expect(200);
    expect(unread.body.data.count).toBe(2);

    const list = await request(app)
      .get('/api/notifications?isRead=false')
      .set(authHeader(user))
      .expect(200);
    expect(list.body.total).toBe(2);

    const marked = await request(app)
      .put(`/api/notifications/${notification.id}/read`)
      .set(authHeader(user))
      .expect(200);
    expect(marked.body.success).toBe(true);

    const afterOne = await request(app)
      .get('/api/notifications/unread-count')
      .set(authHeader(user))
      .expect(200);
    expect(afterOne.body.data.count).toBe(1);

    const markedAll = await request(app)
      .put('/api/notifications/read-all')
      .set(authHeader(user))
      .expect(200);
    expect(markedAll.body.data.count).toBe(1);
  });
});
