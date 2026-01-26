import { useQuery } from '@tanstack/react-query';

interface ModbusLatestValues {
  [fieldName: string]: {
    value: number;
    time: string;
  };
}

export function useModbusLatest(
  machineId: string = '',
  macAddress: string = ''
) {
  return useQuery<ModbusLatestValues>({
    queryKey: ['modbus-latest', machineId, macAddress],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (machineId) params.append('machineId', machineId);
      if (macAddress) params.append('macAddress', macAddress);

      const response = await fetch(`/api/influxdb/modbus/latest?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch latest modbus values');
      }

      const result = await response.json();
      return result.data || {};
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
    enabled: !!(machineId || macAddress), // Only fetch if we have machineId or macAddress
  });
}

