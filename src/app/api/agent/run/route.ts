// src/app/api/agent/run/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { TailoredHabitAgent } from '@/lib/habitAgent';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const { userId, trigger } = await request.json();
    
    // Simple API key authentication
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.AGENT_API_KEY}`) {
      console.log('❌ Unauthorized agent request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const agent = new TailoredHabitAgent();
    
    if (userId) {
      // Run for specific user
      console.log(`🎯 Running agent for specific user: ${userId}`);
      await agent.runDailyScheduling(userId);
      return NextResponse.json({ 
        success: true, 
        userId,
        message: 'Habits scheduled successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      // Run for all connected users (batch processing)
      console.log('🚀 Running agent for all connected users');
      
      const usersSnapshot = await adminDb.collection('users')
        .where('integrations.googleCalendar.connected', '==', true)
        .where('integrations.slack.connected', '==', true)
        .get();
      
      console.log(`👥 Found ${usersSnapshot.docs.length} connected users`);
      
      const results = [];
      let processed = 0;
      let skipped = 0;
      let failed = 0;
      
      for (const userDoc of usersSnapshot.docs) {
        try {
          const userData = userDoc.data();
          
          // Only process users with habits
          if (userData.habits && userData.habits.length > 0) {
            await agent.runDailyScheduling(userDoc.id);
            results.push({ 
              userId: userDoc.id, 
              status: 'success', 
              habitsCount: userData.habits.length 
            });
            processed++;
          } else {
            results.push({ 
              userId: userDoc.id, 
              status: 'skipped', 
              reason: 'no habits found' 
            });
            skipped++;
          }
        } catch (error) {
          console.error(`❌ Error processing user ${userDoc.id}:`, error);
          results.push({ 
            userId: userDoc.id, 
            status: 'error', 
            error: error instanceof Error ? error.message : String(error)
          });
          failed++;
        }
      }
      
      console.log(`📊 Batch complete - Processed: ${processed}, Skipped: ${skipped}, Failed: ${failed}`);
      
      return NextResponse.json({ 
        success: true,
        trigger: trigger || 'manual',
        summary: {
          totalUsers: usersSnapshot.docs.length,
          processed,
          skipped,
          failed
        },
        results,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('❌ Agent run error:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// GET endpoint for manual testing and debugging
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const apiKey = searchParams.get('apiKey');
  const debug = searchParams.get('debug');
  
  // Authentication check
  if (apiKey !== process.env.AGENT_API_KEY) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }
  
  if (!userId) {
    return NextResponse.json({ 
      error: 'Missing userId parameter',
      example: '/api/agent/run?userId=your-user-id&apiKey=your-api-key'
    }, { status: 400 });
  }
  
  try {
    const agent = new TailoredHabitAgent();
    
    if (debug === 'true') {
      // Debug mode - just return user info without scheduling
      const userDoc = await adminDb.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      const userData = userDoc.data();
      return NextResponse.json({
        debug: true,
        userId,
        userData: {
          email: userData?.email,
          name: userData?.name,
          habits: userData?.habits,
          integrations: userData?.integrations,
          streaks: userData?.streaks,
          points: userData?.rewards?.points
        },
        message: 'Debug info retrieved (no scheduling performed)'
      });
    }
    
    // Normal execution
    await agent.runDailyScheduling(userId);
    
    return NextResponse.json({ 
      success: true, 
      message: `Successfully scheduled habits for user ${userId}`,
      userId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ GET agent error:', error);
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : String(error),
      userId,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}