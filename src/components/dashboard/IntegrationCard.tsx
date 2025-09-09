type Props = {
  app: string;
  providerId: string;
  connected: boolean;
  onConnect: (providerId: string) => void;
};

export default function IntegrationCard({ app, providerId, connected, onConnect }: Props) {
  return (
    <div className="p-4 flex justify-between items-center bg-gray-800 rounded shadow">
      <span className="text-white font-medium">{app}</span>
      {connected ? (
        <span className="text-green-400 font-semibold">✅ Connected</span>
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
