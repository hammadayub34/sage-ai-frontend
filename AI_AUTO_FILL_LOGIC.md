# AI Auto Fill Logic - Complete Flow

## Overview
The AI Auto Fill uses a **3-stage pipeline** combining:
1. **Threshold-based alarm detection** (optional)
2. **Vector similarity search** (Pinecone)
3. **LLM-based information extraction** (OpenAI GPT-3.5-turbo)

---

## Complete Logic Flow

```
┌─────────────────────────────────────────────────────────────┐
│  USER CLICKS "AI Auto Fill" BUTTON                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 0: VALIDATION                                          │
│  - Check if machineId exists                                 │
│  - If missing → Show error toast, STOP                      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: DETERMINE ALARM TYPE                               │
│                                                              │
│  IF alarmType is provided:                                   │
│    → Use provided alarmType                                  │
│                                                              │
│  ELSE (no alarmType):                                        │
│    → Call /api/work-order/check-thresholds                  │
│    → Query InfluxDB for alarm occurrences in last 24h        │
│    → Check if any alarm exceeded 50 occurrences             │
│    → IF threshold exceeded:                                  │
│         → Use first exceeded alarm                            │
│    → ELSE:                                                   │
│         → Show info message, STOP                            │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: VECTOR EMBEDDING CREATION                           │
│  Location: /api/work-order/pinecone-fill                     │
│                                                              │
│  Query Text Construction:                                    │
│  "{alarmType} {machineType} maintenance work order           │
│   parts materials task number frequency hours                │
│   work description special instructions"                    │
│                                                              │
│  → Create embedding using OpenAI text-embedding-3-small      │
│  → Converts text → 1536-dimensional vector                  │
│  → This vector represents semantic meaning of the query      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: VECTOR SIMILARITY SEARCH (Pinecone)                │
│                                                              │
│  Pinecone Query:                                             │
│  - Vector: Query embedding (1536 dimensions)                 │
│  - topK: 1 (get most relevant match)                         │
│  - Filter:                                                    │
│    * document_type == 'maintenance_work_order'              │
│    * machine_type == {machineType} (if provided)              │
│                                                              │
│  How it works:                                                │
│  - Pinecone compares query vector with all stored vectors    │
│  - Uses cosine similarity to find closest match              │
│  - Returns the most semantically similar maintenance manual   │
│    chunk that contains relevant information                  │
│                                                              │
│  → Returns: Maintenance manual content (text)                 │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 4: LLM-BASED INFORMATION EXTRACTION                   │
│  Model: OpenAI GPT-3.5-turbo                                 │
│                                                              │
│  Prompt Structure:                                           │
│  1. System Message:                                           │
│     "You are a helpful assistant that extracts structured     │
│      work order information from maintenance manuals.         │
│      Always return valid JSON only..."                       │
│                                                              │
│  2. User Prompt:                                             │
│     "Based on the following maintenance work order manual     │
│      information, extract and structure work order details     │
│      for {alarmType} on {machineId}."                        │
│                                                              │
│     Maintenance Manual Context:                               │
│     {context from Pinecone}                                   │
│                                                              │
│     Please extract and return a JSON object with:             │
│     - priority, equipmentName, equipmentNumber, ...           │
│     - location, building, floor, room                        │
│     - shop, vendor, vendorAddress, ...                       │
│     - taskNumber, frequency, standardHours, ...              │
│     - workDescription, specialInstructions                   │
│     - parts[], materials[]                                   │
│                                                              │
│  LLM Processing:                                              │
│  - Reads maintenance manual context                           │
│  - Extracts relevant information                              │
│  - Structures data into JSON format                          │
│  - Formats special instructions as bullet points             │
│  - Returns structured work order data                         │
│                                                              │
│  → Returns: JSON object with all form fields                  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 5: JSON PARSING & VALIDATION                           │
│                                                              │
│  - Extract JSON from LLM response (handle markdown blocks)    │
│  - Parse JSON string → JavaScript object                      │
│  - Validate structure                                         │
│  - If parsing fails → Return error                           │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 6: FORM FIELD POPULATION                               │
│  Location: WorkOrderForm.tsx                                 │
│                                                              │
│  Field Mapping Logic:                                         │
│                                                              │
│  For each field:                                              │
│    IF API returned value exists:                             │
│      → Use API value                                          │
│    ELSE:                                                      │
│      → Use existing form value (preserve user input)         │
│                                                              │
│  Special Cases:                                               │
│  - equipmentName/Number/Location:                            │
│    → API value OR machineId OR existing value                │
│  - workOrderNo: Always preserve (auto-generated)            │
│  - machineId, machineType, alarmType: Always preserve         │
│  - companyName: Always preserve (default)                     │
│                                                              │
│  Parts & Materials:                                           │
│  - If API returns parts[] array:                              │
│    → Replace entire parts array                               │
│  - If API returns materials[] array:                         │
│    → Replace entire materials array                           │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 7: USER FEEDBACK                                       │
│                                                              │
│  - Show success toast notification                           │
│  - Display info message: "Form filled for {AlarmName}"        │
│  - Log timing information to console                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Technologies & Concepts

### 1. **Vector Embeddings**
- **What**: Numerical representation of text meaning
- **Model**: OpenAI `text-embedding-3-small` (1536 dimensions)
- **Purpose**: Convert text queries into vectors for similarity search
- **Example**: 
  - Query: "AlarmFault bottlefiller maintenance work order"
  - → Vector: [0.123, -0.456, 0.789, ...] (1536 numbers)

### 2. **Vector Similarity Search (Pinecone)**
- **What**: Find documents with similar meaning
- **Method**: Cosine similarity (measures angle between vectors)
- **Why**: Finds relevant maintenance manual sections even if exact words don't match
- **Example**: 
  - Query: "AlarmFault maintenance"
  - Finds: Manual section about "Fault Alarm troubleshooting procedures"

### 3. **LLM Information Extraction**
- **What**: AI model extracts structured data from unstructured text
- **Model**: GPT-3.5-turbo (faster, cost-effective)
- **Temperature**: 0.3 (low = more deterministic, consistent)
- **Purpose**: Convert maintenance manual text → structured JSON

### 4. **Fallback Logic**
- **Equipment fields**: API value → machineId → existing value
- **Other fields**: API value → existing value
- **Preserved fields**: workOrderNo, machineId, machineType, companyName

---

## Data Flow Example

```
Input:
  machineId: "BF-001"
  alarmType: "AlarmFault"
  machineType: "bottlefiller"

