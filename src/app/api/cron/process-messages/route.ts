// src/app/api/cron/process-messages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { TailoredHabitAgent } from '@/lib/habitAgent';

export async function GET(request: NextRequest) {
  try {
    // Verify this is a Vercel cron request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log('❌ Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('🕐 CRON: Processing pending Slack messages...');
    
    const agent = new TailoredHabitAgent();
    await agent.processPendingSlackMessages();
    
    console.log('✅ CRON: Message processing completed');
    
    return NextResponse.json({ 
      success: true,
      trigger: 'cron-messages',
      message: 'Pending messages processed successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ CRON: Message processing error:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}