/**
 * React hooks for fetching PLC data
 */
import { useQuery } from '@tanstack/react-query';
import { queryAllTags, queryTimeSeries, queryMultipleFields } from '@/lib/influxdb';
import { PLCData, TimeSeriesDataPoint } from '@/types/plc-data';

/**
 * Hook to fetch all PLC tags (latest values)
 */
export function usePLCData(machineId: string = 'machine-01', machineType?: string) {
  return useQuery<PLCData & Record<string, any>>({
    queryKey: ['plc-data', machineId, machineType],
    queryFn: async () => {
      try {
        const data = await queryAllTags(machineId, '-24h', machineType);
        // Return data with defaults - include all fields from the query result
        // This allows both bottle filler and lathe data to be displayed
        return {
          _time: data._time || new Date().toISOString(),
          machine_id: data.machine_id || machineId,
          // Bottle filler defaults
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
          // Lathe defaults - include all lathe fields
          Machining: data.Machining ?? false,
          AutoMode: data.AutoMode ?? false,
          PartsCompleted: data.PartsCompleted ?? 0,
          PartsRejected: data.PartsRejected ?? 0,
          PartsPerHour: data.PartsPerHour ?? 0,
          CycleTime: data.CycleTime ?? 0,
          DoorClosed: data.DoorClosed ?? false,
          EStopOK: data.EStopOK ?? false,
          SpindleSpeed: data.SpindleSpeed ?? 0,
          SpindleSpeedSetpoint: data.SpindleSpeedSetpoint ?? 0,
          SpindleLoad: data.SpindleLoad ?? 0,
          AxisXPosition: data.AxisXPosition ?? 0,
          AxisXFeedrate: data.AxisXFeedrate ?? 0,
          AxisXHomed: data.AxisXHomed ?? false,
          AxisZPosition: data.AxisZPosition ?? 0,
          AxisZFeedrate: data.AxisZFeedrate ?? 0,
          AxisZHomed: data.AxisZHomed ?? false,
          AlarmSpindleOverload: data.AlarmSpindleOverload ?? false,
          AlarmChuckNotClamped: data.AlarmChuckNotClamped ?? false,
          AlarmDoorOpen: data.AlarmDoorOpen ?? false,
          AlarmToolWear: data.AlarmToolWear ?? false,
          AlarmCoolantLow: data.AlarmCoolantLow ?? false,
          ToolNumber: data.ToolNumber ?? 0,
          ToolLifePercent: data.ToolLifePercent ?? 0,
          ToolOffsetX: data.ToolOffsetX ?? 0,
          ToolOffsetZ: data.ToolOffsetZ ?? 0,
          CoolantFlowRate: data.CoolantFlowRate ?? 0,
          CoolantTemperature: data.CoolantTemperature ?? 0,
          CoolantLevelPercent: data.CoolantLevelPercent ?? 0,
          // Include any other fields from the query
          ...data,
        } as PLCData & Record<string, any>;
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
  timeRange: string = '-1h',
  machineType?: string
) {
  return useQuery<TimeSeriesDataPoint[]>({
    queryKey: ['time-series', field, machineId, timeRange, machineType],
    queryFn: async () => {
      try {
        return await queryTimeSeries(field, machineId, timeRange, undefined, machineType);
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

