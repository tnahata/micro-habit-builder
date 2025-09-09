'use client';

import { useState, useEffect } from 'react';
import { useDescope, useSession, useUser } from '@descope/nextjs-sdk/client';
import { useRouter } from 'next/navigation';

import IntegrationCard from '@/components/dashboard/IntegrationCard';
import HabitSelector from '@/components/dashboard/HabitSelector';
import HabitBarChart from '@/components/dashboard/HabitBarChart';
import HabitLineChart from '@/components/dashboard/HabitLineChart';
import HabitPieChart from '@/components/dashboard/HabitPieChart';
import StreakDonutChart from '@/components/dashboard/StreakDonutChart';

export default function DashboardPage() {
  const { isAuthenticated, isSessionLoading } = useSession();
  const { isUserLoading, user } = useUser();
  const { outbound } = useDescope();
  const router = useRouter();

  const [connectedApps, setConnectedApps] = useState<Record<string, boolean>>({});
  const [habitsData, setHabitsData] = useState<any[]>([]);
  const [userData, setUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedHabit, setSelectedHabit] = useState<any | null>(null);

  useEffect(() => {
    const fetchConnectedApps = async () => {
      if (!user?.userId) return;
      try {
        const res = await fetch("/api/connected-apps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.userId }),
        });
        if (res.ok) {
          const data = await res.json();
          setConnectedApps(data);
        }
      } catch (err) {
        console.error(err);
      }
    };

    const fetchHabitsData = async () => {
      if (!user?.userId) return;
      try {
        const res = await fetch("/api/habits", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.userId }),
        });
        if (res.ok) {
          const data = await res.json();
          setHabitsData(data.habits || []);
          if (data.habits && data.habits.length > 0) {
            setSelectedHabit(data.habits[0]);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };

    const fetchUserData = async () => {
      if (!user?.userId) return;
      try {
        const res = await fetch("/api/streaks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.userId }),
        });
        if (res.ok) {
          const data = await res.json();
          setUserData(data.user || null);
        }
      } catch (err) {
        console.error("Error fetching userData:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchConnectedApps();
    fetchHabitsData();
    fetchUserData();
  }, [user?.userId]);

  const handleConnect = async (providerId: string) => {
    try {
      const response = await outbound.connect(providerId, {
        redirectUrl: process.env.NEXT_PUBLIC_BASE_URL + "/dashboard",
      });
      if (response?.data?.url) {
        window.location.href = response.data.url;
      }
    } catch (error) {
      console.error(error);
    }
  };

  if (isSessionLoading || isUserLoading || loading) {
    return <p className="text-white">Loading...</p>;
  }

  if (!isAuthenticated) {
    return <p className="text-white">You are not logged in</p>;
  }

  // Data for charts
  const barChartData = selectedHabit
    ? [
        {
          name: selectedHabit.name,
          current: selectedHabit.streaks?.current || 0,
          longest: selectedHabit.streaks?.longest || 0,
        },
      ]
    : [];

  const lineChartData =
    selectedHabit?.logs?.map((log: any, idx: number) => ({
      day: `Day ${idx + 1}`,
      completed: log.completed ? 1 : 0,
    })) || [];

  const pieChartData = selectedHabit
    ? [
        {
          name: "Completed",
          value:
            selectedHabit.logs?.filter((l: any) => l.completed).length || 0,
        },
        {
          name: "Missed",
          value:
            selectedHabit.logs?.filter((l: any) => !l.completed).length || 0,
        },
      ]
    : [];

  return (
    <div className="p-8 bg-gray-900 min-h-screen text-white space-y-10">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Dashboard</h2>
        <div className="flex gap-3">
          <button
            onClick={() => router.push("/onboarding")}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            + Add Habits
          </button>
          <button
            onClick={() => router.push("/login")}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Log Out
          </button>
        </div>
      </div>

      {/* Integrations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <IntegrationCard
          app="Google Calendar"
          providerId="google-calendar"
          connected={connectedApps["googleCalendar"] || false}
          onConnect={handleConnect}
        />
        <IntegrationCard
          app="Slack"
          providerId="slack"
          connected={connectedApps["slack"] || false}
          onConnect={handleConnect}
        />
      </div>

      {/* Habit selector */}
      <HabitSelector
        habits={habitsData}
        selectedHabit={selectedHabit}
        setSelectedHabit={setSelectedHabit}
      />

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <HabitBarChart data={barChartData} />
        <HabitLineChart data={lineChartData} />
        <HabitPieChart data={pieChartData} />
      </div>
      <div>
        <StreakDonutChart
          current={userData?.streaks?.current || 0}
          longest={userData?.streaks?.longest || 0}
        />
      </div>
    </div>
  );
}
  