Step 1: Query Text
  "AlarmFault bottlefiller maintenance work order parts materials..."

Step 2: Embedding
  [0.123, -0.456, 0.789, ...] (1536 dimensions)

Step 3: Pinecone Search
  Finds: "Section 4.2: Fault Alarm Troubleshooting
          When AlarmFault is triggered, check the following:
          1. Verify sensor connections
          2. Check power supply
          Required parts: Sensor-001, Cable-002
          Estimated time: 2 hours"

Step 4: LLM Extraction
  {
    "priority": "High",
    "taskNumber": "PM-BF-004",
    "workDescription": "Troubleshoot and resolve AlarmFault...",
    "standardHours": "2.0",
    "parts": [
      {"partNumber": "Sensor-001", "quantity": "1"},
      {"partNumber": "Cable-002", "quantity": "1"}
    ]
  }

Step 5: Form Population
  - priority field → "High"
  - taskNumber field → "PM-BF-004"
  - workDescription field → "Troubleshoot and resolve..."
  - parts table → 2 rows with sensor and cable
```

---

## Performance Metrics

The API tracks timing for each step:
- **Embedding Time**: ~100-300ms (converting text to vector)
- **Pinecone Time**: ~200-500ms (vector similarity search)
- **LLM Time**: ~1000-3000ms (AI extraction)
- **Total Time**: ~1.5-4 seconds

---

## Error Handling

1. **Missing machineId**: Show error toast, stop
2. **No threshold exceeded**: Show info message, stop
3. **Pinecone no results**: Return error "No maintenance information found"
4. **LLM parsing error**: Return error "Failed to parse work order data"
5. **API errors**: Show error toast with specific message

---

## Why This Approach?

1. **Vector Search**: Finds relevant info even with different wording
2. **LLM Extraction**: Handles unstructured text → structured data
3. **Fallback Logic**: Preserves user input, uses defaults when needed
4. **Filtering**: Only searches maintenance work orders (not other docs)
5. **Machine Type Filter**: Narrows search to relevant machine manuals

