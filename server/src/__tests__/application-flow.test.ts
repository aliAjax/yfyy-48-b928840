import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index';
import {
  createTestUser,
  createTestMatter,
  getApplicationById,
  getLogsByApplication,
  getNotificationsByApplication,
  getNotificationsByUser,
  TestUser,
} from '../test/helpers';
import { ApplicationStatus, Matter } from '../types';

describe('申请办理流程状态流转测试', () => {
  let applicant: TestUser;
  let windowUser: TestUser;
  let reviewer: TestUser;
  let matter: Matter;

  beforeEach(() => {
    applicant = createTestUser('test_applicant', 'applicant', '测试申请人');
    windowUser = createTestUser('test_window', 'window', '测试窗口人员');
    reviewer = createTestUser('test_reviewer', 'reviewer', '测试审核人员');
    matter = createTestMatter('TEST001', '测试事项办理');
  });

  async function createDraftApplication(applicantUser: TestUser, matterId: string) {
    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${applicantUser.token}`)
      .send({
        matterId,
        basicInfo: { name: '测试企业', address: '测试地址' },
        materials: [
          { name: '身份证复印件', required: true, checked: true, remark: '已上传' },
          { name: '申请表', required: true, checked: true, remark: '已填写' },
        ],
      });
    expect(res.body.success).toBe(true);
    return res.body.data;
  }

  describe('1. 提交申请 (draft → submitted)', () => {
    it('应正确更新状态为 submitted，currentStep 为待受理，并写入日志和通知', async () => {
      const draft = await createDraftApplication(applicant, matter.id);

      const res = await request(app)
        .post(`/api/applications/${draft.id}/submit`)
        .set('Authorization', `Bearer ${applicant.token}`);

      expect(res.body.success).toBe(true);
      const submittedApp = res.body.data;

      expect(submittedApp.status).toBe('submitted' as ApplicationStatus);
      expect(submittedApp.currentStep).toBe('窗口受理');
      expect(submittedApp.submitTime).toBeTruthy();

      const dbApp = getApplicationById(draft.id)!;
      expect(dbApp.status).toBe('submitted');
      expect(dbApp.currentStep).toBe('窗口受理');
      expect(dbApp.submitTime).toBeTruthy();

      const logs = getLogsByApplication(draft.id);
      const submitLog = logs.find(l => l.action === 'submit');
      expect(submitLog).toBeTruthy();
      expect(submitLog!.oldStatus).toBe('draft');
      expect(submitLog!.newStatus).toBe('submitted');
      expect(submitLog!.userId).toBe(applicant.id);
      expect(submitLog!.description).toContain('提交申请');

      const notifications = getNotificationsByApplication(draft.id);
      const submitNotifs = notifications.filter(n => n.type === 'submit');
      expect(submitNotifs.length).toBeGreaterThan(0);
      const windowNotif = submitNotifs.find(n => n.userId !== applicant.id);
      expect(windowNotif).toBeTruthy();
      expect(windowNotif!.title).toContain('新申请待受理');
    });

    it('非申请人角色不能提交申请', async () => {
      const draft = await createDraftApplication(applicant, matter.id);

      const res = await request(app)
        .post(`/api/applications/${draft.id}/submit`)
        .set('Authorization', `Bearer ${windowUser.token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('2. 窗口受理 (submitted → accepted)', () => {
    async function createSubmittedApplication() {
      const draft = await createDraftApplication(applicant, matter.id);
      const res = await request(app)
        .post(`/api/applications/${draft.id}/submit`)
        .set('Authorization', `Bearer ${applicant.token}`);
      return res.body.data;
    }

    it('应正确更新状态为 accepted，记录受理人和受理时间，并写入日志和通知', async () => {
      const submitted = await createSubmittedApplication();

      const res = await request(app)
        .post(`/api/applications/${submitted.id}/accept`)
        .set('Authorization', `Bearer ${windowUser.token}`);

      expect(res.body.success).toBe(true);
      const acceptedApp = res.body.data;

      expect(acceptedApp.status).toBe('accepted' as ApplicationStatus);
      expect(acceptedApp.currentStep).toBe('材料审核');
      expect(acceptedApp.windowUserId).toBe(windowUser.id);
      expect(acceptedApp.acceptTime).toBeTruthy();

      const dbApp = getApplicationById(submitted.id)!;
      expect(dbApp.status).toBe('accepted');
      expect(dbApp.currentStep).toBe('材料审核');
      expect(dbApp.windowUserId).toBe(windowUser.id);
      expect(dbApp.acceptTime).toBeTruthy();

      const logs = getLogsByApplication(submitted.id);
      const acceptLog = logs.find(l => l.action === 'accept');
      expect(acceptLog).toBeTruthy();
      expect(acceptLog!.oldStatus).toBe('submitted');
      expect(acceptLog!.newStatus).toBe('accepted');
      expect(acceptLog!.userId).toBe(windowUser.id);
      expect(acceptLog!.description).toContain('窗口受理');

      const notifications = getNotificationsByUser(applicant.id);
      const acceptNotif = notifications.find(
        n => n.type === 'accept' && n.applicationId === submitted.id
      );
      expect(acceptNotif).toBeTruthy();
      expect(acceptNotif!.title).toBe('申请已受理');
      expect(acceptNotif!.content).toContain('材料审核');
    });

    it('非 submitted 状态不能受理', async () => {
      const draft = await createDraftApplication(applicant, matter.id);

      const res = await request(app)
        .post(`/api/applications/${draft.id}/accept`)
        .set('Authorization', `Bearer ${windowUser.token}`);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('当前状态不能受理');
    });

    it('非窗口/审核/管理员角色不能受理', async () => {
      const submitted = await createSubmittedApplication();

      const res = await request(app)
        .post(`/api/applications/${submitted.id}/accept`)
        .set('Authorization', `Bearer ${applicant.token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('3. 要求补正 (submitted/accepted → supplement)', () => {
    async function createSubmittedApplication() {
      const draft = await createDraftApplication(applicant, matter.id);
      const res = await request(app)
        .post(`/api/applications/${draft.id}/submit`)
        .set('Authorization', `Bearer ${applicant.token}`);
      return res.body.data;
    }

    async function createAcceptedApplication() {
      const submitted = await createSubmittedApplication();
      const res = await request(app)
        .post(`/api/applications/${submitted.id}/accept`)
        .set('Authorization', `Bearer ${windowUser.token}`);
      return res.body.data;
    }

    it('从 submitted 状态要求补正，应正确流转到 supplement', async () => {
      const submitted = await createSubmittedApplication();
      const supplementReason = '身份证复印件不清晰，请重新上传';

      const res = await request(app)
        .post(`/api/applications/${submitted.id}/supplement`)
        .set('Authorization', `Bearer ${windowUser.token}`)
        .send({ reason: supplementReason });

      expect(res.body.success).toBe(true);
      const supplementApp = res.body.data;

      expect(supplementApp.status).toBe('supplement' as ApplicationStatus);
      expect(supplementApp.currentStep).toBe('待补正');
      expect(supplementApp.supplementReason).toBe(supplementReason);

      const dbApp = getApplicationById(submitted.id)!;
      expect(dbApp.status).toBe('supplement');
      expect(dbApp.currentStep).toBe('待补正');
      expect(dbApp.supplementReason).toBe(supplementReason);

      const logs = getLogsByApplication(submitted.id);
      const supplementLog = logs.find(l => l.action === 'supplement');
      expect(supplementLog).toBeTruthy();
      expect(supplementLog!.oldStatus).toBe('submitted');
      expect(supplementLog!.newStatus).toBe('supplement');
      expect(supplementLog!.description).toContain(supplementReason);

      const notifications = getNotificationsByUser(applicant.id);
      const supplementNotif = notifications.find(
        n => n.type === 'supplement' && n.applicationId === submitted.id
      );
      expect(supplementNotif).toBeTruthy();
      expect(supplementNotif!.title).toBe('申请需补正材料');
      expect(supplementNotif!.content).toContain(supplementReason);
    });

    it('从 accepted 状态要求补正，应正确流转到 supplement', async () => {
      const accepted = await createAcceptedApplication();
      const supplementReason = '申请表填写不完整，请补充信息';

      const res = await request(app)
        .post(`/api/applications/${accepted.id}/supplement`)
        .set('Authorization', `Bearer ${windowUser.token}`)
        .send({ reason: supplementReason });

      expect(res.body.success).toBe(true);
      const supplementApp = res.body.data;

      expect(supplementApp.status).toBe('supplement' as ApplicationStatus);
      expect(supplementApp.currentStep).toBe('待补正');

      const logs = getLogsByApplication(accepted.id);
      const supplementLog = logs.find(l => l.action === 'supplement');
      expect(supplementLog).toBeTruthy();
      expect(supplementLog!.oldStatus).toBe('accepted');
      expect(supplementLog!.newStatus).toBe('supplement');
    });

    it('补正后申请人可重新提交 (supplement → submitted)', async () => {
      const submitted = await createSubmittedApplication();
      await request(app)
        .post(`/api/applications/${submitted.id}/supplement`)
        .set('Authorization', `Bearer ${windowUser.token}`)
        .send({ reason: '需要补正材料' });

      const res = await request(app)
        .post(`/api/applications/${submitted.id}/submit`)
        .set('Authorization', `Bearer ${applicant.token}`);

      expect(res.body.success).toBe(true);
      const resubmittedApp = res.body.data;
      expect(resubmittedApp.status).toBe('submitted' as ApplicationStatus);
      expect(resubmittedApp.currentStep).toBe('窗口受理');

      const logs = getLogsByApplication(submitted.id);
      const resubmitLog = logs.find(l => l.action === 'resubmit');
      expect(resubmitLog).toBeTruthy();
      expect(resubmitLog!.oldStatus).toBe('supplement');
      expect(resubmitLog!.newStatus).toBe('submitted');
      expect(resubmitLog!.description).toContain('重新提交');
    });
  });

  describe('4. 审核通过 (reviewing → approved)', () => {
    async function createReviewingApplication() {
      const draft = await createDraftApplication(applicant, matter.id);
      await request(app)
        .post(`/api/applications/${draft.id}/submit`)
        .set('Authorization', `Bearer ${applicant.token}`);
      await request(app)
        .post(`/api/applications/${draft.id}/accept`)
        .set('Authorization', `Bearer ${windowUser.token}`);
      const sendRes = await request(app)
        .post(`/api/applications/${draft.id}/send-review`)
        .set('Authorization', `Bearer ${windowUser.token}`);
      return sendRes.body.data;
    }

    it('审核通过应正确更新状态为 approved，并写入审核意见、日志和通知', async () => {
      const reviewing = await createReviewingApplication();
      const reviewOpinionText = '材料齐全，符合办理条件，同意通过';

      const res = await request(app)
        .post(`/api/applications/${reviewing.id}/review`)
        .set('Authorization', `Bearer ${reviewer.token}`)
        .send({
          result: 'pass',
          opinion: reviewOpinionText,
          reviewOpinions: [
            { materialName: '身份证复印件', status: 'pass', opinion: '清晰有效' },
            { materialName: '申请表', status: 'pass', opinion: '填写完整' },
          ],
        });

      expect(res.body.success).toBe(true);
      const approvedApp = res.body.data;

      expect(approvedApp.status).toBe('approved' as ApplicationStatus);
      expect(approvedApp.currentStep).toBe('办结出证');
      expect(approvedApp.reviewerUserId).toBe(reviewer.id);
      expect(approvedApp.reviewOpinion).toContain(reviewOpinionText);

      const dbApp = getApplicationById(reviewing.id)!;
      expect(dbApp.status).toBe('approved');
      expect(dbApp.currentStep).toBe('办结出证');
      expect(dbApp.reviewerUserId).toBe(reviewer.id);
      expect(dbApp.reviewOpinion).toContain(reviewOpinionText);

      const logs = getLogsByApplication(reviewing.id);
      const reviewLog = logs.find(l => l.action === 'review' && l.newStatus === 'approved');
      expect(reviewLog).toBeTruthy();
      expect(reviewLog!.oldStatus).toBe('reviewing');
      expect(reviewLog!.newStatus).toBe('approved');
      expect(reviewLog!.userId).toBe(reviewer.id);
      expect(reviewLog!.description).toContain('审核通过');

      const notifications = getNotificationsByApplication(reviewing.id);
      const passNotif = notifications.find(
        n => n.type === 'review_pass' && n.userId === applicant.id
      );
      expect(passNotif).toBeTruthy();
      expect(passNotif!.title).toBe('审核通过');
      expect(passNotif!.content).toContain('已审核通过');
    });

    it('非 reviewing 状态不能进行审核', async () => {
      const draft = await createDraftApplication(applicant, matter.id);

      const res = await request(app)
        .post(`/api/applications/${draft.id}/review`)
        .set('Authorization', `Bearer ${reviewer.token}`)
        .send({ result: 'pass', opinion: '通过' });

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('当前状态不能审核');
    });
  });

  describe('5. 审核不通过 (reviewing → rejected)', () => {
    async function createReviewingApplication() {
      const draft = await createDraftApplication(applicant, matter.id);
      await request(app)
        .post(`/api/applications/${draft.id}/submit`)
        .set('Authorization', `Bearer ${applicant.token}`);
      await request(app)
        .post(`/api/applications/${draft.id}/accept`)
        .set('Authorization', `Bearer ${windowUser.token}`);
      const sendRes = await request(app)
        .post(`/api/applications/${draft.id}/send-review`)
        .set('Authorization', `Bearer ${windowUser.token}`);
      return sendRes.body.data;
    }

    it('审核不通过应正确更新状态为 rejected，记录完成时间，并写入日志和通知', async () => {
      const reviewing = await createReviewingApplication();
      const rejectReason = '申请材料不符合法定形式，不予批准';

      const res = await request(app)
        .post(`/api/applications/${reviewing.id}/review`)
        .set('Authorization', `Bearer ${reviewer.token}`)
        .send({
          result: 'reject',
          opinion: rejectReason,
          reviewOpinions: [
            { materialName: '身份证复印件', status: 'problem', opinion: '已过有效期' },
          ],
        });

      expect(res.body.success).toBe(true);
      const rejectedApp = res.body.data;

      expect(rejectedApp.status).toBe('rejected' as ApplicationStatus);
      expect(rejectedApp.currentStep).toBe('已退回');
      expect(rejectedApp.rejectReason).toContain(rejectReason);
      expect(rejectedApp.reviewerUserId).toBe(reviewer.id);
      expect(rejectedApp.completeTime).toBeTruthy();

      const dbApp = getApplicationById(reviewing.id)!;
      expect(dbApp.status).toBe('rejected');
      expect(dbApp.currentStep).toBe('已退回');
      expect(dbApp.rejectReason).toContain(rejectReason);
      expect(dbApp.completeTime).toBeTruthy();

      const logs = getLogsByApplication(reviewing.id);
      const reviewLog = logs.find(l => l.action === 'review' && l.newStatus === 'rejected');
      expect(reviewLog).toBeTruthy();
      expect(reviewLog!.oldStatus).toBe('reviewing');
      expect(reviewLog!.newStatus).toBe('rejected');
      expect(reviewLog!.userId).toBe(reviewer.id);
      expect(reviewLog!.description).toContain('审核不通过');
      expect(reviewLog!.description).toContain(rejectReason);

      const notifications = getNotificationsByUser(applicant.id);
      const rejectNotif = notifications.find(
        n => n.type === 'review_reject' && n.applicationId === reviewing.id
      );
      expect(rejectNotif).toBeTruthy();
      expect(rejectNotif!.title).toBe('审核不通过');
      expect(rejectNotif!.content).toContain(rejectReason);
    });

    it('审核不通过后应记录完成时间', async () => {
      const reviewing = await createReviewingApplication();

      const res = await request(app)
        .post(`/api/applications/${reviewing.id}/review`)
        .set('Authorization', `Bearer ${reviewer.token}`)
        .send({ result: 'reject', opinion: '不符合条件' });

      expect(res.body.success).toBe(true);
      const dbApp = getApplicationById(reviewing.id)!;
      expect(dbApp.completeTime).toBeTruthy();
      expect(new Date(dbApp.completeTime!).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('6. 修改申请 (PUT /:id)', () => {
    it('draft 状态下申请人可修改申请基本信息和材料', async () => {
      const draft = await createDraftApplication(applicant, matter.id);
      const newBasicInfo = { name: '更新后的企业名称', address: '更新后的地址' };
      const newMaterials = [
        { name: '身份证复印件', required: true, checked: true, remark: '已更新' },
      ];

      const res = await request(app)
        .put(`/api/applications/${draft.id}`)
        .set('Authorization', `Bearer ${applicant.token}`)
        .send({ basicInfo: newBasicInfo, materials: newMaterials });

      expect(res.body.success).toBe(true);
      expect(res.body.data.applicantId).toBe(applicant.id);

      const dbApp = getApplicationById(draft.id)!;
      const parsedBasicInfo = JSON.parse(dbApp.basicInfo);
      const parsedMaterials = JSON.parse(dbApp.materials);
      expect(parsedBasicInfo.name).toBe('更新后的企业名称');
      expect(parsedMaterials.length).toBe(1);
      expect(parsedMaterials[0].remark).toBe('已更新');

      const logs = getLogsByApplication(draft.id);
      const updateLog = logs.find(l => l.action === 'update');
      expect(updateLog).toBeTruthy();
      expect(updateLog!.userId).toBe(applicant.id);
    });

    it('supplement 状态下申请人也可修改申请', async () => {
      const draft = await createDraftApplication(applicant, matter.id);
      await request(app)
        .post(`/api/applications/${draft.id}/submit`)
        .set('Authorization', `Bearer ${applicant.token}`);
      await request(app)
        .post(`/api/applications/${draft.id}/supplement`)
        .set('Authorization', `Bearer ${windowUser.token}`)
        .send({ reason: '需要补正' });

      const res = await request(app)
        .put(`/api/applications/${draft.id}`)
        .set('Authorization', `Bearer ${applicant.token}`)
        .send({ basicInfo: { name: '补正后更新的名称' } });

      expect(res.body.success).toBe(true);
      const dbApp = getApplicationById(draft.id)!;
      expect(JSON.parse(dbApp.basicInfo).name).toBe('补正后更新的名称');
    });

    it('submitted 状态不能修改申请', async () => {
      const draft = await createDraftApplication(applicant, matter.id);
      await request(app)
        .post(`/api/applications/${draft.id}/submit`)
        .set('Authorization', `Bearer ${applicant.token}`);

      const res = await request(app)
        .put(`/api/applications/${draft.id}`)
        .set('Authorization', `Bearer ${applicant.token}`)
        .send({ basicInfo: { name: '尝试修改' } });

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('当前状态不能修改');
    });

    it('非申请人不能修改他人的申请', async () => {
      const draft = await createDraftApplication(applicant, matter.id);

      const otherApplicant = createTestUser('other_applicant', 'applicant', '其他申请人');
      const res = await request(app)
        .put(`/api/applications/${draft.id}`)
        .set('Authorization', `Bearer ${otherApplicant.token}`)
        .send({ basicInfo: { name: '恶意修改' } });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('7. 退回申请 (POST /:id/reject, submitted/accepted/reviewing → rejected)', () => {
    async function createSubmittedApplication() {
      const draft = await createDraftApplication(applicant, matter.id);
      const res = await request(app)
        .post(`/api/applications/${draft.id}/submit`)
        .set('Authorization', `Bearer ${applicant.token}`);
      return res.body.data;
    }

    it('从 submitted 状态退回，应正确更新状态为 rejected', async () => {
      const submitted = await createSubmittedApplication();
      const rejectReason = '材料缺失严重，直接退回';

      const res = await request(app)
        .post(`/api/applications/${submitted.id}/reject`)
        .set('Authorization', `Bearer ${windowUser.token}`)
        .send({ reason: rejectReason });

      expect(res.body.success).toBe(true);
      const rejectedApp = res.body.data;
      expect(rejectedApp.status).toBe('rejected' as ApplicationStatus);
      expect(rejectedApp.currentStep).toBe('已退回');
      expect(rejectedApp.rejectReason).toBe(rejectReason);
      expect(rejectedApp.completeTime).toBeTruthy();

      const dbApp = getApplicationById(submitted.id)!;
      expect(dbApp.status).toBe('rejected');
      expect(dbApp.rejectReason).toBe(rejectReason);
      expect(dbApp.completeTime).toBeTruthy();

      const logs = getLogsByApplication(submitted.id);
      const rejectLog = logs.find(l => l.action === 'reject');
      expect(rejectLog).toBeTruthy();
      expect(rejectLog!.oldStatus).toBe('submitted');
      expect(rejectLog!.newStatus).toBe('rejected');
      expect(rejectLog!.description).toContain(rejectReason);

      const notifications = getNotificationsByUser(applicant.id);
      const rejectNotif = notifications.find(
        n => n.type === 'reject' && n.applicationId === submitted.id
      );
      expect(rejectNotif).toBeTruthy();
      expect(rejectNotif!.title).toBe('申请被退回');
      expect(rejectNotif!.content).toContain(rejectReason);
    });

    it('从 reviewing 状态退回也可通过 reject 路由', async () => {
      const submitted = await createSubmittedApplication();
      await request(app)
        .post(`/api/applications/${submitted.id}/accept`)
        .set('Authorization', `Bearer ${windowUser.token}`);
      await request(app)
        .post(`/api/applications/${submitted.id}/send-review`)
        .set('Authorization', `Bearer ${windowUser.token}`);

      const res = await request(app)
        .post(`/api/applications/${submitted.id}/reject`)
        .set('Authorization', `Bearer ${reviewer.token}`)
        .send({ reason: '审核阶段发现重大问题' });

      expect(res.body.success).toBe(true);
      expect(getApplicationById(submitted.id)!.status).toBe('rejected');
    });

    it('非窗口/审核/管理员不能退回申请', async () => {
      const submitted = await createSubmittedApplication();

      const res = await request(app)
        .post(`/api/applications/${submitted.id}/reject`)
        .set('Authorization', `Bearer ${applicant.token}`)
        .send({ reason: '尝试退回' });

      expect(res.status).toBe(403);
    });
  });

  describe('8. 办结申请 (POST /:id/complete, approved → completed)', () => {
    async function createApprovedApplication() {
      const draft = await createDraftApplication(applicant, matter.id);
      await request(app)
        .post(`/api/applications/${draft.id}/submit`)
        .set('Authorization', `Bearer ${applicant.token}`);
      await request(app)
        .post(`/api/applications/${draft.id}/accept`)
        .set('Authorization', `Bearer ${windowUser.token}`);
      await request(app)
        .post(`/api/applications/${draft.id}/send-review`)
        .set('Authorization', `Bearer ${windowUser.token}`);
      const reviewRes = await request(app)
        .post(`/api/applications/${draft.id}/review`)
        .set('Authorization', `Bearer ${reviewer.token}`)
        .send({ result: 'pass', opinion: '审核通过' });
      return reviewRes.body.data;
    }

    it('approved 状态窗口人员可办结申请', async () => {
      const approved = await createApprovedApplication();

      const res = await request(app)
        .post(`/api/applications/${approved.id}/complete`)
        .set('Authorization', `Bearer ${windowUser.token}`);

      expect(res.body.success).toBe(true);
      const completedApp = res.body.data;
      expect(completedApp.status).toBe('completed' as ApplicationStatus);
      expect(completedApp.currentStep).toBeTruthy();
      expect(completedApp.completeTime).toBeTruthy();

      const dbApp = getApplicationById(approved.id)!;
      expect(dbApp.status).toBe('completed');
      expect(dbApp.completeTime).toBeTruthy();

      const logs = getLogsByApplication(approved.id);
      const completeLog = logs.find(l => l.action === 'complete');
      expect(completeLog).toBeTruthy();
      expect(completeLog!.oldStatus).toBe('approved');
      expect(completeLog!.newStatus).toBe('completed');

      const notifications = getNotificationsByUser(applicant.id);
      const completeNotif = notifications.find(
        n => n.type === 'complete' && n.applicationId === approved.id
      );
      expect(completeNotif).toBeTruthy();
      expect(completeNotif!.title).toBe('申请已办结');
    });

    it('非 approved 状态不能办结', async () => {
      const draft = await createDraftApplication(applicant, matter.id);

      const res = await request(app)
        .post(`/api/applications/${draft.id}/complete`)
        .set('Authorization', `Bearer ${windowUser.token}`);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('当前状态不能办结');
    });

    it('申请人不能办结申请', async () => {
      const approved = await createApprovedApplication();

      const res = await request(app)
        .post(`/api/applications/${approved.id}/complete`)
        .set('Authorization', `Bearer ${applicant.token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('9. 批量受理和批量补正', () => {
    async function createSubmittedApplications(count: number) {
      const apps = [];
      for (let i = 0; i < count; i++) {
        const draft = await createDraftApplication(applicant, matter.id);
        await request(app)
          .post(`/api/applications/${draft.id}/submit`)
          .set('Authorization', `Bearer ${applicant.token}`);
        apps.push(draft);
      }
      return apps;
    }

    it('批量受理 submitted 状态的申请', async () => {
      const apps = await createSubmittedApplications(3);
      const ids = apps.map(a => a.id);

      const res = await request(app)
        .post('/api/applications/batch/accept')
        .set('Authorization', `Bearer ${windowUser.token}`)
        .send({ ids });

      expect(res.body.success).toBe(true);
      expect(res.body.data.successCount).toBe(3);
      expect(res.body.data.failureCount).toBe(0);

      ids.forEach(id => {
        expect(getApplicationById(id)!.status).toBe('accepted');
      });

      ids.forEach(id => {
        const logs = getLogsByApplication(id);
        expect(logs.some(l => l.action === 'accept')).toBe(true);
      });
    });

    it('批量受理时非 submitted 状态的申请应失败', async () => {
      const submittedApps = await createSubmittedApplications(2);
      const draftApp = await createDraftApplication(applicant, matter.id);
      const ids = [...submittedApps.map(a => a.id), draftApp.id];

      const res = await request(app)
        .post('/api/applications/batch/accept')
        .set('Authorization', `Bearer ${windowUser.token}`)
        .send({ ids });

      expect(res.body.success).toBe(true);
      expect(res.body.data.successCount).toBe(2);
      expect(res.body.data.failureCount).toBe(1);

      const failedItem = res.body.data.results.find((r: any) => !r.success);
      expect(failedItem.reason).toContain('不能受理');
    });

    it('批量要求补正 submitted 或 accepted 状态的申请', async () => {
      const submitted = await createSubmittedApplications(2);
      await request(app)
        .post(`/api/applications/${submitted[0].id}/accept`)
        .set('Authorization', `Bearer ${windowUser.token}`);
      const ids = submitted.map(a => a.id);
      const reason = '批量检查时发现材料需要补正';

      const res = await request(app)
        .post('/api/applications/batch/supplement')
        .set('Authorization', `Bearer ${windowUser.token}`)
        .send({ ids, reason });

      expect(res.body.success).toBe(true);
      expect(res.body.data.successCount).toBe(2);

      ids.forEach(id => {
        const dbApp = getApplicationById(id)!;
        expect(dbApp.status).toBe('supplement');
        expect(dbApp.supplementReason).toBe(reason);
      });

      const applicantNotifs = getNotificationsByUser(applicant.id);
      const supplementNotifs = applicantNotifs.filter(
        n => n.type === 'supplement' && ids.includes(n.applicationId!)
      );
      expect(supplementNotifs.length).toBe(2);
    });

    it('批量受理时空 ids 应返回错误', async () => {
      const res = await request(app)
        .post('/api/applications/batch/accept')
        .set('Authorization', `Bearer ${windowUser.token}`)
        .send({ ids: [] });

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('请选择要受理的申请');
    });
  });

  describe('10. 审核补正分支 (review result=supplement, reviewing → supplement)', () => {
    async function createReviewingApplication() {
      const draft = await createDraftApplication(applicant, matter.id);
      await request(app)
        .post(`/api/applications/${draft.id}/submit`)
        .set('Authorization', `Bearer ${applicant.token}`);
      await request(app)
        .post(`/api/applications/${draft.id}/accept`)
        .set('Authorization', `Bearer ${windowUser.token}`);
      const sendRes = await request(app)
        .post(`/api/applications/${draft.id}/send-review`)
        .set('Authorization', `Bearer ${windowUser.token}`);
      return sendRes.body.data;
    }

    it('审核阶段要求补正，状态从 reviewing 变为 supplement', async () => {
      const reviewing = await createReviewingApplication();
      const supplementOpinion = '部分材料需要补充详细说明';

      const res = await request(app)
        .post(`/api/applications/${reviewing.id}/review`)
        .set('Authorization', `Bearer ${reviewer.token}`)
        .send({
          result: 'supplement',
          opinion: supplementOpinion,
          reviewOpinions: [
            { materialName: '申请表', status: 'problem', opinion: '缺少签字日期' },
          ],
        });

      expect(res.body.success).toBe(true);
      const supplementApp = res.body.data;
      expect(supplementApp.status).toBe('supplement' as ApplicationStatus);
      expect(supplementApp.currentStep).toBe('待补正');
      expect(supplementApp.reviewOpinion).toContain(supplementOpinion);
      expect(supplementApp.supplementReason).toContain(supplementOpinion);

      const dbApp = getApplicationById(reviewing.id)!;
      expect(dbApp.status).toBe('supplement');
      expect(dbApp.reviewerUserId).toBe(reviewer.id);

      const logs = getLogsByApplication(reviewing.id);
      const reviewSupplementLog = logs.find(l => l.action === 'review_supplement');
      expect(reviewSupplementLog).toBeTruthy();
      expect(reviewSupplementLog!.oldStatus).toBe('reviewing');
      expect(reviewSupplementLog!.newStatus).toBe('supplement');
      expect(reviewSupplementLog!.description).toContain('要求继续补正');

      const notifications = getNotificationsByUser(applicant.id);
      const reviewSupplementNotif = notifications.find(
        n => n.type === 'review_supplement' && n.applicationId === reviewing.id
      );
      expect(reviewSupplementNotif).toBeTruthy();
      expect(reviewSupplementNotif!.title).toContain('补正要求');
    });

    it('保存审查意见（不触发状态流转）', async () => {
      const reviewing = await createReviewingApplication();

      const res = await request(app)
        .post(`/api/applications/${reviewing.id}/review-opinions`)
        .set('Authorization', `Bearer ${reviewer.token}`)
        .send({
          opinions: [
            { materialName: '身份证复印件', status: 'pass', opinion: '材料有效' },
            { materialName: '申请表', status: 'problem', opinion: '需补充信息' },
          ],
        });

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);

      const dbApp = getApplicationById(reviewing.id)!;
      expect(dbApp.status).toBe('reviewing');

      const logs = getLogsByApplication(reviewing.id);
      const opinionLog = logs.find(l => l.action === 'review_opinion_save');
      expect(opinionLog).toBeTruthy();
      expect(opinionLog!.description).toContain('2 项');
    });

    it('保存审查意见时状态参数无效应返回错误', async () => {
      const reviewing = await createReviewingApplication();

      const res = await request(app)
        .post(`/api/applications/${reviewing.id}/review-opinions`)
        .set('Authorization', `Bearer ${reviewer.token}`)
        .send({
          opinions: [
            { materialName: '身份证复印件', status: 'invalid_status', opinion: '测试' },
          ],
        });

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('状态值不正确');
    });
  });

  describe('11. 查询类路由基本验证', () => {
    it('GET /:id 可查询申请详情', async () => {
      const draft = await createDraftApplication(applicant, matter.id);

      const res = await request(app)
        .get(`/api/applications/${draft.id}`)
        .set('Authorization', `Bearer ${applicant.token}`);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(draft.id);
      expect(res.body.data.status).toBe('draft');
      expect(res.body.data.matterName).toBe(matter.name);
      expect(res.body.data.applicantName).toBe(applicant.name);
    });

    it('申请人不能查看他人的申请详情', async () => {
      const draft = await createDraftApplication(applicant, matter.id);
      const otherApplicant = createTestUser('other_applicant2', 'applicant', '其他人');

      const res = await request(app)
        .get(`/api/applications/${draft.id}`)
        .set('Authorization', `Bearer ${otherApplicant.token}`);

      expect(res.status).toBe(403);
    });

    it('GET / 可查询申请列表', async () => {
      await createDraftApplication(applicant, matter.id);
      await createDraftApplication(applicant, matter.id);

      const res = await request(app)
        .get('/api/applications')
        .set('Authorization', `Bearer ${applicant.token}`);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.total).toBeGreaterThanOrEqual(2);
    });

    it('GET /:id/logs 可查询操作日志', async () => {
      const draft = await createDraftApplication(applicant, matter.id);
      await request(app)
        .post(`/api/applications/${draft.id}/submit`)
        .set('Authorization', `Bearer ${applicant.token}`);

      const res = await request(app)
        .get(`/api/applications/${draft.id}/logs`)
        .set('Authorization', `Bearer ${applicant.token}`);

      expect(res.body.success).toBe(true);
      const actions = res.body.data.map((l: any) => l.action);
      expect(actions).toContain('create');
      expect(actions).toContain('submit');
    });
  });

  describe('全流程端到端验证', () => {
    it('从创建草稿到审核通过的完整流程，每一步状态、日志、通知均正确', async () => {
      const createRes = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${applicant.token}`)
        .send({
          matterId: matter.id,
          basicInfo: { name: '测试企业' },
          materials: [{ name: '身份证复印件', required: true, checked: true }],
        });
      expect(createRes.body.success).toBe(true);
      const appId = createRes.body.data.id;
      expect(getApplicationById(appId)!.status).toBe('draft');

      const submitRes = await request(app)
        .post(`/api/applications/${appId}/submit`)
        .set('Authorization', `Bearer ${applicant.token}`);
      expect(submitRes.body.success).toBe(true);
      expect(getApplicationById(appId)!.status).toBe('submitted');

      const acceptRes = await request(app)
        .post(`/api/applications/${appId}/accept`)
        .set('Authorization', `Bearer ${windowUser.token}`);
      expect(acceptRes.body.success).toBe(true);
      expect(getApplicationById(appId)!.status).toBe('accepted');

      const sendReviewRes = await request(app)
        .post(`/api/applications/${appId}/send-review`)
        .set('Authorization', `Bearer ${windowUser.token}`);
      expect(sendReviewRes.body.success).toBe(true);
      expect(getApplicationById(appId)!.status).toBe('reviewing');

      const reviewRes = await request(app)
        .post(`/api/applications/${appId}/review`)
        .set('Authorization', `Bearer ${reviewer.token}`)
        .send({ result: 'pass', opinion: '审核通过' });
      expect(reviewRes.body.success).toBe(true);

      const finalApp = getApplicationById(appId)!;
      expect(finalApp.status).toBe('approved');
      expect(finalApp.currentStep).toBeTruthy();
      expect(finalApp.submitTime).toBeTruthy();
      expect(finalApp.acceptTime).toBeTruthy();
      expect(finalApp.reviewerUserId).toBe(reviewer.id);

      const logs = getLogsByApplication(appId);
      const actions = logs.map(l => l.action);
      expect(actions).toContain('create');
      expect(actions).toContain('submit');
      expect(actions).toContain('accept');
      expect(actions).toContain('send_review');
      expect(actions).toContain('review');

      const notifications = getNotificationsByApplication(appId);
      const notifTypes = notifications.map(n => n.type);
      expect(notifTypes).toContain('submit');
      expect(notifTypes).toContain('accept');
      expect(notifTypes).toContain('send_review');
      expect(notifTypes).toContain('review_pass');

      const applicantNotifs = getNotificationsByUser(applicant.id);
      const applicantTypes = applicantNotifs
        .filter(n => n.applicationId === appId)
        .map(n => n.type);
      expect(applicantTypes).toContain('accept');
      expect(applicantTypes).toContain('review_pass');
    });
  });
});
