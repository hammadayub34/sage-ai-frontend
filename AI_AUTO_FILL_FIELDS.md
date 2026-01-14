# AI Auto Fill - Fields Being Filled

This document lists all form fields that are populated when clicking the "AI Auto Fill" button.

## ✅ Fields Currently Being Filled

### Header Section
- **priority** - Priority level (High, Medium, Low, Critical) extracted from maintenance manual

### Equipment Information
- **equipmentName** - Equipment name from manual (falls back to machineId if not found)
- **equipmentNumber** - Equipment number/ID from manual (falls back to machineId if not found)
- **equipmentLocation** - Equipment location from manual (falls back to machineId if not found)
- **equipmentDescription** - Equipment description from manual

### Location Information
- **location** - General location (e.g., Production Floor, Warehouse)
- **building** - Building name/number
- **floor** - Floor number
- **room** - Room number

### Special Instructions
- **specialInstructions** - Formatted as bullet points with dashes (-)

### Shop/Vendor Information
- **shop** - Shop or department name (e.g., Maintenance Shop, Electrical Shop)
- **vendor** - Vendor name if mentioned in manual
- **vendorAddress** - Vendor address if mentioned
- **vendorPhone** - Vendor phone if mentioned
- **vendorContact** - Vendor contact person if mentioned

### Task Information
- **taskNumber** - Task number from manual (e.g., PM-BF-001)
- **frequency** - Frequency (e.g., Weekly, Monthly, Quarterly)
- **workPerformedBy** - Department/shop (defaults to "Maintenance Department")
- **standardHours** - Standard hours as number (e.g., 2.0)
- **overtimeHours** - Overtime hours as number (e.g., 0.5)

### Work Description
- **workDescription** - Detailed work description (formatted as clear sentences or bullet points)
- **workPerformed** - Work performed description (can be similar to workDescription)

### Parts & Materials
- **parts[]** - Array of parts with:
  - partNumber
  - description
  - quantity
  - qtyInStock
  - location
- **materials[]** - Array of materials with:
  - description
  - quantity
  - partNumber

## ⚠️ Fields NOT Auto-Filled (Preserved/Manual)

These fields are preserved from existing form state or require manual entry:

- **companyName** - Preserved (default: "MQTT-OT Network Production System")
- **workOrderNo** - Preserved (auto-generated when form opens)
- **weekNo** - Manual entry
- **weekOf** - Preserved (auto-set to current date when form opens)
- **workCompleted** - Preserved (checkbox, defaults to false)
- **machineId** - Preserved (from props)
- **machineType** - Preserved (from props)
- **alarmType** - Set from threshold check or props

## How It Works

1. **Threshold Check** (if no alarmType provided):
   - Checks if any alarms exceeded 50 occurrences in last 24 hours
   - Uses first exceeded alarm if found

2. **Pinecone Query**:
   - Creates embedding from alarm type and machine type
   - Searches maintenance manual documents in Pinecone
   - Retrieves most relevant maintenance information

3. **AI Extraction**:
   - Sends Pinecone context to OpenAI GPT-3.5-turbo
   - LLM extracts structured data matching all form fields
   - Returns JSON with all available information

4. **Form Population**:
   - Spreads work order data into form fields
   - Falls back to existing values if field not provided
   - Equipment fields use machineId as fallback
   - Parts and materials arrays are set separately

## Testing

To test the AI Auto Fill:
1. Open Work Order Form with a machineId
2. Click "AI Auto Fill" button
3. Check browser console for detailed logs
4. Verify all fields are populated correctly
5. Check toast notifications for success/error messages

