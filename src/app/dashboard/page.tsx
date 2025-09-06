'use client';

import { useState, useEffect } from 'react';
import { useDescope, useSession, useUser } from '@descope/nextjs-sdk/client';
import { useRouter } from 'next/navigation';

function IntegrationCard({ app, providerId, connected, onConnect }: {
  app: string;
  providerId: string;
  connected: boolean;
  onConnect: (providerId: string) => void;
}) {
  return (
    <div className="flex-shrink-0 p-4 flex justify-center items-center">
      <span className="p-2">{app}</span>
      {connected ? (
        <span className="text-green-600">✅ Connected</span>
      ) : (
        <button
          className="bg-blue-600 text-white px-3 py-1 rounded"
          onClick={() => onConnect(providerId)}
        >
          Connect
        </button>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { isAuthenticated,isSessionLoading } = useSession();
  const { isUserLoading, user } = useUser();
  const { outbound } = useDescope();
  const router = useRouter();

  const [connectedApps, setConnectedApps] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchConnectedApps = async () => {
      if (!user?.userId) return;

      try {
        const res = await fetch("/api/connected-apps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.userId }),
        });

        if (!res.ok) {
          console.error("Failed to fetch connected apps");
          return;
        }

        const data = await res.json();
        console.log("Connected apps:", data);
        setConnectedApps(data);
      } catch (err) {
        console.error("Error fetching connected apps:", err);
      }
    };

    fetchConnectedApps();
  }, [user?.userId]);

  const handleConnect = async (providerId: string) => {
    try {
      const response = await outbound.connect(providerId, {
        redirectUrl: "http://localhost:3000/dashboard",
      });

      if (response?.data?.url) {
        window.location.href = response.data.url;
      } else {
        console.warn("No redirect URL found in response");
      }
    } catch (error) {
      console.error("Connection failed:", error);
    }
  };

  if (isSessionLoading || isUserLoading) {
    return <p>Loading...</p>;
  }

  if (isAuthenticated) {
    return (
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Connected Apps</h2>
          <button
            onClick={() => router.push('/onboarding')}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
          >
            + Add Habits
          </button>
        </div>
        <div className="space-y-4">
          <IntegrationCard
            app="Google Calendar"
            providerId="google-calendar"
            connected={connectedApps['googleCalendar'] || false}
            onConnect={handleConnect}
          />
          <IntegrationCard
            app="Slack"
            providerId="slack"
            connected={connectedApps['slack'] || false}
            onConnect={handleConnect}
          />
        </div>
      </div>
    );
  }
  
  return (
    <>
      <p>You are not logged in</p>
    </>
  );
}
