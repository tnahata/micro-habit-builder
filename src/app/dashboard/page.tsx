'use client';
 
import { useCallback } from 'react';
import { useDescope, useSession, useUser } from '@descope/nextjs-sdk/client';

function IntegrationCard({ app, connected }: { app: string; connected: boolean }) {
  return (
    <div className="flex-shrink-0 p-4 flex justify-center items-center">
      <span className="p-2">{app}</span>
      {connected ? (
        <span className="text-green-600">✅ Connected</span>
      ) : (
        <button className="bg-blue-600 text-white px-3 py-1 rounded">
          Connect
        </button>
      )}
    </div>
  );
}

export default function Dashboard() {
	// NOTE - `useDescope`, `useSession`, `useUser` should be used inside `AuthProvider` context,
	// and will throw an exception if this requirement is not met
	const { isAuthenticated, isSessionLoading, sessionToken } = useSession();
 
	// useUser retrieves the logged in user information
	const { user, isUserLoading } = useUser();
 
	if (isSessionLoading || isUserLoading) {
		return <p>Loading...</p>;
	}
 
	if (isAuthenticated) {
		return (
            <div className="p-4">
            <h2 className="text-xl font-bold mb-4">Connected Apps</h2>
            <div className="space-y-4">
                <IntegrationCard app="Google Calendar" connected={true} /> {/** TODO: need to set the connected values based on user preferences and db state */}
                <IntegrationCard app="Slack" connected={false} />
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