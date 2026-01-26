/**
 * Format alarm name by removing "Alarm" prefix and converting camelCase/snake_case to spaced words
 * Examples: 
 * - "AlarmLowProductLevel" -> "Low Product Level"
 * - "door_open" -> "Door Open"
 * - "AlarmDoorOpen" -> "Door Open"
 */
export function formatAlarmName(alarmName: string): string {
  if (!alarmName) return '';
  
  // Remove "Alarm" prefix (case insensitive)
  let formatted = alarmName.replace(/^alarm/i, '');
  
  // Handle snake_case: replace underscores with spaces
  formatted = formatted.replace(/_/g, ' ');
  
  // Convert camelCase to spaced words
  // Insert space before capital letters (but not at the start)
  formatted = formatted.replace(/([a-z])([A-Z])/g, '$1 $2');
  
  // Capitalize first letter of each word
  formatted = formatted
    .split(' ')
    .filter(word => word.length > 0) // Remove empty strings
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  
  return formatted;
}

