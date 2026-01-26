# Maintenance Work Order Manual
## MQTT-OT Network Production System

**Version:** 1.0  
**Last Updated:** January 2025  
**Document Type:** Maintenance Work Order Reference Manual

---

## Table of Contents

1. [Bottle Filler Machine Work Orders](#bottle-filler-machine-work-orders)
2. [CNC Lathe Machine Work Orders](#cnc-lathe-machine-work-orders)
3. [Work Order Threshold Definitions](#work-order-threshold-definitions)

---

## Work Order Threshold Definitions

Work orders are automatically generated when alarm occurrences exceed the following thresholds within a 24-hour period:

| Alarm Type | Threshold (24h) | Priority |
|------------|----------------|----------|
| AlarmFault | 3 occurrences | High |
| AlarmOverfill | 5 occurrences | High |
| AlarmUnderfill | 5 occurrences | High |
| AlarmLowProductLevel | 3 occurrences | Medium |
| AlarmCapMissing | 5 occurrences | Medium |
| AlarmSpindleOverload | 3 occurrences | High |
| AlarmChuckNotClamped | 5 occurrences | High |
| AlarmDoorOpen | 10 occurrences | Medium |
| AlarmToolWear | 2 occurrences | High |
| AlarmCoolantLow | 3 occurrences | Medium |

---

## Bottle Filler Machine Work Orders

### Alarm: LowProductLevel

**Alarm Field:** `AlarmLowProductLevel`  
**Threshold:** 3 occurrences in 24 hours  
**Priority:** Medium

#### Work Order Details

**Task Number:** PM-BF-001  
**Frequency:** As needed (triggered by threshold breach)  
**Work Performed By:** Maintenance Department  
**Standard Hours:** 2.0  
**Overtime Hours:** 0.5 (if after hours)

#### Work Description

Perform comprehensive inspection and maintenance of product tank level monitoring system. Verify low-level sensor calibration and functionality. Inspect product supply lines for leaks, blockages, or kinks. Check product supply pump operation and flow rate. Review production logs to identify consumption patterns. Refill product tank to 80% capacity and prime filling system to remove air bubbles. Verify sensor readings return to normal levels. Document findings and update preventive maintenance schedule.

#### Required Parts & Components

| Part # | Description | Quantity | Qty in Stock | Location |
|--------|-------------|----------|--------------|----------|
| BF-SENS-001 | Low-Level Sensor Assembly | 1 | Check stock | Warehouse A-12 |
| BF-PUMP-002 | Product Supply Pump Seal Kit | 1 | Check stock | Warehouse A-15 |
| BF-VALVE-003 | Supply Line Check Valve | 1 | Check stock | Warehouse A-18 |
| BF-FILTER-004 | Product Line Filter Element | 1 | Check stock | Warehouse A-20 |

#### Materials Used

| Description | Quantity | Part # |
|------------|----------|--------|
| Food-grade lubricant | 50ml | LUB-FG-001 |
| Sensor cleaning solution | 100ml | CLN-SENS-001 |
| Thread sealant tape | 1 roll | TAPE-THREAD-001 |

#### Special Instructions

- Ensure product tank is isolated before maintenance
- Use food-grade materials only
- Calibrate sensor to manufacturer specifications
- Test system operation before returning to production
- Update maintenance log with sensor readings

---

### Alarm: Overfill

**Alarm Field:** `AlarmOverfill`  
**Threshold:** 5 occurrences in 24 hours  
**Priority:** High

#### Work Order Details

**Task Number:** PM-BF-002  
**Frequency:** As needed (triggered by threshold breach)  
**Work Performed By:** Maintenance Department  
**Standard Hours:** 3.0  
**Overtime Hours:** 1.0 (if after hours)

#### Work Description

Inspect and calibrate fill level sensor system. Check fill valve operation and verify proper closing mechanism. Inspect fill valve actuator for mechanical issues. Review and adjust fill time setpoint if necessary. Verify fill flow rate is within specification. Check for air bubbles in filling lines and prime system if needed. Remove and isolate all overfilled bottles from production line. Perform test fills and verify fill volume is within ±5mL tolerance. Document calibration values and update quality control procedures.

#### Required Parts & Components

| Part # | Description | Quantity | Qty in Stock | Location |
|--------|-------------|----------|--------------|----------|
| BF-VALVE-101 | Fill Valve Assembly | 1 | Check stock | Warehouse A-25 |
| BF-ACT-102 | Fill Valve Actuator | 1 | Check stock | Warehouse A-26 |
| BF-SENS-103 | Fill Level Sensor | 1 | Check stock | Warehouse A-12 |
| BF-SEAL-104 | Fill Valve Seal Kit | 1 | Check stock | Warehouse A-15 |

#### Materials Used

| Description | Quantity | Part # |
|------------|----------|--------|
| Calibration fluid | 500ml | CAL-FLUID-001 |
| Valve cleaning solution | 200ml | CLN-VALVE-001 |
| O-rings (various sizes) | 1 set | ORING-KIT-001 |

#### Special Instructions

- Notify Quality Control before starting work
- Isolate affected bottles for quality review
- Calibrate sensor using certified calibration fluid
- Test fill volumes on first 10 bottles after repair
- Document all calibration adjustments

---

### Alarm: Underfill

**Alarm Field:** `AlarmUnderfill`  
**Threshold:** 5 occurrences in 24 hours  
**Priority:** High

#### Work Order Details

**Task Number:** PM-BF-003  
**Frequency:** As needed (triggered by threshold breach)  
**Work Performed By:** Maintenance Department  
**Standard Hours:** 3.0  
**Overtime Hours:** 1.0 (if after hours)

#### Work Description

Inspect fill valve operation and verify proper opening mechanism. Check fill level sensor calibration and positioning. Inspect fill valve actuator for mechanical binding or wear. Verify fill flow rate meets specification. Check for blockages in filling lines. Review fill time setpoint and adjust if necessary. Remove and isolate all underfilled bottles. Perform test fills and verify fill volume meets minimum requirements. Document findings and update quality procedures.

#### Required Parts & Components

| Part # | Description | Quantity | Qty in Stock | Location |
|--------|-------------|----------|--------------|----------|
| BF-VALVE-101 | Fill Valve Assembly | 1 | Check stock | Warehouse A-25 |
| BF-ACT-102 | Fill Valve Actuator | 1 | Check stock | Warehouse A-26 |
| BF-SENS-103 | Fill Level Sensor | 1 | Check stock | Warehouse A-12 |
| BF-LINE-105 | Fill Line Assembly | 1 | Check stock | Warehouse A-30 |

#### Materials Used

| Description | Quantity | Part # |
|------------|----------|--------|
| Calibration fluid | 500ml | CAL-FLUID-001 |
| Line cleaning solution | 500ml | CLN-LINE-001 |
| Valve lubricant | 50ml | LUB-VALVE-001 |

#### Special Instructions

- Notify Quality Control before starting work
- Isolate affected bottles for quality review
- Verify fill volumes meet regulatory requirements
- Test on first 10 bottles after repair
- Document all adjustments

---

### Alarm: CapMissing

**Alarm Field:** `AlarmCapMissing`  
**Threshold:** 5 occurrences in 24 hours  
**Priority:** Medium

#### Work Order Details

**Task Number:** PM-BF-004  
**Frequency:** As needed (triggered by threshold breach)  
**Work Performed By:** Maintenance Department  
**Standard Hours:** 2.5  
**Overtime Hours:** 0.5 (if after hours)

#### Work Description

Inspect cap hopper and verify adequate cap supply. Check cap feeder mechanism for blockages or jams. Inspect capping motor operation and verify proper torque. Check cap sensor alignment and functionality. Inspect capping head for mechanical issues or wear. Verify cap orientation in hopper. Clear any jams in cap feeder system. Test capping operation and verify consistent cap application. Refill cap hopper if needed. Document findings and update maintenance schedule.

#### Required Parts & Components

| Part # | Description | Quantity | Qty in Stock | Location |
|--------|-------------|----------|--------------|----------|
| BF-CAP-201 | Capping Motor Assembly | 1 | Check stock | Warehouse A-35 |
| BF-SENS-202 | Cap Sensor | 1 | Check stock | Warehouse A-12 |
| BF-FEED-203 | Cap Feeder Mechanism | 1 | Check stock | Warehouse A-36 |
| BF-HEAD-204 | Capping Head Assembly | 1 | Check stock | Warehouse A-37 |

#### Materials Used

| Description | Quantity | Part # |
|------------|----------|--------|
| Motor lubricant | 30ml | LUB-MOTOR-001 |
| Sensor cleaning wipes | 5 pcs | CLN-WIPE-001 |
| Cap alignment tool | 1 | TOOL-CAP-001 |

#### Special Instructions

- Verify cap supply before starting
- Check cap orientation and alignment
- Test capping operation on 20 bottles
- Update cap hopper refill schedule
- Document motor torque settings

---

### Alarm: Fault

**Alarm Field:** `AlarmFault`  
**Threshold:** 3 occurrences in 24 hours  
**Priority:** High

#### Work Order Details

**Task Number:** PM-BF-005  
**Frequency:** As needed (triggered by threshold breach)  
**Work Performed By:** Maintenance Department (Electrical Specialist)  
**Standard Hours:** 4.0  
**Overtime Hours:** 2.0 (if after hours)

#### Work Description

Perform comprehensive system fault diagnosis. Review fault log on HMI for specific error codes. Check all safety interlocks and emergency stop systems. Inspect electrical systems for overcurrent, short circuits, or ground faults. Verify all emergency stops are in released position. Check mechanical components for damage or binding. Review system status indicators and diagnostic data. Identify root cause of fault condition. Repair or replace faulty components. Clear all fault codes. Reset safety systems. Perform complete system check. Verify all subsystems operational. Document fault analysis and resolution in detail.

#### Required Parts & Components

| Part # | Description | Quantity | Qty in Stock | Location |
|--------|-------------|----------|--------------|----------|
| BF-ESTOP-301 | Emergency Stop Assembly | 1 | Check stock | Warehouse B-10 |
| BF-RELAY-302 | Control Relay Set | 1 | Check stock | Warehouse B-15 |
| BF-FUSE-303 | Fuse Kit (Various) | 1 | Check stock | Warehouse B-20 |
| BF-WIRE-304 | Control Wire (10m) | 1 | Check stock | Warehouse B-25 |

#### Materials Used

| Description | Quantity | Part # |
|------------|----------|--------|
| Electrical contact cleaner | 200ml | CLN-ELEC-001 |
| Wire connectors (assorted) | 1 pack | CONN-WIRE-001 |
| Heat shrink tubing | 1 pack | TUBE-SHRINK-001 |

#### Special Instructions

- **EMERGENCY WORK ORDER** - High priority
- Do not attempt restart until fault is cleared
- Notify supervisor and maintenance manager
- Document all fault codes and diagnostic data
- Conduct post-incident review
- Update preventive maintenance schedule

---

## CNC Lathe Machine Work Orders

### Alarm: SpindleOverload

**Alarm Field:** `AlarmSpindleOverload`  
**Threshold:** 3 occurrences in 24 hours  
**Priority:** High

#### Work Order Details

**Task Number:** PM-LATHE-001  
**Frequency:** As needed (triggered by threshold breach)  
**Work Performed By:** Maintenance Department (Machining Specialist)  
**Standard Hours:** 4.0  
**Overtime Hours:** 1.5 (if after hours)

#### Work Description

Inspect spindle assembly for excessive wear or damage. Check spindle bearings for proper lubrication and signs of wear. Verify spindle motor operation and current draw. Inspect spindle drive belt tension and condition. Check for mechanical binding in spindle assembly. Review cutting parameters and verify they are within machine specifications. Inspect tool holder and tool mounting for proper seating. Check spindle cooling system operation. Measure spindle runout and verify within tolerance. Replace spindle bearings if excessive wear detected. Lubricate spindle assembly per manufacturer specifications. Test spindle operation at various speeds. Document spindle condition and update maintenance records.

#### Required Parts & Components

| Part # | Description | Quantity | Qty in Stock | Location |
|--------|-------------|----------|--------------|----------|
| LATHE-SPIN-001 | Spindle Bearing Set | 1 | Check stock | Warehouse C-10 |
| LATHE-BELT-002 | Spindle Drive Belt | 1 | Check stock | Warehouse C-12 |
| LATHE-MOTOR-003 | Spindle Motor (if needed) | 1 | Check stock | Warehouse C-15 |
| LATHE-TOOL-004 | Tool Holder Assembly | 1 | Check stock | Warehouse C-20 |

#### Materials Used

| Description | Quantity | Part # |
|------------|----------|--------|
| Spindle bearing grease | 100ml | LUB-SPIN-001 |
| Belt dressing | 50ml | LUB-BELT-001 |
| Cleaning solvent | 500ml | CLN-SOLV-001 |

#### Special Instructions

- Verify machine is powered down and locked out
- Use precision measurement tools for runout check
- Follow manufacturer torque specifications for bearing installation
- Test spindle at low speed first, then gradually increase
- Document all measurements and adjustments

---

### Alarm: ChuckNotClamped

**Alarm Field:** `AlarmChuckNotClamped`  
**Threshold:** 5 occurrences in 24 hours  
**Priority:** High

#### Work Order Details

**Task Number:** PM-LATHE-002  
**Frequency:** As needed (triggered by threshold breach)  
**Work Performed By:** Maintenance Department  
**Standard Hours:** 3.0  
**Overtime Hours:** 1.0 (if after hours)

#### Work Description

Inspect chuck assembly for proper operation. Check chuck jaws for wear, damage, or contamination. Verify chuck clamping mechanism and hydraulic/pneumatic pressure. Inspect chuck actuator for proper operation. Check chuck sensor alignment and functionality. Clean chuck jaws and mounting surface. Inspect chuck mounting bolts for proper torque. Test chuck clamping force and verify within specification. Replace chuck jaws if excessive wear detected. Adjust chuck sensor if misaligned. Test chuck operation with various workpiece sizes. Document chuck condition and update maintenance schedule.

#### Required Parts & Components

| Part # | Description | Quantity | Qty in Stock | Location |
|--------|-------------|----------|--------------|----------|
| LATHE-CHUCK-101 | Chuck Jaw Set (3-jaw) | 1 | Check stock | Warehouse C-25 |
| LATHE-ACT-102 | Chuck Actuator | 1 | Check stock | Warehouse C-30 |
| LATHE-SENS-103 | Chuck Clamp Sensor | 1 | Check stock | Warehouse C-12 |
| LATHE-SEAL-104 | Chuck Seal Kit | 1 | Check stock | Warehouse C-35 |

#### Materials Used

| Description | Quantity | Part # |
|------------|----------|--------|
| Chuck jaw cleaning solution | 200ml | CLN-CHUCK-001 |
| Hydraulic fluid | 500ml | FLUID-HYD-001 |
| Thread locking compound | 10ml | COMP-LOCK-001 |

#### Special Instructions

- Verify machine is powered down and locked out
- Check clamping force with calibrated force gauge
- Test with various workpiece sizes
- Document clamping force measurements
- Update chuck maintenance schedule

---

### Alarm: DoorOpen

**Alarm Field:** `AlarmDoorOpen`  
**Threshold:** 10 occurrences in 24 hours  
**Priority:** Medium

#### Work Order Details

**Task Number:** PM-LATHE-003  
**Frequency:** As needed (triggered by threshold breach)  
**Work Performed By:** Maintenance Department  
**Standard Hours:** 2.0  
**Overtime Hours:** 0.5 (if after hours)

#### Work Description

Inspect safety door mechanism and interlock system. Check door sensor alignment and functionality. Verify door latch mechanism operation. Inspect door hinges and mounting hardware. Check door seal condition. Test door interlock safety circuit. Adjust door sensor if misaligned. Lubricate door hinges and latch mechanism. Verify door closes properly and interlock engages. Test safety interlock circuit operation. Document findings and update maintenance records.

#### Required Parts & Components

| Part # | Description | Quantity | Qty in Stock | Location |
|--------|-------------|----------|--------------|----------|
| LATHE-DOOR-201 | Door Sensor Assembly | 1 | Check stock | Warehouse C-12 |
| LATHE-LATCH-202 | Door Latch Mechanism | 1 | Check stock | Warehouse C-40 |
| LATHE-HINGE-203 | Door Hinge Set | 1 | Check stock | Warehouse C-45 |
| LATHE-SEAL-204 | Door Seal Gasket | 1 | Check stock | Warehouse C-50 |

#### Materials Used

| Description | Quantity | Part # |
|------------|----------|--------|
| Hinge lubricant | 30ml | LUB-HINGE-001 |
| Door seal lubricant | 20ml | LUB-SEAL-001 |
| Sensor cleaning wipes | 3 pcs | CLN-WIPE-001 |

#### Special Instructions

- Safety interlock must function correctly - critical for operator safety
- Test interlock circuit multiple times
- Verify door cannot be opened during operation
- Document all safety tests performed

---

### Alarm: ToolWear

**Alarm Field:** `AlarmToolWear`  
**Threshold:** 2 occurrences in 24 hours  
**Priority:** High

#### Work Order Details

**Task Number:** PM-LATHE-004  
**Frequency:** As needed (triggered by threshold breach)  
**Work Performed By:** Maintenance Department (Tooling Specialist)  
**Standard Hours:** 3.5  
**Overtime Hours:** 1.0 (if after hours)

#### Work Description

Inspect tool holder assembly for wear or damage. Check tool mounting and seating in tool holder. Verify tool offset measurements and calibration. Inspect tool turret mechanism for proper operation. Check tool life monitoring system accuracy. Replace worn tools per tooling schedule. Inspect tool holder for proper clamping force. Verify tool offset data in control system. Test tool change operation. Calibrate tool offsets if necessary. Document tool replacement and update tooling records. Review cutting parameters and adjust if needed.

#### Required Parts & Components

| Part # | Description | Quantity | Qty in Stock | Location |
|--------|-------------|----------|--------------|----------|
| LATHE-TOOL-301 | Tool Holder Assembly | 1 | Check stock | Warehouse C-20 |
| LATHE-TURRET-302 | Tool Turret Assembly | 1 | Check stock | Warehouse C-55 |
| LATHE-OFFSET-303 | Tool Offset Calibration Kit | 1 | Check stock | Warehouse C-60 |
| LATHE-CLAMP-304 | Tool Clamp Mechanism | 1 | Check stock | Warehouse C-65 |

#### Materials Used

| Description | Quantity | Part # |
|------------|----------|--------|
| Tool holder cleaning solution | 200ml | CLN-TOOL-001 |
| Calibration standard | 1 | CAL-STD-001 |
| Tool lubricant | 20ml | LUB-TOOL-001 |

#### Special Instructions

- Verify tool offsets before and after replacement
- Test tool change operation multiple times
- Document all tool measurements
- Update tooling database with new tool data
- Review cutting parameters for optimization

---

### Alarm: CoolantLow

**Alarm Field:** `AlarmCoolantLow`  
**Threshold:** 3 occurrences in 24 hours  
**Priority:** Medium

#### Work Order Details

**Task Number:** PM-LATHE-005  
**Frequency:** As needed (triggered by threshold breach)  
**Work Performed By:** Maintenance Department  
**Standard Hours:** 2.5  
**Overtime Hours:** 0.5 (if after hours)

#### Work Description

Inspect coolant system for leaks or blockages. Check coolant pump operation and flow rate. Verify coolant level sensor functionality. Inspect coolant filter and replace if clogged. Check coolant lines for kinks or restrictions. Verify coolant temperature is within operating range. Refill coolant reservoir to proper level. Prime coolant system to remove air. Test coolant flow at all tool positions. Check coolant concentration and adjust if needed. Clean coolant system components. Document coolant system condition and update maintenance schedule.

#### Required Parts & Components

| Part # | Description | Quantity | Qty in Stock | Location |
|--------|-------------|----------|--------------|----------|
| LATHE-PUMP-401 | Coolant Pump Assembly | 1 | Check stock | Warehouse C-70 |
| LATHE-FILTER-402 | Coolant Filter Element | 1 | Check stock | Warehouse C-75 |
| LATHE-SENS-403 | Coolant Level Sensor | 1 | Check stock | Warehouse C-12 |
| LATHE-LINE-404 | Coolant Line Assembly | 1 | Check stock | Warehouse C-80 |

#### Materials Used

| Description | Quantity | Part # |
|------------|----------|--------|
| Coolant concentrate | 5L | COOL-CONC-001 |
| Filter cleaning solution | 500ml | CLN-FILTER-001 |
| Coolant system cleaner | 1L | CLN-COOL-001 |

#### Special Instructions

- Check coolant concentration with refractometer
- Verify coolant flow to all tool positions
- Test coolant temperature control system
- Document coolant level and concentration
- Update coolant maintenance schedule

---

## Standard Lathe Machine Parts Inventory

The following parts are commonly used in lathe maintenance work orders:

| Part # | Description | Typical Location |
|--------|-------------|------------------|
| LATHE-SPIN-001 | Spindle Bearing Set | Warehouse C-10 |
| LATHE-CHUCK-101 | Chuck Jaw Set (3-jaw) | Warehouse C-25 |
| LATHE-TOOL-301 | Tool Holder Assembly | Warehouse C-20 |
| LATHE-TURRET-302 | Tool Turret Assembly | Warehouse C-55 |
| LATHE-PUMP-401 | Coolant Pump Assembly | Warehouse C-70 |
| LATHE-FILTER-402 | Coolant Filter Element | Warehouse C-75 |
| LATHE-WAY-501 | Way Cover Assembly | Warehouse C-85 |
| LATHE-SCREW-502 | Ball Screw Assembly | Warehouse C-90 |
| LATHE-SERVO-503 | Servo Motor Assembly | Warehouse C-95 |
| LATHE-TAIL-504 | Tailstock Assembly | Warehouse C-100 |

---

## Work Order Generation Notes

- Work orders are automatically generated when alarm thresholds are breached
- Manual work orders can also be created for preventive maintenance
- All work orders are linked to the specific machine ID
- Work order numbers are auto-generated in format: WO-YYYYMMDD-XXX
- Priority is automatically set based on alarm severity
- Standard hours and overtime hours are estimates and may vary

---

*This manual should be updated whenever maintenance procedures or thresholds change.*

