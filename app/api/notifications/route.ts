import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

interface Notification {
  _id: string;
  userId: string;
  type: string;
  time: string;
  title: string;
  subtitle: string;
  description: string;
  actions?: string[];
  color?: string;
  bg?: string;
  read: boolean;
  sensorType?: string;
  reportId?: string;
  sent: boolean;
  labId?: string;
  createdAt: string;
  updatedAt: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const labId = searchParams.get('labId');
    const machineName = searchParams.get('machineName'); // Filter by machine name (title field)
    const read = searchParams.get('read'); // 'true', 'false', or null for all
    const limit = parseInt(searchParams.get('limit') || '100');
    const skip = parseInt(searchParams.get('skip') || '0');
    
    // Date range filters
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const db = await connectToDatabase();
    const notificationsCollection = db.collection<Notification>('notifications');

    // Build query
    const query: any = {};
    
    if (userId) {
      // Convert string to ObjectId if it's a valid ObjectId
      try {
        query.userId = ObjectId.isValid(userId) ? new ObjectId(userId) : userId;
      } catch (e) {
        query.userId = userId;
      }
    }
    
    if (labId) {
      // Convert string to ObjectId if it's a valid ObjectId
      try {
        query.labId = ObjectId.isValid(labId) ? new ObjectId(labId) : labId;
      } catch (e) {
        query.labId = labId;
      }
    }
    
    // Filter by machine name (stored in title field)
    if (machineName) {
      query.title = machineName;
    }
    
    if (read !== null && read !== undefined) {
      query.read = read === 'true';
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Fetch notifications
    const notifications = await notificationsCollection
      .find(query)
      .sort({ createdAt: -1 }) // Most recent first
      .skip(skip)
      .limit(limit)
      .toArray();

    // Convert ObjectId to string
    const formattedNotifications = notifications.map(notif => ({
      ...notif,
      _id: notif._id.toString(),
    }));

    return NextResponse.json({
      success: true,
      notifications: formattedNotifications,
      count: formattedNotifications.length,
      total: await notificationsCollection.countDocuments(query),
    });
  } catch (error: any) {
    console.error('[Notifications API] Error fetching notifications:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch notifications',
      },
      { status: 500 }
    );
  }
}

// Mark notification as read
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { notificationId, read } = body;

    if (!notificationId) {
      return NextResponse.json(
        { success: false, error: 'Notification ID is required' },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();
    const notificationsCollection = db.collection('notifications');

    // Convert string to ObjectId if it's a valid ObjectId
    let notificationObjectId: any = notificationId;
    try {
      if (ObjectId.isValid(notificationId)) {
        notificationObjectId = new ObjectId(notificationId);
      }
    } catch (e) {
      // Keep as string if conversion fails
    }

    const result = await notificationsCollection.updateOne(
      { _id: notificationObjectId },
      { $set: { read: read !== undefined ? read : true, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Notification not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Notification updated successfully',
    });
  } catch (error: any) {
    console.error('[Notifications API] Error updating notification:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update notification',
      },
      { status: 500 }
    );
  }
}

