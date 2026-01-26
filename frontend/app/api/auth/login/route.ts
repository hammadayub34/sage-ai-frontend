import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const db = await connectToDatabase();
    const usersCollection = db.collection('users');

    // Find user by email
    const user = await usersCollection.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if user is active
    if (user.isActive === false) {
      return NextResponse.json(
        { success: false, error: 'Account is inactive. Please contact administrator.' },
        { status: 403 }
      );
    }

    // Verify password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Return user data (excluding password)
    const userData = {
      _id: user._id.toString(),
      email: user.email,
      name: user.name,
      user_type: user.user_type,
      super_user: user.super_user || false,
      isActive: user.isActive,
      is_validated: user.is_validated,
    };

    return NextResponse.json({
      success: true,
      user: userData,
      message: 'Login successful',
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
}

