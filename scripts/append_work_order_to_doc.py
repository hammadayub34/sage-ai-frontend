#!/usr/bin/env python3
"""
Script to append a work order to the WORK_ORDERS_HISTORY.md document
Can be called with a JSON file path or run directly
"""
import os
import json
import sys
from pathlib import Path
from datetime import datetime

def append_work_order_to_doc(work_order_data: dict, doc_path: str = "WORK_ORDERS_HISTORY.md"):
    """Append a work order to the markdown document"""
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    doc_file = project_root / doc_path
    
    # Parse work order data
    work_order_no = work_order_data.get('workOrderNo', 'UNKNOWN')
    created_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    # Format work order as markdown
    markdown_content = f"""
---

## Work Order: {work_order_no}

**Created:** {created_at}  
**Status:** {work_order_data.get('status', 'pending')}  
**Priority:** {work_order_data.get('priority', 'medium')}  
**Machine ID:** {work_order_data.get('machineId', 'N/A')}  
**Machine Type:** {work_order_data.get('machineType', 'N/A')}  
**Alarm Type:** {work_order_data.get('alarmType', 'N/A')}  

### Work Description
{work_order_data.get('workDescription', 'N/A')}

### Special Instructions
{work_order_data.get('specialInstructions', 'N/A')}

### Equipment Information
- **Equipment ID:** {work_order_data.get('equipmentId', 'N/A')}
- **Equipment Name:** {work_order_data.get('equipmentName', 'N/A')}
- **Location:** {work_order_data.get('location', 'N/A')}

### Task Information
- **Task Number:** {work_order_data.get('taskNumber', 'N/A')}
- **Frequency:** {work_order_data.get('frequency', 'N/A')}
- **Work Performed By:** {work_order_data.get('workPerformedBy', 'N/A')}
- **Standard Hours:** {work_order_data.get('standardHours', '0')}
- **Overtime Hours:** {work_order_data.get('overtimeHours', '0')}

### Parts and Components
"""
    
    # Add parts
    parts = work_order_data.get('parts', [])
    if isinstance(parts, str):
        try:
            parts = json.loads(parts)
        except:
            parts = []
    
    if parts and len(parts) > 0:
        for part in parts:
            part_name = part.get('name', 'N/A') if isinstance(part, dict) else str(part)
            part_qty = part.get('quantity', 'N/A') if isinstance(part, dict) else 'N/A'
            markdown_content += f"- {part_name} (Qty: {part_qty})\n"
    else:
        markdown_content += "- None\n"
    
    markdown_content += "\n### Materials Used\n"
    
    # Add materials
    materials = work_order_data.get('materials', [])
    if isinstance(materials, str):
        try:
            materials = json.loads(materials)
        except:
            materials = []
    
    if materials and len(materials) > 0:
        for material in materials:
            material_name = material.get('name', 'N/A') if isinstance(material, dict) else str(material)
            material_qty = material.get('quantity', 'N/A') if isinstance(material, dict) else 'N/A'
            markdown_content += f"- {material_name} (Qty: {material_qty})\n"
    else:
        markdown_content += "- None\n"
    
    markdown_content += f"""
### Work Performance
- **Work Performed:** {work_order_data.get('workPerformed', 'N/A')}
- **Work Completed:** {'Yes' if work_order_data.get('workCompleted', False) else 'No'}

### Company Information
- **Company Name:** {work_order_data.get('companyName', 'N/A')}
- **Week Number:** {work_order_data.get('weekNo', 'N/A')}
- **Week Of:** {work_order_data.get('weekOf', 'N/A')}

---
"""
    
    # Append to file (create if doesn't exist)
    if not doc_file.exists():
        # Create initial header
        header = f"""# Work Orders History
## MQTT-OT Network Production System

**Document Type:** Work Order Archive  
**Last Updated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

This document contains a chronological record of all generated work orders.

---
"""
        doc_file.write_text(header, encoding='utf-8')
    
    # Append new work order
    with open(doc_file, 'a', encoding='utf-8') as f:
        f.write(markdown_content)
    
    print(f"✅ Work order {work_order_no} appended to {doc_file}")
    return str(doc_file)

if __name__ == "__main__":
    # Check if JSON file path provided as argument
    if len(sys.argv) > 1:
        json_file = sys.argv[1]
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                work_order_data = json.load(f)
            append_work_order_to_doc(work_order_data)
        except Exception as e:
            print(f"❌ Error reading/processing JSON file: {e}")
            sys.exit(1)
    else:
        # Test with sample data
        sample_work_order = {
            'workOrderNo': 'TEST-001',
            'status': 'pending',
            'priority': 'high',
            'machineId': 'lathe01',
            'machineType': 'lathe',
            'alarmType': 'AlarmSpindleOverload',
            'workDescription': 'Test work order',
            'specialInstructions': 'Test instructions',
        }
        append_work_order_to_doc(sample_work_order)

