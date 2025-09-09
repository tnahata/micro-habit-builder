// src/app/api/cron/daily-scheduling/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { TailoredHabitAgent } from '@/lib/habitAgent';
import { adminDb } from '@/lib/firebaseAdmin';

export async function GET(request: NextRequest) {
  try {
    // Verify this is a Vercel cron request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log('❌ Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('🕐 CRON: Starting daily habit scheduling...');
    
    const agent = new TailoredHabitAgent();
    
    // Get all users with both integrations connected
    const usersSnapshot = await adminDb.collection('users')
      .where('integrations.googleCalendar.connected', '==', true)
      .where('integrations.slack.connected', '==', true)
      .get();
    
    console.log(`👥 CRON: Found ${usersSnapshot.docs.length} connected users`);
    
    const results = [];
    let processed = 0;
    let skipped = 0;
    let failed = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      try {
        const userData = userDoc.data();
        
        // Only process users with habits
        if (userData.habits && userData.habits.length > 0) {
          console.log(`🎯 CRON: Processing user ${userDoc.id} with ${userData.habits.length} habits`);
          await agent.runDailyScheduling(userDoc.id);
          results.push({ 
            userId: userDoc.id, 
            status: 'success', 
            habitsCount: userData.habits.length 
          });
          processed++;
        } else {
          console.log(`⏭️ CRON: Skipping user ${userDoc.id} - no habits`);
          results.push({ 
            userId: userDoc.id, 
            status: 'skipped', 
            reason: 'no habits found' 
          });
          skipped++;
        }
      } catch (error) {
        console.error(`❌ CRON: Error processing user ${userDoc.id}:`, error);
        results.push({ 
          userId: userDoc.id, 
          status: 'error', 
          error: error instanceof Error ? error.message : String(error)
        });
        failed++;
      }
    }
    
    console.log(`📊 CRON: Daily scheduling complete - Processed: ${processed}, Skipped: ${skipped}, Failed: ${failed}`);
    
    return NextResponse.json({ 
      success: true,
      trigger: 'cron-daily',
      summary: {
        totalUsers: usersSnapshot.docs.length,
        processed,
        skipped,
        failed
      },
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ CRON: Daily scheduling error:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}