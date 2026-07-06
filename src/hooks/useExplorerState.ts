import { useState, useCallback } from 'react';

export const useExplorerState = () => {
  const [expandedSubsystemId, setExpandedSubsystemId] = useState<string | null>(null);
  const [selectedSubsystemId, setSelectedSubsystemId] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const expandSubsystem = useCallback((id: string) => {
    setExpandedSubsystemId(id);
    setSelectedSubsystemId(id);
    setSelectedFileId(null);
  }, []);

  const collapseSubsystem = useCallback(() => {
    setExpandedSubsystemId(null);
    setSelectedFileId(null);
  }, []);

  const selectSubsystem = useCallback((id: string) => {
    setSelectedSubsystemId(id);
    setSelectedFileId(null);
  }, []);

  const selectFile = useCallback((id: string) => {
    setSelectedFileId(id);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSubsystemId(null);
    setSelectedFileId(null);
  }, []);

  return {
    expandedSubsystemId,
    selectedSubsystemId,
    selectedFileId,
    expandSubsystem,
    collapseSubsystem,
    selectSubsystem,
    selectFile,
    clearSelection,
  };
};
