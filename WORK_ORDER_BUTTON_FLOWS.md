# Work Order Button Flows - What Happens When You Click

## 1. "Generate Work Order" Button Flow

### Location: Dashboard (`app/page.tsx` line 265-270)

**What happens:**
```
Click "Generate Work Order" Button
  ↓
setWorkOrderFormOpen(true) - Opens the form modal
  ↓
WorkOrderForm component receives props:
  - isOpen = true
  - machineId = selectedMachineId (from dropdown)
  - machine = selectedMachine (full machine object)
  - shopfloorName = lab name (from selectedLabId)
  ↓
useEffect Hook Triggers (when isOpen becomes true)
  ↓
Form Auto-Fills with:
```

### Fields Auto-Filled on Form Open:

1. **Work Order Number**: `WO-YYYYMMDD-XXX`
   - Example: `WO-20260111-697`
   - Generated from: Current date + random 3-digit number
   - Format: `WO-${dateStr}-${random}`

2. **Week Number**: Auto-calculated ISO week number
   - Example: `2` (for week 2 of the year)
   - Calculated from: Today's date using ISO week standard

3. **Week Of**: Today's date
   - Example: `2026-01-11`
   - Format: `YYYY-MM-DD`

4. **Shopfloor (Company Name)**: Lab name from dashboard
   - From: `shopfloorNameFromProps` (already selected)
   - Example: "Dawlance Lab" or "Production Floor A"

5. **Equipment Name**: Machine name from MongoDB
   - From: `machine.machineName` (from props)
   - Example: "CNC Machine A"

6. **Equipment Number**: Machine ID from MongoDB
   - From: `machine._id` (from props)
   - Example: "507f1f77bcf86cd799439011"

7. **Equipment Location**: Machine name
   - From: `machine.machineName` (from props)

8. **Equipment Description**: Machine description
   - From: `machine.description` (from MongoDB, if available)

9. **Priority**: "Medium" (default)

10. **Work Performed By**: "Maintenance Department" (default)

### What's NOT Filled:
- Task Number
- Frequency
- Standard Hours / Overtime Hours
- Work Description
- Special Instructions
- Parts & Materials
- Location Information (building, floor, room)
- Shop/Vendor Information

**Result**: Form opens with basic machine info and work order number, but work details are empty.

---

## 2. "AI Auto Fill" Button Flow

### Location: Work Order Form (`components/WorkOrderForm.tsx` line 359-600)

**What happens:**
```
Click "AI Auto Fill" Button
  ↓
handleGetPineconeInfo() function starts
  ↓
Step 0: Get Machine & Shopfloor Info (from props or API)
  ↓
Step 1: Determine Alarm/Issue Type
  ├─ IF alarmType provided: Use it
  └─ ELSE:
      ├─ Check alarm thresholds (last 24h)
      │  ├─ IF alarms exceeded: Use first exceeded alarm
      │  └─ ELSE: Check downtime
      │     ├─ IF downtime ≥ 10%: Use vibration documents
      │     └─ ELSE: Show message, stop
  ↓
Step 2: Query Pinecone Vector Database
  ├─ Create embedding from alarm/issue type
  ├─ Search maintenance manuals or vibration docs
  └─ Get most relevant maintenance information
  ↓
Step 3: AI Extraction (OpenAI GPT-3.5-turbo)
  ├─ LLM reads maintenance manual context
  ├─ Extracts structured work order data
  └─ Returns JSON with all form fields
  ↓
Step 4: Fill Form Fields
```

### Fields Filled by AI Auto Fill:

**From MongoDB (Priority - Always Used):**
- Shopfloor (Company Name)
- Equipment Name, Number, Location, Description

**From AI/Pinecone (Fills Empty Fields):**
- Priority (High, Medium, Low, Critical)
- Task Number (e.g., "PM-BF-001")
- Frequency (e.g., "Weekly", "Monthly")
- Work Performed By
- Standard Hours (e.g., "2.0")
- Overtime Hours (e.g., "0.5")
- Work Description (detailed description)
- Work Performed
- Special Instructions (formatted as bullet points)
- Location Information (location, building, floor, room)
- Shop/Vendor Information (shop, vendor, address, phone, contact)
- Parts Array (part numbers, descriptions, quantities)
- Materials Array (descriptions, quantities)

**Result**: Form is fully populated with maintenance information from the manual.

---

## Complete Flow Comparison

### "Generate Work Order" → Form Opens
```
✅ Work Order No: WO-20260111-697
✅ Week No: 2
✅ Week Of: 2026-01-11
✅ Shopfloor: "Dawlance Lab"
✅ Equipment Name: "CNC Machine A"
✅ Equipment Number: "507f1f77bcf86cd799439011"
✅ Equipment Location: "CNC Machine A"
✅ Equipment Description: (if available)
✅ Priority: "Medium"
✅ Work Performed By: "Maintenance Department"
❌ Task Number: (empty)
❌ Work Description: (empty)
❌ Parts: (empty)
❌ Materials: (empty)
```

### "AI Auto Fill" → After Clicking
```
✅ All fields from "Generate Work Order" (preserved)
✅ Task Number: "PM-BF-001" (from manual)
✅ Frequency: "Weekly" (from manual)
✅ Work Description: "Detailed description..." (from manual)
✅ Special Instructions: "- Instruction 1\n- Instruction 2" (from manual)
✅ Parts: [{partNumber: "...", description: "...", ...}] (from manual)
✅ Materials: [{description: "...", quantity: "..."}] (from manual)
✅ Location, Building, Floor, Room (from manual)
✅ Shop, Vendor, Vendor Address, etc. (from manual)
✅ Standard Hours, Overtime Hours (from manual)
```

---

## Key Differences

| Aspect | Generate Work Order | AI Auto Fill |
|--------|-------------------|--------------|
| **When** | Opens the form | After form is open |
| **What it does** | Opens modal + fills basic info | Fills work details from AI |
| **Data source** | MongoDB (machine/lab) | Pinecone + OpenAI |
| **Fields filled** | ~10 basic fields | ~20+ detailed fields |
| **Time** | Instant | 1.5-4 seconds |
| **Requires** | Machine selected | Machine + (alarm OR downtime) |

---

## Why Fields Are Pre-Filled

When you click "Generate Work Order":
- You've already selected a **shopfloor/lab** from dropdown
- You've already selected a **machine** from dropdown
- The form uses this **already-selected data** to pre-fill:
  - Shopfloor name (from selected lab)
  - Equipment info (from selected machine)
  - Work order number (auto-generated)
  - Week number/date (auto-calculated)

This saves time - you don't have to manually enter machine info that's already known!

---

## Summary

1. **"Generate Work Order"**: Opens form with basic machine info pre-filled (from your selections)
2. **"AI Auto Fill"**: Fills detailed work order information from maintenance manuals using AI

The form is designed to be **smart** - it uses what you've already selected to save you time!

