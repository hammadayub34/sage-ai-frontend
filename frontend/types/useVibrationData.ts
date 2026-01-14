import { useQuery } from '@tanstack/react-query';

interface VibrationDataPoint {
  time: string;
  value: number;
}

export function useVibrationData(
  machineId: string = 'lathe01',
  timeRange: string = '-7d', // Default to 7 days to catch older data
  windowPeriod: string = '5m', // Use 5-minute intervals for aggregation
  axis: string = 'vibration' // Which axis to fetch
) {
  return useQuery<VibrationDataPoint[]>({
    queryKey: ['vibration', machineId, timeRange, windowPeriod, axis],
    queryFn: async () => {
      const params = new URLSearchParams({
        machineId,
        timeRange,
        windowPeriod,
        axis,
      });

      const response = await fetch(`/api/influxdb/vibration?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch vibration data');
      }

      const result = await response.json();
      return result.data || [];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });
}

