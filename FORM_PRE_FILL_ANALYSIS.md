# Work Order Form - Pre-filled Fields Analysis

## Fields That Are Pre-filled When Form Opens

### 1. **Initial State (Hardcoded Defaults)**
These are set when the component first renders (lines 41-89):

| Field | Value | Source |
|-------|-------|--------|
| `companyName` | `'MQTT-OT Network Production System'` | Hardcoded default in `useState` |
| `priority` | `'Medium'` | Hardcoded default in `useState` |
| `workPerformedBy` | `'Maintenance Department'` | Hardcoded default in `useState` |
| `workOrderNo` | `''` (empty initially) | Empty string in `useState` |
| `weekOf` | `''` (empty initially) | Empty string in `useState` |
| All other fields | `''` (empty) | Empty strings in `useState` |

### 2. **useEffect Hook (When Form Opens)**
When `isOpen` becomes `true`, the `useEffect` hook (lines 100-178) runs and fills:

#### If `machineId` exists and machine info is fetched successfully:

| Field | Value | Source |
|-------|-------|--------|
| `companyName` | Lab name from database | Fetched from `/api/labs` using machine's `labId` |
| `equipmentName` | Machine name | From `/api/machines?machineId={machineId}` → `machine.machineName` |
| `equipmentNumber` | Machine ID | From props: `machineId` |
| `equipmentLocation` | Machine name | From `/api/machines?machineId={machineId}` → `machine.machineName` |
| `equipmentDescription` | Machine description | From `/api/machines?machineId={machineId}` → `machine.description` |
| `workOrderNo` | `WO-{YYYYMMDD}-{random}` | Generated: `WO-20241215-042` format |
| `weekOf` | Today's date | `new Date().toISOString().slice(0, 10)` |
| `machineId` | From props | `machineId` prop |
| `machineType` | From props | `machineType` prop (default: 'bottlefiller') |
| `alarmType` | From props | `alarmType` prop (default: '') |

#### If `machineId` doesn't exist or fetch fails:

| Field | Value | Source |
|-------|-------|--------|
| `workOrderNo` | `WO-{YYYYMMDD}-{random}` | Generated |
| `weekOf` | Today's date | Current date |
| `machineId` | From props | `machineId` prop |
| `machineType` | From props | `machineType` prop |
| `alarmType` | From props | `alarmType` prop |
| Equipment fields | Empty | Left empty (not filled) |

## Code Flow

```
1. Component Renders
   ↓
2. Initial State Set (useState)
   - companyName: 'MQTT-OT Network Production System'
   - priority: 'Medium'
   - workPerformedBy: 'Maintenance Department'
   - All others: empty
   ↓
3. Form Opens (isOpen = true)
   ↓
4. useEffect Hook Triggers
   ↓
5. IF machineId exists:
   ├─ Fetch /api/machines?machineId={machineId}
   ├─ Fetch /api/labs (to get lab name)
   └─ Fill fields with machine info
   ↓
6. ELSE:
   └─ Only fill workOrderNo and weekOf
```

## Current Behavior

When you click "Generate Work Order" button:

1. **Form opens** with these pre-filled:
   - ✅ `companyName`: Lab name (if machine has labId) OR default "MQTT-OT Network Production System"
   - ✅ `priority`: "Medium"
   - ✅ `workPerformedBy`: "Maintenance Department"
   - ✅ `workOrderNo`: Auto-generated (e.g., "WO-20241215-042")
   - ✅ `weekOf`: Today's date
   - ✅ `equipmentName`: Machine name (if machineId provided and fetch succeeds)
   - ✅ `equipmentNumber`: Machine ID (if machineId provided)
   - ✅ `equipmentLocation`: Machine name (if machineId provided and fetch succeeds)
   - ✅ `equipmentDescription`: Machine description (if available)

2. **All other fields** remain empty until:
   - User manually fills them, OR
   - User clicks "AI Auto Fill" button

## Potential Issues

1. **Weird IDs in equipment fields**: 
   - This happens if `machineId` is a MongoDB ObjectId (like "507f1f77bcf86cd799439011")
   - The code tries to fetch machine info, but if it fails, it might show the raw ID
   - **Fixed**: Now only fills if machine info is successfully fetched

2. **Company name might be wrong**:
   - Initially shows default "MQTT-OT Network Production System"
   - Then updates to lab name when machine info is fetched (async)
   - User might see it change

3. **Equipment fields might show IDs**:
   - If machine fetch fails, equipment fields should stay empty
   - But if `machineId` is passed and fetch partially succeeds, might show ID

## Recommendations

1. **Show loading state** while fetching machine info
2. **Don't pre-fill equipment fields** until machine info is confirmed
3. **Clear form** when it closes to avoid stale data
4. **Reset to defaults** when form reopens

