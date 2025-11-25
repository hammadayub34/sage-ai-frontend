/**
 * React hooks for fetching PLC data
 */
import { useQuery } from '@tanstack/react-query';
import { queryAllTags, queryTimeSeries, queryMultipleFields } from '@/lib/influxdb';
import { PLCData, TimeSeriesDataPoint } from '@/types/plc-data';

/**
 * Hook to fetch all PLC tags (latest values)
 */
export function usePLCData(machineId: string = 'machine-01') {
  return useQuery<PLCData>({
    queryKey: ['plc-data', machineId],
    queryFn: async () => {
      try {
        const data = await queryAllTags(machineId);
        // Return data with defaults to ensure all fields exist
        return {
          _time: data._time || new Date().toISOString(),
          machine_id: data.machine_id || machineId,
          SystemRunning: data.SystemRunning ?? false,
          Fault: data.Fault ?? false,
          Filling: data.Filling ?? false,
          Ready: data.Ready ?? false,
          BottlesFilled: data.BottlesFilled ?? 0,
          BottlesRejected: data.BottlesRejected ?? 0,
          BottlesPerMinute: data.BottlesPerMinute ?? 0,
          AlarmFault: data.AlarmFault ?? false,
          AlarmOverfill: data.AlarmOverfill ?? false,
          AlarmUnderfill: data.AlarmUnderfill ?? false,
          AlarmLowProductLevel: data.AlarmLowProductLevel ?? false,
          AlarmCapMissing: data.AlarmCapMissing ?? false,
          FillLevel: data.FillLevel ?? 0,
          TankTemperature: data.TankTemperature ?? 0,
          TankPressure: data.TankPressure ?? 0,
          FillFlowRate: data.FillFlowRate ?? 0,
          ConveyorSpeed: data.ConveyorSpeed ?? 0,
          LowLevelSensor: data.LowLevelSensor ?? false,
        } as PLCData;
      } catch (error) {
        console.error('Error fetching PLC data:', error);
        throw error;
      }
    },
    // No auto-refresh - user will manually refresh
  });
}

/**
 * Hook to fetch time series data for charts
 */
export function useTimeSeries(
  field: string,
  machineId: string = 'machine-01',
  timeRange: string = '-1h'
) {
  return useQuery<TimeSeriesDataPoint[]>({
    queryKey: ['time-series', field, machineId, timeRange],
    queryFn: async () => {
      try {
        return await queryTimeSeries(field, machineId, timeRange);
      } catch (error) {
        console.error(`Error fetching time series for ${field}:`, error);
        return [];
      }
    },
    // No auto-refresh - user will manually refresh
  });
}

/**
 * Hook to fetch specific fields
 */
export function useFields(
  fields: string[],
  machineId: string = 'machine-01'
) {
  return useQuery<Record<string, number | boolean>>({
    queryKey: ['fields', fields.join(','), machineId],
    queryFn: () => queryMultipleFields(fields, machineId),
    // No auto-refresh - user will manually refresh
  });
}

