# Exact Fields Filled - Generate Work Order vs AI Auto Fill

## When You Click "Generate Work Order"

**ONLY these fields are filled (everything else is EMPTY):**

1. ✅ **workOrderNo**: `WO-YYYYMMDD-XXX` (e.g., `WO-20260111-697`)
   - Auto-generated from current date + random number

2. ✅ **weekNo**: ISO week number (e.g., `2`)
   - Auto-calculated from today's date

3. ✅ **weekOf**: Today's date (e.g., `2026-01-11`)
   - Format: `YYYY-MM-DD`

4. ✅ **companyName** (Shopfloor): Lab name from selected shopfloor
   - From: `shopfloorNameFromProps` (dashboard selection)

5. ✅ **equipmentName**: Machine name from selected machine
   - From: `machine.machineName` (MongoDB)

6. ✅ **equipmentNumber**: Machine ID from selected machine
   - From: `machine._id` (MongoDB)

7. ✅ **equipmentLocation**: Machine name
   - From: `machine.machineName` (MongoDB)

8. ✅ **equipmentDescription**: Machine description (if available)
   - From: `machine.description` (MongoDB)

9. ✅ **machineId**: Machine ID (internal, not visible in form)
   - From: `machine._id` (MongoDB)

10. ✅ **machineType**: Machine type (internal)
    - From: props

11. ✅ **alarmType**: Alarm type if provided (internal)
    - From: props (usually empty)

**ALL OTHER FIELDS ARE EMPTY:**
- ❌ priority: **EMPTY**
- ❌ location, building, floor, room: **EMPTY**
- ❌ specialInstructions: **EMPTY**
- ❌ shop, vendor, vendorAddress, vendorPhone, vendorContact: **EMPTY**
- ❌ taskNumber: **EMPTY**
- ❌ frequency: **EMPTY**
- ❌ workPerformedBy: **EMPTY**
- ❌ standardHours: **EMPTY**
- ❌ overtimeHours: **EMPTY**
- ❌ workDescription: **EMPTY**
- ❌ workPerformed: **EMPTY**
- ❌ parts: **EMPTY** (empty array)
- ❌ materials: **EMPTY** (empty array)

---

## When You Click "AI Auto Fill"

**Fills these ADDITIONAL fields (from AI/Pinecone):**

1. ✅ **priority**: From maintenance manual (e.g., "High", "Medium", "Low", "Critical")

2. ✅ **taskNumber**: From maintenance manual (e.g., "PM-BF-001")

3. ✅ **frequency**: From maintenance manual (e.g., "Weekly", "Monthly")

4. ✅ **workPerformedBy**: From maintenance manual (e.g., "Maintenance Department")

5. ✅ **standardHours**: From maintenance manual (e.g., "2.0")

6. ✅ **overtimeHours**: From maintenance manual (e.g., "0.5")

7. ✅ **workDescription**: Detailed work description from maintenance manual

8. ✅ **workPerformed**: Work performed description (if in manual)

9. ✅ **specialInstructions**: Special instructions formatted as bullet points

10. ✅ **location**: General location from manual

11. ✅ **building**: Building name/number from manual

12. ✅ **floor**: Floor number from manual

13. ✅ **room**: Room number from manual

14. ✅ **shop**: Shop/department name from manual

15. ✅ **vendor**: Vendor name from manual (if mentioned)

16. ✅ **vendorAddress**: Vendor address from manual (if mentioned)

17. ✅ **vendorPhone**: Vendor phone from manual (if mentioned)

18. ✅ **vendorContact**: Vendor contact person from manual (if mentioned)

19. ✅ **parts**: Array of parts from manual
    - Each part has: partNumber, description, quantity, qtyInStock, location

20. ✅ **materials**: Array of materials from manual
    - Each material has: description, quantity, partNumber

**Note**: AI Auto Fill preserves fields already filled by "Generate Work Order":
- Keeps: workOrderNo, weekNo, weekOf, companyName, equipment fields
- Only fills fields that are empty or adds to existing data

---

## Summary Table

| Field | Generate Work Order | AI Auto Fill |
|-------|-------------------|--------------|
| **workOrderNo** | ✅ Filled | ✅ Preserved |
| **weekNo** | ✅ Filled | ✅ Preserved |
| **weekOf** | ✅ Filled | ✅ Preserved |
| **companyName** (Shopfloor) | ✅ Filled | ✅ Preserved |
| **equipmentName** | ✅ Filled | ✅ Preserved |
| **equipmentNumber** | ✅ Filled | ✅ Preserved |
| **equipmentLocation** | ✅ Filled | ✅ Preserved |
| **equipmentDescription** | ✅ Filled | ✅ Preserved |
| **priority** | ❌ Empty | ✅ Filled |
| **taskNumber** | ❌ Empty | ✅ Filled |
| **frequency** | ❌ Empty | ✅ Filled |
| **workPerformedBy** | ❌ Empty | ✅ Filled |
| **standardHours** | ❌ Empty | ✅ Filled |
| **overtimeHours** | ❌ Empty | ✅ Filled |
| **workDescription** | ❌ Empty | ✅ Filled |
| **workPerformed** | ❌ Empty | ✅ Filled |
| **specialInstructions** | ❌ Empty | ✅ Filled |
| **location** | ❌ Empty | ✅ Filled |
| **building** | ❌ Empty | ✅ Filled |
| **floor** | ❌ Empty | ✅ Filled |
| **room** | ❌ Empty | ✅ Filled |
| **shop** | ❌ Empty | ✅ Filled |
| **vendor** | ❌ Empty | ✅ Filled |
| **vendorAddress** | ❌ Empty | ✅ Filled |
| **vendorPhone** | ❌ Empty | ✅ Filled |
| **vendorContact** | ❌ Empty | ✅ Filled |
| **parts** | ❌ Empty | ✅ Filled |
| **materials** | ❌ Empty | ✅ Filled |

---

## Code Location

- **Generate Work Order**: `components/WorkOrderForm.tsx` lines 142-159 (useEffect when form opens)
- **AI Auto Fill**: `components/WorkOrderForm.tsx` lines 524-594 (handleGetPineconeInfo function)

