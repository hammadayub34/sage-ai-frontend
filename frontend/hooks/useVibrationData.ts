import { useQuery } from '@tanstack/react-query';

interface VibrationDataPoint {
  time: string;
  value: number;
}

export function useVibrationData(
  machineId: string = 'lathe01',
  timeRange: string = '-24h', // Default to 24 hours back from now
  windowPeriod: string = '5s' // Use 5-second intervals to match raw data
) {
  return useQuery<VibrationDataPoint[]>({
    queryKey: ['vibration', machineId, timeRange, windowPeriod],
    queryFn: async () => {
      const params = new URLSearchParams({
        machineId,
        timeRange,
        windowPeriod,
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

