export type ObservabilityAction =
  | 'Import'
  | 'Search'
  | 'Impact Analysis'
  | 'Change Simulation'
  | 'Dashboard Load'
  | 'Summary Fetch'
  | 'Graph Fetch'
  | 'Activity Fetch'
  | 'Contributor Panel Open';

export interface ObservabilityMetric {
  action: ObservabilityAction;
  analysisId: string;
  repoName: string;
  durationMs: number;
  success: boolean;
  timestamp: string;
}

const logMetric = (metric: ObservabilityMetric) => {
  console.log(`[OBSERVABILITY] ${metric.action} completed in ${metric.durationMs}ms`, metric);
};

export const trackImport = (analysisId: string, repoName: string, durationMs: number, success: boolean) => {
  logMetric({ action: 'Import', analysisId, repoName, durationMs, success, timestamp: new Date().toISOString() });
};

export const trackSearch = (analysisId: string, repoName: string, durationMs: number, success: boolean) => {
  logMetric({ action: 'Search', analysisId, repoName, durationMs, success, timestamp: new Date().toISOString() });
};

export const trackImpactAnalysis = (analysisId: string, repoName: string, durationMs: number, success: boolean) => {
  logMetric({ action: 'Impact Analysis', analysisId, repoName, durationMs, success, timestamp: new Date().toISOString() });
};

export const trackChangeSimulation = (analysisId: string, repoName: string, durationMs: number, success: boolean) => {
  logMetric({ action: 'Change Simulation', analysisId, repoName, durationMs, success, timestamp: new Date().toISOString() });
};

export const trackDashboardLoad = (durationMs: number, success: boolean) => {
  logMetric({ action: 'Dashboard Load', analysisId: '', repoName: '', durationMs, success, timestamp: new Date().toISOString() });
};

export const trackSummaryFetch = (analysisId: string, repoName: string, durationMs: number, success: boolean) => {
  logMetric({ action: 'Summary Fetch', analysisId, repoName, durationMs, success, timestamp: new Date().toISOString() });
};

export const trackGraphFetch = (analysisId: string, repoName: string, durationMs: number, success: boolean) => {
  logMetric({ action: 'Graph Fetch', analysisId, repoName, durationMs, success, timestamp: new Date().toISOString() });
};

export const trackActivityFetch = (analysisId: string, repoName: string, durationMs: number, success: boolean) => {
  logMetric({ action: 'Activity Fetch', analysisId, repoName, durationMs, success, timestamp: new Date().toISOString() });
};

export const trackContributorPanelOpen = (analysisId: string, repoName: string, contributorName: string) => {
  logMetric({ action: 'Contributor Panel Open', analysisId, repoName, durationMs: 0, success: true, timestamp: new Date().toISOString() });
  if (import.meta.env.DEV) {
    console.debug(`[OBSERVABILITY] Contributor panel opened: ${contributorName}`);
  }
};
