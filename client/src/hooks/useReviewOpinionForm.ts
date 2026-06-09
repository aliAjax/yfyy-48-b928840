import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, message } from 'antd';
import { getReviewOpinions, saveReviewOpinions } from '../api/applicationApi';
import { MaterialFile, Matter, MatterMaterial, ReviewOpinion, ReviewOpinionFormData } from '../types';
import { safeJSONParse } from '../utils/common';

interface UseReviewOpinionFormOptions {
  applicationId?: string;
  matter: Matter | null;
  files: MaterialFile[];
}

export function useReviewOpinionForm({ applicationId, matter, files }: UseReviewOpinionFormOptions) {
  const [saving, setSaving] = useState(false);
  const [reviewOpinions, setReviewOpinions] = useState<ReviewOpinion[]>([]);
  const [formData, setFormData] = useState<ReviewOpinionFormData[]>([]);
  const [initialized, setInitialized] = useState(false);

  const loadReviewOpinions = useCallback(async () => {
    if (!applicationId) return;
    try {
      const res = await getReviewOpinions(applicationId);
      if (res.success) {
        setReviewOpinions(res.data || []);
      }
    } catch {}
  }, [applicationId]);

  useEffect(() => {
    setReviewOpinions([]);
    setFormData([]);
    setInitialized(false);
    loadReviewOpinions();
  }, [applicationId, loadReviewOpinions]);

  const restoreFromLatestRound = useCallback(() => {
    if (reviewOpinions.length === 0) return;
    const maxRound = Math.max(...reviewOpinions.map(o => o.reviewRound));
    const latestOpinions = reviewOpinions.filter(o => o.reviewRound === maxRound);

    const materials = safeJSONParse<MatterMaterial[]>(matter?.requiredMaterials, []);
    const data: ReviewOpinionFormData[] = materials.map(m => {
      const existing = latestOpinions.find(o => o.materialName === m.name);
      return {
        materialName: m.name,
        status: existing?.status || 'pass',
        opinion: existing?.opinion || '',
      };
    });
    setFormData(data);
    setInitialized(true);
  }, [matter, reviewOpinions]);

  useEffect(() => {
    if (matter && reviewOpinions.length > 0 && !initialized) {
      restoreFromLatestRound();
    }
  }, [matter, reviewOpinions, initialized, restoreFromLatestRound]);

  useEffect(() => {
    if (matter && formData.length === 0 && !initialized) {
      const materials = safeJSONParse<MatterMaterial[]>(matter.requiredMaterials, []);
      const data: ReviewOpinionFormData[] = materials.map(m => ({
        materialName: m.name,
        status: 'pass',
        opinion: '',
      }));
      setFormData(data);
    }
  }, [matter, formData.length, initialized]);

  const handleStatusChange = (materialName: string, status: 'pass' | 'problem') => {
    setFormData(prev => prev.map(item =>
      item.materialName === materialName ? { ...item, status } : item
    ));
  };

  const handleOpinionChange = (materialName: string, opinion: string) => {
    setFormData(prev => prev.map(item =>
      item.materialName === materialName ? { ...item, opinion } : item
    ));
  };

  const handleMarkAllPass = () => {
    setFormData(prev => prev.map(item => ({ ...item, status: 'pass' as const })));
    message.success('已全部标记为通过');
  };

  const handleMarkAllProblem = () => {
    setFormData(prev => prev.map(item => ({ ...item, status: 'problem' as const })));
    message.success('已全部标记为存在问题');
  };

  const doSaveDraft = async () => {
    if (!applicationId) return;
    setSaving(true);
    try {
      const res = await saveReviewOpinions(applicationId, formData);
      if (res.success) {
        message.success('审查意见已保存');
        loadReviewOpinions();
        setInitialized(true);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    if (formData.length === 0) {
      message.warning('暂无材料可保存');
      return;
    }

    const problemItems = formData.filter(item => item.status === 'problem' && !item.opinion.trim());
    if (problemItems.length > 0) {
      Modal.confirm({
        title: '存在问题的材料未填写意见',
        content: `以下材料标记为"存在问题"但未填写具体意见：\n${problemItems.map(i => `• ${i.materialName}`).join('\n')}\n\n是否继续保存？`,
        okText: '继续保存',
        cancelText: '返回补充',
        onOk: doSaveDraft,
      });
      return;
    }

    doSaveDraft();
  };

  const passCount = formData.filter(item => item.status === 'pass').length;
  const problemCount = formData.filter(item => item.status === 'problem').length;

  const groupedOpinions = useMemo(() => {
    const groups: Record<number, ReviewOpinion[]> = {};
    reviewOpinions.forEach(opinion => {
      if (!groups[opinion.reviewRound]) {
        groups[opinion.reviewRound] = [];
      }
      groups[opinion.reviewRound].push(opinion);
    });
    return groups;
  }, [reviewOpinions]);

  const reviewRounds = useMemo(() => {
    return Object.keys(groupedOpinions).map(Number).sort((a, b) => b - a);
  }, [groupedOpinions]);

  const matterMaterials = useMemo(() => {
    if (!matter) return [];
    return safeJSONParse<MatterMaterial[]>(matter.requiredMaterials, []);
  }, [matter]);

  const getFilesForMaterial = (materialName: string): MaterialFile[] => {
    return files.filter(f =>
      f.originalName.includes(materialName) || materialName.includes(f.originalName.replace(/\.[^/.]+$/, ''))
    );
  };

  return {
    saving,
    reviewOpinions,
    formData,
    passCount,
    problemCount,
    groupedOpinions,
    reviewRounds,
    matterMaterials,
    getFilesForMaterial,
    handleStatusChange,
    handleOpinionChange,
    handleMarkAllPass,
    handleMarkAllProblem,
    handleSaveDraft,
  };
}
