import { useQuery } from '@tanstack/react-query';

interface ModbusDataPoint {
  time: string;
  value: number;
}

export function useModbusData(
  machineId: string = '',
  macAddress: string = '',
  timeRange: string = '-7d',
  windowPeriod: string = '5m',
  field: string = 'Pressure'
) {
  return useQuery<ModbusDataPoint[]>({
    queryKey: ['modbus', machineId, macAddress, timeRange, windowPeriod, field],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (machineId) params.append('machineId', machineId);
      if (macAddress) params.append('macAddress', macAddress);
      params.append('timeRange', timeRange);
      params.append('windowPeriod', windowPeriod);
      params.append('field', field);

      const response = await fetch(`/api/influxdb/modbus?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch modbus data');
      }

      const result = await response.json();
      return result.data || [];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
    enabled: !!(machineId || macAddress), // Only fetch if we have machineId or macAddress
  });
}

