import { apiClient } from './client';

export interface OperationalReport {
  totalTripsCompleted: number;
  onTimePunctualityRate: number; // percentage
  fleetActivePercent: number;
  totalPassengersServed: number;
  emissionSavingsKg: number;
  averageDelaySeconds: number;
}

export interface HeadwayMetric {
  routeId: string;
  routeName: string;
  targetHeadwaySeconds: number;
  actualHeadwaySeconds: number;
  varianceSeconds: number;
}

export async function getOperationalSummary(): Promise<OperationalReport> {
  const response = await apiClient.get<OperationalReport>('/reports/operational-summary');
  return response.data;
}

export async function getHeadwayVariance(): Promise<HeadwayMetric[]> {
  const response = await apiClient.get<HeadwayMetric[]>('/reports/headway-variance');
  return response.data;
}
