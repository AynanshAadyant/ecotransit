import { create } from 'zustand';
import { OperationalReport, HeadwayMetric } from '../api/reports.api';

export interface ReportsState {
  summary: OperationalReport | null;
  headwayMetrics: HeadwayMetric[];
  loading: boolean;
  timeRange: 'TODAY' | 'WEEK' | 'MONTH';
  setSummary: (summary: OperationalReport | null) => void;
  setHeadwayMetrics: (metrics: HeadwayMetric[]) => void;
  setTimeRange: (range: 'TODAY' | 'WEEK' | 'MONTH') => void;
  setLoading: (loading: boolean) => void;
}

export const useReportsStore = create<ReportsState>((set) => ({
  summary: null,
  headwayMetrics: [],
  loading: false,
  timeRange: 'TODAY',
  setSummary: (summary) => set({ summary }),
  setHeadwayMetrics: (headwayMetrics) => set({ headwayMetrics }),
  setTimeRange: (timeRange) => set({ timeRange }),
  setLoading: (loading) => set({ loading }),
}));
