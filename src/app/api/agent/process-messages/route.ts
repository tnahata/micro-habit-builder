// src/app/api/agent/process-messages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { TailoredHabitAgent } from '@/lib/habitAgent';

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.AGENT_API_KEY}`) {
      console.log('❌ Unauthorized message processing request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('📨 Processing pending Slack messages...');
    
    const agent = new TailoredHabitAgent();
    await agent.processPendingSlackMessages();
    
    console.log('✅ Message processing completed');
    
    return NextResponse.json({ 
      success: true,
      message: 'Pending messages processed successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Message processing error:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// GET endpoint for debugging message queue
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('apiKey');
  const debug = searchParams.get('debug');
  
  if (apiKey !== process.env.AGENT_API_KEY) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }
  
  if (debug === 'true') {
    try {
      const { adminDb } = await import('@/lib/firebaseAdmin');
      
      // Get pending messages
      const pendingSnapshot = await adminDb.collection('scheduled_messages')
        .where('sent', '==', false)
        .orderBy('reminderTime', 'asc')
        .limit(20)
        .get();

      const completionSnapshot = await adminDb.collection('scheduled_messages')
        .where('sent', '==', true)
        .where('completionCheckSent', '==', false)
        .orderBy('completionTime', 'asc')
        .limit(20)
        .get();
      
      const pendingMessages = pendingSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        type: 'reminder'
      }));
      
      const pendingCompletionChecks = completionSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        type: 'completion_check'
      }));
      
      return NextResponse.json({
        debug: true,
        currentTime: new Date().toISOString(),
        pendingReminders: pendingMessages.length,
        pendingCompletionChecks: pendingCompletionChecks.length,
        messages: {
          reminders: pendingMessages,
          completionChecks: pendingCompletionChecks
        }
      });
      
    } catch (error) {
      return NextResponse.json({ 
        error: 'Debug failed', 
        message: error instanceof Error ? error.message : String(error)
      }, { status: 500 });
    }
  }
  
  return NextResponse.json({ 
    message: 'Use POST to process messages, or add ?debug=true for queue status' 
  });
}