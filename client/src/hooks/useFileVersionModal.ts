import { useState } from 'react';
import { listFileVersions } from '../api/fileApi';
import { MaterialFile } from '../types';

export function useFileVersionModal(applicationId?: string) {
  const [visible, setVisible] = useState(false);
  const [versionList, setVersionList] = useState<MaterialFile[]>([]);
  const [currentVersionFile, setCurrentVersionFile] = useState<MaterialFile | null>(null);
  const [loading, setLoading] = useState(false);

  const loadVersionHistory = async (originalName: string) => {
    if (!applicationId) return;
    setLoading(true);
    try {
      const res = await listFileVersions(applicationId, originalName);
      if (res.success) {
        setVersionList(res.data || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleViewVersions = async (file: MaterialFile) => {
    setCurrentVersionFile(file);
    setVisible(true);
    await loadVersionHistory(file.originalName);
  };

  const handleClose = () => {
    setVisible(false);
  };

  return {
    visible,
    versionList,
    currentVersionFile,
    loading,
    handleViewVersions,
    handleClose,
  };
}
