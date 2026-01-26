import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

interface Shift {
  name: string;
  startTime: string;
  endTime: string;
  _id?: string;
}

interface Lab {
  _id: string;
  name: string;
  shifts?: Shift[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const labId = searchParams.get('labId');
    const shiftName = searchParams.get('shiftName');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // Validate required parameters
    if (!labId) {
      return NextResponse.json(
        { success: false, error: 'labId is required' },
        { status: 400 }
      );
    }

    if (!shiftName) {
      return NextResponse.json(
        { success: false, error: 'shiftName is required' },
        { status: 400 }
      );
    }

    if (!startDateParam || !endDateParam) {
      return NextResponse.json(
        { success: false, error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    // Parse dates
    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid date format. Expected YYYY-MM-DD' },
        { status: 400 }
      );
    }

    if (startDate > endDate) {
      return NextResponse.json(
        { success: false, error: 'startDate must be before or equal to endDate' },
        { status: 400 }
      );
    }

    // Fetch lab from MongoDB directly to get shifts
    const db = await connectToDatabase();
    const labsCollection = db.collection<Lab>('labs');
    const { ObjectId } = await import('mongodb');
    
    let labObjectId: any;
    try {
      labObjectId = new ObjectId(labId);
    } catch {
      labObjectId = null;
    }

    const lab = await labsCollection.findOne({
      $or: [
        { _id: labId },
        ...(labObjectId ? [{ _id: labObjectId }] : [])
      ]
    });

    if (!lab) {
      return NextResponse.json(
        { success: false, error: 'Lab not found' },
        { status: 404 }
      );
    }

    // Type assertion to include shifts
    const labWithShifts = lab as Lab;

    // Find shift by name
    if (!labWithShifts.shifts || labWithShifts.shifts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Lab has no shifts configured' },
        { status: 404 }
      );
    }

    const shift = labWithShifts.shifts.find(s => s.name === shiftName);

    if (!shift) {
      return NextResponse.json(
        { success: false, error: `Shift "${shiftName}" not found in lab` },
        { status: 404 }
      );
    }

    // Validate shift has startTime and endTime
    if (!shift.startTime || !shift.endTime) {
      return NextResponse.json(
        { success: false, error: 'Shift is missing startTime or endTime' },
        { status: 400 }
      );
    }

    // Parse shift times (format: "HH:MM" or "HH:mm")
    const parseTime = (timeString: string): number => {
      const parts = timeString.split(':');
      if (parts.length !== 2) {
        throw new Error(`Invalid time format: ${timeString}. Expected HH:MM`);
      }
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        throw new Error(`Invalid time values: ${timeString}`);
      }
      
      return hours + (minutes / 60);
    };

    let startTimeHours: number;
    let endTimeHours: number;

    try {
      startTimeHours = parseTime(shift.startTime);
      endTimeHours = parseTime(shift.endTime);
    } catch (error: any) {
      return NextResponse.json(
        { success: false, error: `Invalid shift time format: ${error.message}` },
        { status: 400 }
      );
    }

    // Calculate shift duration (handle midnight crossover)
    let shiftDuration: number;
    if (endTimeHours < startTimeHours) {
      // Spans midnight: (24 - startTime) + endTime
      shiftDuration = (24 - startTimeHours) + endTimeHours;
    } else {
      // Normal case: endTime - startTime
      shiftDuration = endTimeHours - startTimeHours;
    }

    // Count number of days in range (inclusive of both start and end dates)
    // Normalize both dates to start of day in local timezone to avoid timezone issues
    const normalizeDate = (date: Date): Date => {
      const normalized = new Date(date);
      normalized.setHours(0, 0, 0, 0);
      normalized.setMinutes(0);
      normalized.setSeconds(0);
      normalized.setMilliseconds(0);
      return normalized;
    };
    
    const startNormalized = normalizeDate(startDate);
    const endNormalized = normalizeDate(endDate);
    
    // Calculate difference in days
    const diffTime = endNormalized.getTime() - startNormalized.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    
    // The number of days is the difference + 1 to include both start and end dates
    // Examples:
    // - Same day (Jan 15 to Jan 15): diffDays = 0, numberOfDays = 0 + 1 = 1 ✓
    // - 7 days (Jan 9 to Jan 15): diffDays = 6, numberOfDays = 6 + 1 = 7 ✓
    // - 30 days (Dec 17 to Jan 15): diffDays = 29, numberOfDays = 29 + 1 = 30 ✓
    const numberOfDays = Math.round(diffDays) + 1;

    // Calculate total scheduled hours
    const scheduledHours = shiftDuration * numberOfDays;

    // Return response with detailed information
    return NextResponse.json({
      success: true,
      scheduledHours: Math.round(scheduledHours * 100) / 100, // Round to 2 decimal places
      shiftInfo: {
        shiftName: shift.name,
        startTime: shift.startTime,
        endTime: shift.endTime,
        shiftDuration: Math.round(shiftDuration * 100) / 100,
        numberOfDays,
      }
    });
  } catch (error: any) {
    console.error('[Scheduled Hours API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to calculate scheduled hours' },
      { status: 500 }
    );
  }
}

