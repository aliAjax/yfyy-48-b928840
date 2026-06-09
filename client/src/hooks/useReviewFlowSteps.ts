import { useMemo } from 'react';
import { Application, FlowStep } from '../types';
import { parseFlowConfig } from '../utils/common';

export function useReviewFlowSteps(application: Application | null) {
  const flowSteps: FlowStep[] = useMemo(() => {
    if (application?.flowSteps && application.flowSteps.length > 0) {
      return application.flowSteps;
    }
    return parseFlowConfig(null);
  }, [application]);

  const currentStepIndex = useMemo(() => {
    if (!application) return -1;
    const status = application.status;

    const hasStatusField = flowSteps.some(s => s.status);
    if (hasStatusField) {
      let maxCompletedStep = -1;
      flowSteps.forEach((step, idx) => {
        if (step.status === 'accepted' && (status === 'accepted' || status === 'reviewing' || status === 'approved' || status === 'completed')) {
          maxCompletedStep = Math.max(maxCompletedStep, idx);
        }
        if (step.status === 'reviewing' && (status === 'reviewing' || status === 'approved' || status === 'completed')) {
          maxCompletedStep = Math.max(maxCompletedStep, idx);
        }
        if (step.status === 'approved' && (status === 'approved' || status === 'completed')) {
          maxCompletedStep = Math.max(maxCompletedStep, idx);
        }
        if (step.status === 'completed' && status === 'completed') {
          maxCompletedStep = Math.max(maxCompletedStep, idx);
        }
      });
      return maxCompletedStep;
    }

    if (status === 'draft' || status === 'submitted') return -1;
    if (status === 'rejected') return flowSteps.length - 1;
    if (status === 'completed') return flowSteps.length - 1;
    if (status === 'supplement') return 0;
    if (status === 'accepted') return Math.min(1, flowSteps.length - 1);
    if (status === 'reviewing') return Math.min(2, flowSteps.length - 1);
    if (status === 'approved') return Math.min(flowSteps.length - 2, flowSteps.length - 1);
    return -1;
  }, [application, flowSteps]);

  return {
    flowSteps,
    currentStepIndex,
  };
}
