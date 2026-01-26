# Alarm Response Manual
## MQTT-OT Network Production System

**Version:** 1.0  
**Last Updated:** November 26, 2025  
**Document Type:** Operational Procedure Manual

---

## Table of Contents

1. [Bottle Filler Machine Alarms](#bottle-filler-machine-alarms)
2. [CNC Lathe Machine Alarms](#cnc-lathe-machine-alarms)
3. [General Alarm Response Procedures](#general-alarm-response-procedures)
4. [Alarm Severity Classifications](#alarm-severity-classifications)

---

## Bottle Filler Machine Alarms

### Alarm: LowProductLevel

**Alarm Type:** Warning  
**Severity:** Medium  
**Alarm Field:** `AlarmLowProductLevel`

#### When Alarm is RAISED (True):
**What it means:**
- The product tank level has dropped below the minimum operating threshold (typically < 20% capacity)
- The low-level sensor has detected insufficient product volume
- Production may be interrupted if not addressed

**Immediate Actions Required:**
1. **STOP** the filling operation immediately to prevent air from entering the filling system
2. Check the product tank level indicator on the HMI
3. Verify the low-level sensor is functioning correctly (check for sensor blockage or contamination)
4. **DO NOT** restart production until the issue is resolved

**Troubleshooting Steps:**
1. Inspect the product tank visually
2. Check for leaks in the supply lines or tank
3. Verify the product supply pump is operating correctly
4. Check if the product supply line is blocked or kinked
5. Review production logs to identify if consumption rate exceeded supply rate

**Resolution Steps:**
1. Refill the product tank to at least 80% capacity
2. Prime the filling system to remove any air bubbles
3. Verify the low-level sensor reading returns to normal (> 20%)
4. Reset the alarm on the HMI
5. Gradually restart production and monitor tank level

#### When Alarm is CLEARED (False):
**Status:** ✅ **ISSUE RESOLVED**

**What it means:**
- The product tank level has been restored above the minimum threshold
- The low-level sensor now reads normal levels
- The system is ready to resume normal operations

**Verification Steps:**
1. Confirm tank level is above 20% on the HMI
2. Verify no air bubbles in the filling lines
3. Check that the supply pump is maintaining adequate flow
4. Monitor the first few production cycles to ensure stable operation

**Post-Resolution:**
- Document the incident in the production log
- Note the time to resolution
- Review if preventive measures are needed (e.g., increase supply rate, adjust reorder point)

---

### Alarm: Overfill

**Alarm Type:** Critical  
**Severity:** High  
**Alarm Field:** `AlarmOverfill`

#### When Alarm is RAISED (True):
**What it means:**
- A bottle has been filled beyond the maximum acceptable volume (exceeds tolerance limit)
- The fill level sensor detected product above the target fill line
- Product quality and regulatory compliance may be compromised

**Immediate Actions Required:**
1. **EMERGENCY STOP** the filling line immediately
2. Isolate the affected bottle(s) from the production line
3. Do not allow overfilled bottles to proceed to capping or labeling
4. Notify Quality Control immediately

**Troubleshooting Steps:**
1. Check the fill valve operation - verify it's closing properly
2. Inspect the fill level sensor calibration
3. Review the fill time setpoint - may need adjustment
4. Check for mechanical issues with the fill valve actuator
5. Verify the fill flow rate is within specification
6. Check for air in the filling lines causing inconsistent flow

**Resolution Steps:**
1. Remove all overfilled bottles from the line
2. Calibrate the fill level sensor if needed
3. Adjust fill time setpoint if consistently overfilling
4. Repair or replace fill valve if mechanical issue found
5. Prime the system to remove air bubbles
6. Perform test fills and verify fill volume is within tolerance
7. Reset the alarm and restart production with close monitoring

#### When Alarm is CLEARED (False):
**Status:** ✅ **ISSUE RESOLVED**

**What it means:**
- The fill system has been corrected and is operating within tolerance
- Fill volumes are now within acceptable limits
- The system is ready to resume production

**Verification Steps:**
1. Confirm fill volumes are within ±5mL of target (500mL)
2. Verify fill valve is closing properly on each cycle
3. Check that fill time is consistent across multiple cycles
4. Perform quality check on first 10 bottles after restart

**Post-Resolution:**
- Document the incident and root cause
- Update preventive maintenance schedule for fill valve
- Review quality control procedures
- Note any bottles that need to be scrapped

---

### Alarm: Underfill

**Alarm Type:** Critical  
**Severity:** High  
**Alarm Field:** `AlarmUnderfill`

#### When Alarm is RAISED (True):
**What it means:**
- A bottle has been filled below the minimum acceptable volume (below tolerance limit)
- The fill level sensor detected insufficient product volume
- Product may not meet regulatory requirements or customer specifications

**Immediate Actions Required:**
1. **STOP** the filling operation
2. Isolate the affected bottle(s) from the production line
3. Do not allow underfilled bottles to proceed to packaging
4. Notify Quality Control

**Troubleshooting Steps:**
1. Check the fill valve operation - verify it's opening fully
2. Inspect the fill level sensor for contamination or misalignment
3. Review the fill time setpoint - may be too short
4. Check for blockages in the fill nozzle
5. Verify the fill flow rate is adequate
6. Check for leaks in the filling system
7. Verify product tank pressure is within specification

**Resolution Steps:**
1. Remove all underfilled bottles from the line
2. Clean or replace fill nozzle if blocked
3. Adjust fill time setpoint if consistently underfilling
4. Repair any leaks in the filling system
5. Verify tank pressure is correct (10-15 PSI)
6. Check fill flow rate (should be 10-50 L/min when filling)
7. Perform test fills and verify fill volume is within tolerance
8. Reset the alarm and restart production

#### When Alarm is CLEARED (False):
**Status:** ✅ **ISSUE RESOLVED**

**What it means:**
- The fill system is now operating correctly
- Fill volumes are within acceptable limits
- Production can resume

**Verification Steps:**
1. Confirm fill volumes meet minimum requirements
2. Verify fill valve opens fully on each cycle
3. Check that fill time is sufficient
4. Perform quality check on first 10 bottles after restart

**Post-Resolution:**
- Document the incident and corrective actions
- Review fill time settings
- Update maintenance schedule for fill system components

---

### Alarm: CapMissing

**Alarm Type:** Warning  
**Severity:** Medium  
**Alarm Field:** `AlarmCapMissing`

#### When Alarm is RAISED (True):
**What it means:**
- A bottle has reached the capping station without a cap being applied
- The cap sensor detected a missing cap
- The bottle may be rejected or require manual intervention

**Immediate Actions Required:**
1. **PAUSE** the conveyor to prevent uncapped bottles from proceeding
2. Manually cap the affected bottle(s) if possible
3. Check the capping station operation
4. Verify cap supply is available

**Troubleshooting Steps:**
1. Check the cap hopper - verify caps are available and not jammed
2. Inspect the cap feeder mechanism for blockages
3. Check the capping motor operation
4. Verify the cap sensor is functioning correctly
5. Check for mechanical issues with the capping head
6. Review cap orientation - caps may be upside down or misaligned

**Resolution Steps:**
1. Refill cap hopper if empty
2. Clear any jams in the cap feeder
3. Adjust cap sensor if misaligned
4. Repair or replace capping motor if faulty
5. Verify cap orientation in the hopper
6. Test capping operation manually
7. Reset the alarm and restart production

#### When Alarm is CLEARED (False):
**Status:** ✅ **ISSUE RESOLVED**

**What it means:**
- The capping system is now operating correctly
- Caps are being applied properly to all bottles
- Production can continue normally

**Verification Steps:**
1. Confirm caps are being applied consistently
2. Verify cap sensor is detecting caps properly
3. Check that cap hopper has adequate supply
4. Monitor first 20 bottles after restart

**Post-Resolution:**
- Document the incident
- Review cap hopper refill schedule
- Update maintenance schedule for capping station

---

### Alarm: Fault

**Alarm Type:** Critical  
**Severity:** High  
**Alarm Field:** `AlarmFault`

#### When Alarm is RAISED (True):
**What it means:**
- A general system fault has been detected
- Multiple subsystems may be affected
- System safety may be compromised

**Immediate Actions Required:**
1. **EMERGENCY STOP** the entire production line
2. Do not attempt to restart until fault is cleared
3. Check all safety systems (E-Stop, safety gates, etc.)
4. Review the HMI for specific fault codes
5. Notify maintenance and supervisor immediately

**Troubleshooting Steps:**
1. Review the fault log on the HMI for specific error codes
2. Check all safety interlocks
3. Verify all emergency stops are in the released position
4. Check for electrical faults (overcurrent, short circuit)
5. Inspect mechanical components for damage
6. Review system status indicators

**Resolution Steps:**
1. Identify and resolve the root cause of the fault
2. Clear any fault codes on the HMI
3. Reset all safety systems
4. Perform a complete system check
5. Verify all subsystems are operational
6. Reset the alarm
7. Perform a controlled restart with close monitoring

#### When Alarm is CLEARED (False):
**Status:** ✅ **ISSUE RESOLVED**

**What it means:**
- The system fault has been cleared
- All safety systems are operational
- The system is ready for controlled restart

**Verification Steps:**
1. Confirm all fault codes are cleared
2. Verify all safety systems are operational
3. Check that all subsystems are ready
4. Perform pre-start checklist

**Post-Resolution:**
- Document the fault and resolution in detail
- Update maintenance records
- Review if preventive measures are needed
- Conduct post-incident review if fault was significant

---

## CNC Lathe Machine Alarms

### Alarm: SpindleOverload

**Alarm Type:** Critical  
**Severity:** High  
**Alarm Field:** `AlarmSpindleOverload`

#### When Alarm is RAISED (True):
**What it means:**
- The spindle motor load has exceeded 90% of maximum capacity
- The spindle is experiencing excessive resistance or cutting forces
- Continued operation may cause motor damage or tool breakage

**Immediate Actions Required:**
1. **STOP** the machining operation immediately (spindle will auto-stop)
2. Do not attempt to restart until load is reduced
3. Check the spindle load indicator on the control panel
4. Verify the cutting tool condition

**Troubleshooting Steps:**
1. Check the spindle load percentage on the HMI (should be < 90%)
2. Inspect the cutting tool for wear, damage, or breakage
3. Verify the cutting parameters (speed, feed rate, depth of cut) are within limits
4. Check for material hardness issues - material may be harder than expected
5. Inspect the workpiece for hard spots or inclusions
6. Verify the tool is properly clamped and not loose
7. Check for chip buildup that may be causing excessive load
8. Review the spindle motor temperature

**Resolution Steps:**
1. Replace the cutting tool if worn or damaged
2. Reduce cutting parameters (lower feed rate or depth of cut)
3. Clear any chip buildup around the tool and workpiece
4. Verify material specifications match the program
5. Check and adjust tool offsets if needed
6. Allow spindle to cool if temperature is high
7. Reset the alarm on the control panel
8. Restart with reduced cutting parameters and monitor load closely

#### When Alarm is CLEARED (False):
**Status:** ✅ **ISSUE RESOLVED**

**What it means:**
- The spindle load has returned to normal operating levels (< 90%)
- The cutting operation is proceeding within safe parameters
- The system is operating normally

**Verification Steps:**
1. Confirm spindle load is consistently below 90%
2. Verify cutting parameters are appropriate
3. Check that tool is cutting smoothly
4. Monitor spindle temperature
5. Review part quality for any issues

**Post-Resolution:**
- Document the incident and corrective actions
- Review cutting parameters and tool selection
- Update tool change schedule if tool wear was the cause
- Consider adjusting feed rates or speeds for future operations

---

### Alarm: ChuckNotClamped

**Alarm Type:** Critical  
**Severity:** High  
**Alarm Field:** `AlarmChuckNotClamped`

#### When Alarm is RAISED (True):
**What it means:**
- The workpiece chuck is not properly clamped
- The chuck clamping sensor indicates the workpiece is not secured
- Operating the machine in this condition is extremely dangerous - workpiece may be ejected

**Immediate Actions Required:**
1. **EMERGENCY STOP** the machine immediately
2. **DO NOT** attempt to start spindle or any axis movement
3. Verify the workpiece is still in the chuck (do not approach if spindle is rotating)
4. Check the chuck clamping pressure indicator
5. Notify supervisor and maintenance immediately

**Troubleshooting Steps:**
1. Check the chuck clamping pressure gauge (should show adequate pressure)
2. Inspect the chuck clamping sensor for proper operation
3. Verify the workpiece is properly seated in the chuck jaws
4. Check for debris or chips preventing proper clamping
5. Inspect the chuck jaws for wear or damage
6. Verify the hydraulic or pneumatic clamping system is functioning
7. Check for leaks in the clamping system

**Resolution Steps:**
1. **ENSURE MACHINE IS STOPPED** before proceeding
2. Remove the workpiece and inspect chuck jaws
3. Clean chuck jaws and workpiece seating area
4. Replace chuck jaws if worn or damaged
5. Repair clamping system if hydraulic/pneumatic issue found
6. Reinstall workpiece and verify proper seating
7. Activate chuck clamping and verify pressure is adequate
8. Confirm clamping sensor indicates proper clamp
9. Reset the alarm on the control panel
10. Perform a test cycle with close monitoring

#### When Alarm is CLEARED (False):
**Status:** ✅ **ISSUE RESOLVED**

**What it means:**
- The workpiece is now properly clamped in the chuck
- The clamping sensor confirms secure clamping
- The machine is safe to operate

**Verification Steps:**
1. Confirm chuck clamping pressure is within specification
2. Verify clamping sensor shows proper clamp status
3. Check that workpiece is securely held (gentle manual check only)
4. Review clamping pressure history to ensure stability
5. Perform a low-speed test cycle before resuming normal operation

**Post-Resolution:**
- Document the incident in detail (safety critical)
- Review chuck maintenance schedule
- Update clamping pressure monitoring procedures
- Conduct safety review if workpiece was loose during operation

---

### Alarm: DoorOpen

**Alarm Type:** Critical  
**Severity:** High  
**Alarm Field:** `AlarmDoorOpen`

#### When Alarm is RAISED (True):
**What it means:**
- The machine safety door is open or not properly closed
- The door interlock sensor has detected an unsafe condition
- Machine operation is disabled for operator safety

**Immediate Actions Required:**
1. **DO NOT** attempt to override the door interlock
2. Verify the door is fully closed and latched
3. Check that no personnel are inside the machine enclosure
4. Inspect the door interlock sensor

**Troubleshooting Steps:**
1. Check the door position - ensure it's fully closed
2. Verify the door latch is engaged properly
3. Inspect the door interlock sensor for proper operation
4. Check for obstructions preventing door closure
5. Verify the interlock switch is not damaged
6. Check the interlock wiring for loose connections

**Resolution Steps:**
1. Close the door completely and verify latch engagement
2. Clean the door interlock sensor if contaminated
3. Repair or replace interlock switch if faulty
4. Remove any obstructions preventing proper door closure
5. Verify the door sensor indicates "CLOSED" on the HMI
6. Reset the alarm on the control panel
7. The machine will automatically enable operation when door is properly closed

#### When Alarm is CLEARED (False):
**Status:** ✅ **ISSUE RESOLVED**

**What it means:**
- The safety door is now properly closed and latched
- The door interlock sensor confirms safe condition
- Machine operation is enabled

**Verification Steps:**
1. Confirm door is fully closed and latched
2. Verify door sensor shows "CLOSED" status on HMI
3. Check that no warning lights are active
4. Ensure all personnel are clear of the machine

**Post-Resolution:**
- Document if door was left open unintentionally
- Review operator training on door safety procedures
- Update safety procedures if needed

---

### Alarm: ToolWear

**Alarm Type:** Warning  
**Severity:** Medium  
**Alarm Field:** `AlarmToolWear`

#### When Alarm is RAISED (True):
**What it means:**
- The cutting tool life has dropped below 30% of expected life
- The tool wear monitoring system indicates significant tool degradation
- Tool performance and part quality may be compromised

**Immediate Actions Required:**
1. **PAUSE** the current machining operation at a safe point
2. Do not continue with worn tool - part quality will be affected
3. Check the tool life percentage on the HMI
4. Inspect the cutting tool visually

**Troubleshooting Steps:**
1. Check the tool life percentage indicator (alarm triggers at < 30%)
2. Inspect the cutting tool for visible wear, chipping, or damage
3. Review the tool offset values - may need adjustment due to wear
4. Check part surface finish quality
5. Verify cutting parameters are appropriate for the tool condition
6. Review tool usage history

**Resolution Steps:**
1. Replace the cutting tool with a new tool
2. Update tool offsets if needed for the new tool
3. Reset the tool life counter for the new tool
4. Update tool number in the program if tool changed
5. Perform tool length measurement and update offsets
6. Reset the alarm on the control panel
7. Resume machining operation with the new tool
8. Monitor first few parts for quality

#### When Alarm is CLEARED (False):
**Status:** ✅ **ISSUE RESOLVED**

**What it means:**
- A new tool has been installed and tool life is reset
- The tool wear monitoring system shows normal tool condition
- Machining can continue with proper tool performance

**Verification Steps:**
1. Confirm new tool is properly installed and clamped
2. Verify tool offsets are correct
3. Check tool life percentage is reset to 100%
4. Perform test cut and verify part quality
5. Monitor tool performance during first few cycles

**Post-Resolution:**
- Document tool change and reason
- Update tool inventory records
- Review tool life expectations vs. actual performance
- Adjust tool change schedule if needed
- Analyze if cutting parameters need optimization

---

### Alarm: CoolantLow

**Alarm Type:** Warning  
**Severity:** Medium  
**Alarm Field:** `AlarmCoolantLow`

#### When Alarm is RAISED (True):
**What it means:**
- The coolant tank level has dropped below 20% capacity
- Insufficient coolant may cause poor chip evacuation and tool overheating
- Tool life and part quality may be affected

**Immediate Actions Required:**
1. **PAUSE** the machining operation if possible
2. Check the coolant level indicator on the control panel
3. Verify coolant flow to the cutting area
4. Do not continue extended operations with low coolant

**Troubleshooting Steps:**
1. Check the coolant tank level gauge (alarm triggers at < 20%)
2. Inspect for coolant leaks in the system
3. Verify the coolant pump is operating correctly
4. Check coolant flow rate at the tool
5. Inspect coolant lines for blockages
6. Review coolant consumption rate

**Resolution Steps:**
1. Refill the coolant tank to at least 80% capacity
2. Check coolant concentration (should be within specification)
3. Repair any leaks found in the coolant system
4. Clear any blockages in coolant lines or nozzles
5. Verify coolant pump is providing adequate flow
6. Check coolant temperature (should be within operating range)
7. Reset the alarm on the control panel
8. Resume machining operation and monitor coolant level

#### When Alarm is CLEARED (False):
**Status:** ✅ **ISSUE RESOLVED**

**What it means:**
- The coolant tank has been refilled above the minimum threshold
- Coolant level is now adequate for normal operation
- The system is ready to continue machining

**Verification Steps:**
1. Confirm coolant level is above 20% on the indicator
2. Verify coolant flow is adequate at the cutting tool
3. Check coolant concentration is correct
4. Monitor coolant level during operation
5. Ensure no leaks are present

**Post-Resolution:**
- Document the incident and coolant refill
- Review coolant consumption rate
- Update coolant refill schedule
- Check for leaks that may need repair
- Review if coolant concentration needs adjustment

---

## General Alarm Response Procedures

### Alarm Severity Classifications

**Critical (High Severity):**
- Requires immediate machine stop
- May affect safety, quality, or equipment damage
- Examples: Overfill, Underfill, Fault, SpindleOverload, ChuckNotClamped, DoorOpen

**Warning (Medium Severity):**
- May require operation pause
- Affects efficiency or quality but not immediately dangerous
- Examples: LowProductLevel, CapMissing, ToolWear, CoolantLow

### Standard Response Workflow

1. **Acknowledge Alarm**
   - Note the alarm type and machine ID
   - Check the timestamp of when alarm was raised
   - Review any associated fault codes

2. **Assess Situation**
   - Determine if immediate stop is required
   - Check if personnel safety is at risk
   - Evaluate impact on production

3. **Take Immediate Actions**
   - Follow alarm-specific procedures above
   - Ensure machine is in safe state
   - Isolate affected products/parts if needed

4. **Troubleshoot**
   - Follow troubleshooting steps for the specific alarm
   - Document findings
   - Identify root cause

5. **Resolve Issue**
   - Complete resolution steps
   - Verify system is ready to resume
   - Reset alarm when appropriate

6. **Verify Resolution**
   - Confirm alarm is cleared (turns false)
   - Perform verification steps
   - Monitor system during restart

7. **Document**
   - Record incident details
   - Note time to resolution
   - Update maintenance records
   - Review for preventive measures

### Alarm Clearing (False State)

When an alarm transitions from **True (RAISED)** to **False (CLEARED)**, the system indicates:

- ✅ **ISSUE RESOLVED** - The condition that caused the alarm has been corrected
- The system has returned to normal operating state
- Production can resume with appropriate verification

**Important Notes:**
- Always verify the root cause has been addressed, not just the symptom
- Perform verification steps before resuming full production
- Monitor the system closely after alarm clearance
- Document the resolution for future reference

---

## Contact Information

**Maintenance Department:** [Contact Info]  
**Quality Control:** [Contact Info]  
**Production Supervisor:** [Contact Info]  
**Emergency:** [Contact Info]

---

**Document Control:**
- This manual should be reviewed quarterly
- Updates should be made when new alarms are added or procedures change
- All operators should be trained on alarm response procedures

