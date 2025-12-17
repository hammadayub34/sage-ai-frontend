/**
 * TypeScript types for PLC data from InfluxDB
 */

export interface PLCData {
  _time: string;
  machine_id: string;
  
  // Status Fields
  SystemRunning: boolean;
  Fault: boolean;
  Filling: boolean;
  Ready: boolean;
  
  // Counter Fields
  BottlesFilled: number;
  BottlesRejected: number;
  BottlesPerMinute: number;
  
  // Alarm Fields
  AlarmFault: boolean;
  AlarmOverfill: boolean;
  AlarmUnderfill: boolean;
  AlarmLowProductLevel: boolean;
  AlarmCapMissing: boolean;
  
  // Analog Fields
  FillLevel: number;
  TankTemperature: number;
  TankPressure: number;
  FillFlowRate: number;
  ConveyorSpeed: number;
  
  // Input Fields
  LowLevelSensor: boolean;
}

export interface TimeSeriesDataPoint {
  time: string;
  value: number;
  field: string;
}

export interface StatusIndicator {
  label: string;
  value: boolean;
  color: 'green' | 'red' | 'yellow' | 'grey';
}

