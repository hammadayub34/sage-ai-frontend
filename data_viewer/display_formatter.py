"""
Data formatting utilities for MQTT subscriber
"""
import json
from datetime import datetime

def format_message(topic, payload):
    """
    Format MQTT message for display
    
    Args:
        topic: MQTT topic string
        payload: Message payload (bytes or string)
    
    Returns:
        Formatted string for display
    """
    try:
        if isinstance(payload, bytes):
            payload = payload.decode('utf-8')
        
        # Try to parse as JSON
        try:
            data = json.loads(payload)
            formatted = json.dumps(data, indent=2)
        except json.JSONDecodeError:
            formatted = payload
        
        timestamp = datetime.now().strftime("%H:%M:%S")
        
        output = f"\n{'='*60}\n"
        output += f"⏰ {timestamp} | Topic: {topic}\n"
        output += f"{'='*60}\n"
        output += formatted
        output += f"\n{'='*60}\n"
        
        return output
    except Exception as e:
        return f"Error formatting message: {e}\nPayload: {payload}"

def format_summary(data):
    """
    Create a summary view of the bottle filler data
    
    Args:
        data: Dictionary containing bottle filler tags
    
    Returns:
        Formatted summary string
    """
    if not isinstance(data, dict):
        return ""
    
    summary = []
    summary.append("📊 Bottle Filler Summary:")
    
    if "counters" in data:
        counters = data["counters"]
        summary.append(f"   Bottles Filled: {counters.get('BottlesFilled', 0)}")
        summary.append(f"   Production Rate: {counters.get('BottlesPerMinute', 0)} bottles/min")
    
    if "status" in data:
        status = data["status"]
        summary.append(f"   System Running: {status.get('SystemRunning', False)}")
        summary.append(f"   Filling: {status.get('Filling', False)}")
        summary.append(f"   Ready: {status.get('Ready', False)}")
    
    if "analog" in data:
        analog = data["analog"]
        summary.append(f"   Fill Level: {analog.get('FillLevel', 0)}%")
        summary.append(f"   Temperature: {analog.get('TankTemperature', 0)}°C")
    
    return "\n".join(summary)

