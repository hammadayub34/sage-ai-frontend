import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

const ALARM_EVENTS_FILE = '/tmp/alarm_events.json';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const machineId = searchParams.get('machineId');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    // Check if file exists
    if (!existsSync(ALARM_EVENTS_FILE)) {
      return NextResponse.json({ events: [] });
    }
    
    // Read alarm events
    const fileContent = await readFile(ALARM_EVENTS_FILE, 'utf-8');
    let events = JSON.parse(fileContent);
    
    // Filter by machine if specified
    if (machineId) {
      events = events.filter((e: any) => e.machine_id === machineId);
    }
    
    // Sort by timestamp (newest first) and limit
    events = events
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
    
    return NextResponse.json({ events });
  } catch (error: any) {
    console.error('Error reading alarm events:', error);
    return NextResponse.json({ events: [] });
  }
}

