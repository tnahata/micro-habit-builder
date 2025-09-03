'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDescope, useSession, useUser } from '@descope/nextjs-sdk/client';

// ✅ Call our backend API instead of placeholder
async function fetchConnectedApps(sessionToken: string): Promise<Record<string, boolean>> {
  try {
    const response = await fetch("/api/connected-apps", {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },    
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch connected apps: ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.error("Error fetching connected apps:", err);
    return {
      "google-calendar": false,
      "slack": false,
    };
  }
}

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
  const { isAuthenticated, isSessionLoading, sessionToken } = useSession();
  const { isUserLoading } = useUser();
  const { outbound } = useDescope();

  const [connectedApps, setConnectedApps] = useState<Record<string, boolean>>({});

  const handleConnect = useCallback(async (providerId: string) => {
    try {
      const response = await outbound.connect(providerId, { redirectUrl: "http://localhost:3000/dashboard" });

      console.log("Outbound connect response:", response);

      // ✅ Redirect user to provider auth page if URL exists
      if (response?.data?.url) {
        window.location.href = response.data.url;
      } else {
        console.warn("No redirect URL found in response");
      }
    } catch (error) {
      console.error("Connection failed:", error);
    }
  }, [outbound]);

  useEffect(() => {
    if (isAuthenticated && sessionToken) {
      fetchConnectedApps(sessionToken)
        .then(setConnectedApps)
        .catch(err => console.error('Failed to fetch connected apps:', err));
    }
  }, [isAuthenticated, sessionToken]);

  if (isSessionLoading || isUserLoading) {
    return <p>Loading...</p>;
  }

  if (isAuthenticated) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Connected Apps</h2>
        <div className="space-y-4">
          <IntegrationCard
            app="Google Calendar"
            providerId="google-calendar"
            connected={connectedApps['google-calendar'] || false}
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

  return <p>You are not logged in</p>;
}
