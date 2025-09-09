// src/lib/habitAgent.ts
import { google } from 'googleapis';
import { adminDb } from './firebaseAdmin';
import { WebClient } from '@slack/web-api';

interface UserDocument {
  email: string;
  name: string;
  habits: string[];
  integrations: {
    googleCalendar: {
      connected: boolean;
      accessToken?: string;
      refreshToken?: string;
    };
    slack: {
      connected: boolean;
      userId?: string;
      accessToken?: string;
    };
  };
  rewards: {
    badges: string[];
    points: number;
  };
  streaks: {
    current: number;
    longest: number;
  };
  createdAt: any;
  updatedAt: any;
}

interface CalendarSlot {
  start: Date;
  end: Date;
  isBusy: boolean;
  meetingTitle?: string;
}

interface OptimalSlot {
  startTime: Date;
  endTime: Date;
  confidence: number;
  habitName: string;
  reason: string;
}

interface HabitConfig {
  duration: number;
  maxSessionsPerDay: number;
  preferredHours: number[];
  type: string;
}

export class TailoredHabitAgent {

  constructor() {
    // No longer need a single bot token - we'll use user tokens
  }

  private getSlackClient(userAccessToken: string): WebClient {
    return new WebClient(userAccessToken);
  }

  async runDailyScheduling(userId: string): Promise<void> {
    try {
      console.log(`🤖 Running daily scheduling for user: ${userId}`);

      const userDoc = await adminDb.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        console.log(`❌ User ${userId} not found`);
        return;
      }

      const userData = userDoc.data() as UserDocument;

      // Check integrations
      if (!userData.integrations?.googleCalendar?.connected) {
        console.log(`⚠️ Google Calendar not connected for user ${userId}`);
        return;
      }

      if (!userData.integrations?.slack?.connected) {
        console.log(`⚠️ Slack not connected for user ${userId}`);
        return;
      }

      // Get user's current habits from your existing system
      const rawHabits = userData.habits || [];
      if (rawHabits.length === 0) {
        console.log(`📝 No habits found for user ${userId}`);
        return;
      }

      // Handle both string array and object array formats
      const habits = rawHabits.map((habit: any) => {
        if (typeof habit === 'string') {
          return habit;
        } else if (typeof habit === 'object' && habit.name) {
          return habit.name;
        } else {
          console.warn(`⚠️ Invalid habit format for user ${userId}:`, habit);
          return null;
        }
      }).filter(Boolean); // Remove null values

      if (habits.length === 0) {
        console.log(`📝 No valid habits found for user ${userId}`);
        return;
      }

      console.log(`📋 Found ${habits.length} habits: ${habits.join(', ')}`);

      // Get today's calendar
      const calendar = await this.getCalendarData(userId, userData);

      // Schedule each habit
      for (const habitName of habits) {
        await this.scheduleHabitSessions(userId, habitName, calendar, userData);
      }

      console.log(`✅ Completed scheduling for user ${userId}`);

    } catch (error) {
      console.error('❌ Error in runDailyScheduling:', error);
      throw error;
    }
  }

  async getCalendarData(userId: string, userData: UserDocument): Promise<CalendarSlot[]> {
    try {
      const accessToken = userData.integrations.googleCalendar.accessToken;
      const refreshToken = userData.integrations.googleCalendar.refreshToken;

      if (!accessToken) {
        console.log(`🔄 No access token found for user ${userId}`);
        return [];
      }

      const auth = new google.auth.OAuth2();
      auth.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      const calendar = google.calendar({ version: 'v3', auth });

      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: today.toISOString(),
        timeMax: tomorrow.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];
      console.log(`📅 Found ${events.length} calendar events for user ${userId}`);

      return events.map(event => ({
        start: new Date(event.start?.dateTime || event.start?.date || ''),
        end: new Date(event.end?.dateTime || event.end?.date || ''),
        isBusy: true,
        meetingTitle: event.summary || 'Busy'
      }));

    } catch (error) {
      console.error('Error fetching calendar data:', error);
      if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 401) {
        console.log(`🔄 Token expired for user ${userId}, attempting to refresh tokens via Descope`);
        // Try to refresh tokens via Descope
        const refreshed = await this.refreshUserTokens(userId);
        if (refreshed) {
          console.log(`✅ Tokens refreshed for user ${userId}, retrying calendar fetch`);
          // Retry with new tokens
          const updatedUserDoc = await adminDb.collection('users').doc(userId).get();
          const updatedUserData = updatedUserDoc.data() as UserDocument;
          return this.getCalendarData(userId, updatedUserData);
        }
      }
      return [];
    }
  }

  async refreshUserTokens(userId: string): Promise<boolean> {
    try {
      // Call Descope to refresh tokens
      const response = await fetch(
        "https://api.descope.com/v1/mgmt/outbound/app/user/token/latest",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID}:${process.env.DESCOPE_MANAGEMENT_KEY}`,
          },
          body: JSON.stringify({
            appId: "google-calendar",
            userId,
            options: { withRefreshToken: true, forceRefresh: true },
          }),
        }
      );

      if (!response.ok) {
        console.log(`❌ Failed to refresh tokens for user ${userId}`);
        return false;
      }

      const data = await response.json();
      if (data?.token?.accessToken) {
        // Update tokens in Firestore
        const userRef = adminDb.collection('users').doc(userId);
        await userRef.update({
          'integrations.googleCalendar.accessToken': data.token.accessToken,
          'integrations.googleCalendar.refreshToken': data.token.refreshToken || null,
          updatedAt: new Date()
        });
        console.log(`🔄 Updated tokens in Firestore for user ${userId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`❌ Error refreshing tokens for user ${userId}:`, error);
      return false;
    }
  }

  async scheduleHabitSessions(userId: string, habitName: string, calendar: CalendarSlot[], userData: UserDocument): Promise<void> {
    console.log(`🎯 Scheduling sessions for habit: ${habitName}`);

    const habitConfig = this.getHabitConfig(habitName);
    const optimalSlots = this.findOptimalSlotsForHabit(habitName, calendar, habitConfig);

    const sessionsToSchedule = Math.min(optimalSlots.length, habitConfig.maxSessionsPerDay);
    console.log(`📅 Found ${optimalSlots.length} optimal slots, scheduling ${sessionsToSchedule} sessions`);

    for (let i = 0; i < sessionsToSchedule; i++) {
      const slot = optimalSlots[i];

      try {
        const eventId = await this.createCalendarEvent(userId, userData, slot);
        await this.scheduleSlackReminders(userId, userData, slot, eventId);
        await this.logScheduledSession(userId, slot, eventId);

        console.log(`✅ Scheduled ${habitName} at ${slot.startTime.toLocaleTimeString()}`);
      } catch (error) {
        console.error(`❌ Error scheduling ${habitName} for ${userId}:`, error);
      }
    }
  }

  getHabitConfig(habitName: string): HabitConfig {
    const name = habitName.toLowerCase();

    if (name.includes('water') || name.includes('drink') || name.includes('hydrat')) {
      return {
        duration: 2,
        maxSessionsPerDay: 5,
        preferredHours: [9, 11, 14, 16, 18],
        type: 'hydration'
      };
    } else if (name.includes('exercise') || name.includes('workout') || name.includes('stretch') || name.includes('gym')) {
      return {
        duration: 15,
        maxSessionsPerDay: 2,
        preferredHours: [8, 12, 17],
        type: 'exercise'
      };
    } else if (name.includes('wake') || name.includes('morning') || name.includes('early')) {
      return {
        duration: 5,
        maxSessionsPerDay: 1,
        preferredHours: [7, 8],
        type: 'morning'
      };
    } else if (name.includes('sleep') || name.includes('bed') || name.includes('time')) {
      return {
        duration: 10,
        maxSessionsPerDay: 1,
        preferredHours: [21, 22],
        type: 'evening'
      };
    } else if (name.includes('meditation') || name.includes('mindful') || name.includes('breath')) {
      return {
        duration: 10,
        maxSessionsPerDay: 2,
        preferredHours: [8, 17],
        type: 'mindfulness'
      };
    } else if (name.includes('read') || name.includes('book') || name.includes('study')) {
      return {
        duration: 20,
        maxSessionsPerDay: 2,
        preferredHours: [8, 20],
        type: 'learning'
      };
    } else {
      return {
        duration: 10,
        maxSessionsPerDay: 2,
        preferredHours: [9, 14, 17],
        type: 'general'
      };
    }
  }

  findOptimalSlotsForHabit(habitName: string, calendar: CalendarSlot[], habitConfig: HabitConfig): OptimalSlot[] {
    const today = new Date();
    const slots: OptimalSlot[] = [];

    // Generate slots throughout the day
    for (let hour = 7; hour <= 22; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const slotStart = new Date(today);
        slotStart.setHours(hour, minute, 0, 0);
        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + habitConfig.duration);

        // Skip past slots
        if (slotStart < new Date()) continue;

        // Check availability
        if (this.isSlotAvailable(calendar, slotStart, slotEnd)) {
          const confidence = this.calculateSlotConfidence(slotStart, habitConfig, calendar);

          if (confidence > 0.3) {
            slots.push({
              startTime: slotStart,
              endTime: slotEnd,
              confidence,
              habitName,
              reason: this.getSlotReason(slotStart, habitConfig, calendar)
            });
          }
        }
      }
    }

    return slots.sort((a, b) => b.confidence - a.confidence);
  }

  private isSlotAvailable(calendar: CalendarSlot[], start: Date, end: Date): boolean {
    return !calendar.some(event =>
      event.isBusy &&
      ((start >= event.start && start < event.end) ||
        (end > event.start && end <= event.end) ||
        (start <= event.start && end >= event.end))
    );
  }

  private calculateSlotConfidence(slotStart: Date, habitConfig: HabitConfig, calendar: CalendarSlot[]): number {
    let confidence = 0.4;

    const hour = slotStart.getHours();

    // Preferred hours boost
    if (habitConfig.preferredHours.includes(hour)) {
      confidence += 0.4;
    }

    // Time bonuses
    if (hour >= 7 && hour <= 9) confidence += 0.1;
    if (hour >= 12 && hour <= 14) confidence += 0.1;
    if (hour >= 17 && hour <= 19) confidence += 0.1;

    // Penalties
    if (hour < 7 || hour > 21) confidence -= 0.3;

    // Buffer time bonus
    const nextMeeting = calendar.find(event => event.isBusy && event.start > slotStart);
    if (nextMeeting) {
      const minutesToNext = (nextMeeting.start.getTime() - slotStart.getTime()) / (1000 * 60);
      if (minutesToNext > 30) confidence += 0.1;
      if (minutesToNext < 15) confidence -= 0.2;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  private getSlotReason(slotStart: Date, habitConfig: HabitConfig, calendar: CalendarSlot[]): string {
    const hour = slotStart.getHours();
    const reasons = [];

    if (habitConfig.preferredHours.includes(hour)) {
      reasons.push('optimal time for this habit');
    }

    const nextMeeting = calendar.find(event => event.isBusy && event.start > slotStart);
    if (!nextMeeting) {
      reasons.push('no conflicts ahead');
    } else {
      const minutesToNext = (nextMeeting.start.getTime() - slotStart.getTime()) / (1000 * 60);
      if (minutesToNext > 30) {
        reasons.push('good buffer before next meeting');
      }
    }

    return reasons.length > 0 ? reasons.join(', ') : 'available time slot';
  }

  async createCalendarEvent(userId: string, userData: UserDocument, slot: OptimalSlot): Promise<string> {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: userData.integrations.googleCalendar.accessToken });

    const calendar = google.calendar({ version: 'v3', auth });

    const event = {
      summary: `🎯 ${slot.habitName}`,
      description: `Scheduled by StreakFlow Agent 🤖\n\n` +
        `💡 Why this time: ${slot.reason}\n` +
        `🎲 Confidence: ${Math.round(slot.confidence * 100)}%\n\n` +
        `Stay consistent with your habits! 💪`,
      start: {
        dateTime: slot.startTime.toISOString(),
        timeZone: 'America/New_York',
      },
      end: {
        dateTime: slot.endTime.toISOString(),
        timeZone: 'America/New_York',
      },
      reminders: {
        useDefault: false,
        overrides: [{ method: 'popup', minutes: 5 }],
      },
      colorId: '2',
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });

    return response.data.id || '';
  }

  async scheduleSlackReminders(userId: string, userData: UserDocument, slot: OptimalSlot, eventId: string): Promise<void> {
    const slackUserId = userData.integrations.slack.userId;
    if (!slackUserId) return;

    const reminderTime = new Date(slot.startTime);
    reminderTime.setMinutes(reminderTime.getMinutes() - 10);

    const completionTime = new Date(slot.startTime);

    await adminDb.collection('scheduled_messages').add({
      userId,
      slackUserId,
      habitName: slot.habitName,
      eventId,
      reminderTime: reminderTime.toISOString(),
      completionTime: completionTime.toISOString(),
      sent: false,
      completionCheckSent: false,
      createdAt: new Date().toISOString()
    });
  }

  async logScheduledSession(userId: string, slot: OptimalSlot, eventId: string): Promise<void> {
    await adminDb.collection('habit_sessions').add({
      userId,
      habitName: slot.habitName,
      scheduledTime: slot.startTime.toISOString(),
      duration: Math.floor((slot.endTime.getTime() - slot.startTime.getTime()) / (1000 * 60)),
      confidence: slot.confidence,
      reason: slot.reason,
      eventId,
      status: 'scheduled',
      createdAt: new Date().toISOString()
    });
  }

  async processPendingSlackMessages(): Promise<void> {
    const now = new Date();

    // Send reminder messages
    const remindersSnapshot = await adminDb.collection('scheduled_messages')
      .where('sent', '==', false)
      .where('reminderTime', '<=', now.toISOString())
      .limit(50)
      .get();

    for (const messageDoc of remindersSnapshot.docs) {
      try {
        const messageData = messageDoc.data();
        await this.sendHabitReminder(messageData);
        await messageDoc.ref.update({ sent: true, sentAt: now.toISOString() });
        console.log(`📤 Sent reminder for ${messageData.habitName} to user ${messageData.userId}`);
      } catch (error) {
        console.error('Error sending reminder:', error);
      }
    }

    // Send completion checks
    const checksSnapshot = await adminDb.collection('scheduled_messages')
      .where('sent', '==', true)
      .where('completionCheckSent', '==', false)
      .where('completionTime', '<=', now.toISOString())
      .limit(50)
      .get();

    for (const checkDoc of checksSnapshot.docs) {
      const checkData = checkDoc.data();
      try {
        console.log(`🔄 Attempting to send completion check for ${checkData.habitName} to user ${checkData.userId}`);
        console.log(`📋 Check data:`, {
          userId: checkData.userId,
          habitName: checkData.habitName,
          slackUserId: checkData.slackUserId,
          completionTime: checkData.completionTime
        });

        await this.sendCompletionCheck(checkData);
        await checkDoc.ref.update({ completionCheckSent: true, completionCheckSentAt: now.toISOString() });
        console.log(`✅ Sent completion check for ${checkData.habitName} to user ${checkData.userId}`);
      } catch (error) {
        console.error(`❌ Error sending completion check for ${checkData.habitName}:`, error);
        // Don't update the document if there was an error
      }
    }
  }

  async sendHabitReminder(messageData: any): Promise<void> {
    // Get user's Slack access token
    const userDoc = await adminDb.collection('users').doc(messageData.userId).get();
    const userData = userDoc.data();
    const slackAccessToken = userData?.integrations?.slack?.accessToken;

    if (!slackAccessToken) {
      console.error(`❌ No Slack access token for user ${messageData.userId}`);
      return;
    }

    const slackClient = this.getSlackClient(slackAccessToken);
    const message = this.generateReminderMessage(messageData.habitName);

    await slackClient.chat.postMessage({
      channel: messageData.slackUserId,
      text: message,
      blocks: [{
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: message
        }
      }]
    });
  }

  async sendCompletionCheck(checkData: any): Promise<void> {
    console.log(`🔄 sendCompletionCheck called for user ${checkData.userId}, habit: ${checkData.habitName}`);

    // Get user's Slack access token
    const userDoc = await adminDb.collection('users').doc(checkData.userId).get();
    const userData = userDoc.data();
    const slackAccessToken = userData?.integrations?.slack?.accessToken;

    if (!slackAccessToken) {
      console.error(`❌ No Slack access token for user ${checkData.userId}`);
      throw new Error(`No Slack access token for user ${checkData.userId}`);
    }

    console.log(`🔑 Found Slack access token for user ${checkData.userId}`);
    console.log(`📤 Sending completion check to Slack user: ${checkData.slackUserId}`);

    const slackClient = this.getSlackClient(slackAccessToken);
    const message = `✅ Time's up! Did you complete **${checkData.habitName}**?\n\nTap a button below to update your streak! 🔥`;

    const slackResponse = await slackClient.chat.postMessage({
      channel: checkData.slackUserId,
      text: message,
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: message }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: '✅ Yes, I did it!' },
              style: 'primary',
              action_id: 'habit_completed',
              value: `${checkData.userId}:${checkData.habitName}:${checkData.eventId}`
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: '😅 Not this time' },
              action_id: 'habit_skipped',
              value: `${checkData.userId}:${checkData.habitName}:${checkData.eventId}`
            }
          ]
        }
      ]
    });

    console.log(`✅ Slack completion check response:`, {
      ok: slackResponse.ok,
      channel: slackResponse.channel,
      ts: slackResponse.ts
    });
  }

  generateReminderMessage(habitName: string): string {
    const name = habitName.toLowerCase();

    if (name.includes('wake') || name.includes('morning') || name.includes('early')) {
      return `🌅 **${habitName}** - Rise and shine! Time to start your day with intention. ☀️`;
    } else if (name.includes('sleep') || name.includes('bed') || name.includes('time')) {
      return `😴 **${habitName}** - Time to wind down for better rest. Your future self will thank you! 🛏️`;
    } else if (name.includes('water') || name.includes('drink') || name.includes('hydrat')) {
      return `💧 **${habitName}** - Stay hydrated! Your body needs this fuel. 🥤`;
    } else if (name.includes('exercise') || name.includes('workout') || name.includes('gym')) {
      return `💪 **${habitName}** - Time to get moving! Even a few minutes counts. 🏃‍♂️`;
    } else if (name.includes('meditation') || name.includes('mindful')) {
      return `🧘‍♀️ **${habitName}** - Time for mindfulness! Take a moment to center yourself. ✨`;
    } else if (name.includes('read') || name.includes('book')) {
      return `📚 **${habitName}** - Time for some reading! Feed your mind with knowledge. 🤓`;
    } else {
      return `⏰ **${habitName}** - Time for your habit! You've got this! 💪`;
    }
  }

  async handleHabitCompletion(userId: string, habitName: string, eventId: string, completed: boolean): Promise<void> {
    try {
      const userRef = adminDb.collection('users').doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) return;

      const userData = userDoc.data() as UserDocument;

      if (completed) {
        const newCurrentStreak = userData.streaks.current + 1;
        const newLongestStreak = Math.max(userData.streaks.longest, newCurrentStreak);
        const newPoints = userData.rewards.points + 10;

        await userRef.update({
          'streaks.current': newCurrentStreak,
          'streaks.longest': newLongestStreak,
          'rewards.points': newPoints,
          updatedAt: new Date()
        });

        await adminDb.collection('habit_completions').add({
          userId,
          habitName,
          eventId,
          completedAt: new Date().toISOString(),
          pointsEarned: 10
        });

        console.log(`🎉 ${habitName} completed! User ${userId} streak: ${newCurrentStreak}, points: ${newPoints}`);
      } else {
        await userRef.update({
          'streaks.current': 0,
          updatedAt: new Date()
        });

        console.log(`😅 ${habitName} skipped. User ${userId} streak reset to 0`);
      }
    } catch (error) {
      console.error('Error handling habit completion:', error);
    }
  }
}