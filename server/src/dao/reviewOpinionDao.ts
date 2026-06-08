import db from '../database';
import { ReviewOpinion, ReviewOpinionStatus } from '../types';
import { generateId, now } from '../utils/helpers';

interface RawReviewOpinion {
  id: string;
  application_id: string;
  material_name: string;
  status: string;
  opinion: string;
  reviewer_id: string;
  reviewer_name?: string;
  review_round: number;
  created_at: string;
  updated_at?: string;
}

function mapReviewOpinion(raw: RawReviewOpinion): ReviewOpinion {
  return {
    id: raw.id,
    applicationId: raw.application_id,
    materialName: raw.material_name,
    status: raw.status as ReviewOpinionStatus,
    opinion: raw.opinion,
    reviewerId: raw.reviewer_id,
    reviewerName: raw.reviewer_name,
    reviewRound: raw.review_round,
    createdAt: raw.created_at,
  };
}

export function findReviewOpinionById(id: string): ReviewOpinion | null {
  const raw = db.prepare('SELECT * FROM review_opinions WHERE id = ?').get(id) as RawReviewOpinion | undefined;
  return raw ? mapReviewOpinion(raw) : null;
}

export function listReviewOpinionsByApplication(applicationId: string): ReviewOpinion[] {
  const rows = db.prepare(
    'SELECT * FROM review_opinions WHERE application_id = ? ORDER BY review_round DESC, created_at DESC, id DESC'
  ).all(applicationId) as RawReviewOpinion[];
  return rows.map(mapReviewOpinion);
}

export function listReviewOpinionsByRound(applicationId: string, reviewRound: number): ReviewOpinion[] {
  const rows = db.prepare(
    'SELECT * FROM review_opinions WHERE application_id = ? AND review_round = ? ORDER BY created_at DESC, id DESC'
  ).all(applicationId, reviewRound) as RawReviewOpinion[];
  return rows.map(mapReviewOpinion);
}

export function getMaxReviewRound(applicationId: string): number {
  const result = db.prepare(
    'SELECT MAX(review_round) as max_round FROM review_opinions WHERE application_id = ?'
  ).get(applicationId) as { max_round: number | null };
  return result.max_round || 0;
}

export function createReviewOpinion(data: {
  applicationId: string;
  materialName: string;
  status: ReviewOpinionStatus;
  opinion: string;
  reviewerId: string;
  reviewerName?: string;
  reviewRound: number;
}): ReviewOpinion {
  const id = generateId();
  const createdAt = now();

  db.prepare(`
    INSERT INTO review_opinions (
      id, application_id, material_name, status, opinion,
      reviewer_id, reviewer_name, review_round, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.applicationId,
    data.materialName,
    data.status,
    data.opinion || '',
    data.reviewerId,
    data.reviewerName || null,
    data.reviewRound,
    createdAt,
    createdAt,
  );

  return findReviewOpinionById(id)!;
}

export function batchCreateReviewOpinions(
  applicationId: string,
  opinions: Array<{
    materialName: string;
    status: ReviewOpinionStatus;
    opinion: string;
  }>,
  reviewerId: string,
  reviewerName?: string,
  reviewRound?: number
): ReviewOpinion[] {
  const round = reviewRound ?? getMaxReviewRound(applicationId) + 1;
  const results: ReviewOpinion[] = [];

  const insert = db.prepare(`
    INSERT INTO review_opinions (
      id, application_id, material_name, status, opinion,
      reviewer_id, reviewer_name, review_round, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    for (const opinion of opinions) {
      const id = generateId();
      const createdAt = now();
      insert.run(
        id,
        applicationId,
        opinion.materialName,
        opinion.status,
        opinion.opinion || '',
        reviewerId,
        reviewerName || null,
        round,
        createdAt,
        createdAt,
      );
      results.push(findReviewOpinionById(id)!);
    }
  });

  transaction();
  return results;
}

export function deleteReviewOpinionsByApplication(applicationId: string): boolean {
  const result = db.prepare('DELETE FROM review_opinions WHERE application_id = ?').run(applicationId);
  return result.changes > 0;
}
