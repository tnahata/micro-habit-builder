// src/app/api/agent/slack-webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { TailoredHabitAgent } from '@/lib/habitAgent';
import { WebClient } from '@slack/web-api';
import { adminDb } from '@/lib/firebaseAdmin';

// We'll create Slack clients dynamically with user tokens

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    console.log('📨 Slack webhook - Raw body:', body);
    
    let payload;
    
    // Check if it's JSON or URL-encoded
    if (body.startsWith('{')) {
      // JSON payload
      payload = JSON.parse(body);
    } else {
      // URL-encoded payload (interactive components)
      const urlParams = new URLSearchParams(body);
      const payloadParam = urlParams.get('payload');
      if (payloadParam) {
        payload = JSON.parse(payloadParam);
      } else {
        throw new Error('No payload found in URL-encoded data');
      }
    }
    
    console.log('📨 Slack webhook - Parsed payload:', JSON.stringify(payload, null, 2));
    
    // Handle Slack URL verification (first-time setup)
    if (payload.type === 'url_verification') {
      console.log('🔗 Slack URL verification received');
      return NextResponse.json({ challenge: payload.challenge });
    }
    
    // Handle interactive components (button clicks)
    if (payload.type === 'interactive_message' || payload.type === 'block_actions') {
      console.log('🔘 Slack interaction received');
      return await handleSlackInteraction(payload);
    }
    
    // Handle other Slack events (optional)
    if (payload.type === 'event_callback') {
      console.log('📨 Slack event received:', payload.event?.type);
      return NextResponse.json({ ok: true });
    }
    
    console.log('❓ Unknown Slack payload type:', payload.type);
    return NextResponse.json({ ok: true });
    
  } catch (error) {
    console.error('❌ Slack webhook error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: (error as Error)?.message || 'Unknown error'
    }, { status: 500 });
  }
}

async function handleSlackInteraction(payload: any) {
  const user = payload.user;
  const actions = payload.actions || [];
  
  console.log(`👤 Processing interaction from Slack user: ${user.id}`);
  
  for (const action of actions) {
    try {
      const [userId, habitName, eventId] = action.value.split(':');
      console.log(`🎯 Action: ${action.action_id} for habit: ${habitName} by user: ${userId}`);
      
      if (action.action_id === 'habit_completed') {
        await handleHabitCompleted(payload, userId, habitName, eventId, user);
      } else if (action.action_id === 'habit_skipped') {
        await handleHabitSkipped(payload, userId, habitName, eventId, user);
      } else {
        console.log('❓ Unknown action:', action.action_id);
      }
    } catch (error) {
      console.error('❌ Error processing action:', error);
    }
  }
  
  return NextResponse.json({ ok: true });
}

async function handleHabitCompleted(payload: any, userId: string, habitName: string, eventId: string, user: any) {
  const agent = new TailoredHabitAgent();
  await agent.handleHabitCompletion(userId, habitName, eventId, true);
  
  // Get updated user data for response
  const userDoc = await adminDb.collection('users').doc(userId).get();
  const userData = userDoc.data();
  const currentStreak = userData?.streaks?.current || 0;
  const points = userData?.rewards?.points || 0;
  
  // Get user's Slack access token
  // const userDoc = await adminDb.collection('users').doc(userId).get();
  // const userData = userDoc.data();
  const slackAccessToken = userData?.integrations?.slack?.accessToken;
  
  if (!slackAccessToken) {
    console.error(`❌ No Slack access token for user ${userId}`);
    return;
  }
  
  const slackClient = new WebClient(slackAccessToken);
  
  // Update the original message
  await slackClient.chat.update({
    channel: payload.channel.id,
    ts: payload.message.ts,
    text: `✅ ${habitName} completed!`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `✅ **${habitName}** completed! 🎉\n\n🔥 Current streak: **${currentStreak}** days\n⭐ Total points: **${points}**`
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Great job! Keep building that momentum! 💪`
          }
        ]
      }
    ]
  });
  
  // Send encouraging follow-up for streak milestones
  if (currentStreak > 0 && currentStreak % 5 === 0) {
    setTimeout(async () => {
      await slackClient.chat.postMessage({
        channel: user.id,
        text: `🎊 Amazing milestone! You've hit a **${currentStreak}-day streak**! You're building incredible momentum! 🚀✨`
      });
    }, 2000);
  } else if (currentStreak === 1) {
    setTimeout(async () => {
      await slackClient.chat.postMessage({
        channel: user.id,
        text: `🌟 Great start! Day 1 of your streak complete. Every journey begins with a single step! 👏`
      });
    }, 1500);
  }
  
  console.log(`🎉 Habit completed - User: ${userId}, Habit: ${habitName}, Streak: ${currentStreak}`);
}

async function handleHabitSkipped(payload: any, userId: string, habitName: string, eventId: string, user: any) {
  const agent = new TailoredHabitAgent();
  await agent.handleHabitCompletion(userId, habitName, eventId, false);
  
  // Get user's Slack access token
  const userDoc = await adminDb.collection('users').doc(userId).get();
  const userData = userDoc.data();
  const slackAccessToken = userData?.integrations?.slack?.accessToken;
  
  if (!slackAccessToken) {
    console.error(`❌ No Slack access token for user ${userId}`);
    return;
  }
  
  const slackClient = new WebClient(slackAccessToken);
  
  // Update the original message
  await slackClient.chat.update({
    channel: payload.channel.id,
    ts: payload.message.ts,
    text: `😅 No worries about ${habitName}!`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `😅 No worries about **${habitName}**! 🌅\n\nProgress isn't about perfection - it's about showing up consistently over time.`
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Tomorrow is a fresh opportunity! 🌱`
          }
        ]
      }
    ]
  });
  
  // Send motivational message after a delay
  setTimeout(async () => {
    const motivationalMessages = [
      "Don't worry about missing one! The key is consistency over perfection. You've got this! 🌟",
      "Every expert was once a beginner. Tomorrow is your chance to bounce back! 💪",
      "Small setbacks are part of the journey. What matters is that you keep going! 🚀",
      "One missed habit doesn't define you. Your next choice does! ✨"
    ];
    
    const randomMessage = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
    
    await slackClient.chat.postMessage({
      channel: user.id,
      text: randomMessage
    });
  }, 3000);
  
  console.log(`😅 Habit skipped - User: ${userId}, Habit: ${habitName}, streak reset`);
}