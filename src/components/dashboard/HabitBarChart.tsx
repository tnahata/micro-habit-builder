import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

export default function HabitBarChart({ data }: { data: any[] }) {
  return (
    <div className="bg-gray-800 p-6 rounded shadow-lg">
      <h4 className="font-semibold text-lg mb-4">Current vs Longest Streaks</h4>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <XAxis dataKey="name" stroke="#ccc" />
          <YAxis stroke="#ccc" />
          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} itemStyle={{ color: '#fff' }} />
          <Legend wrapperStyle={{ color: '#ccc' }} />
          <Bar dataKey="current" fill="#4ade80" name="Current Streak" />
          <Bar dataKey="longest" fill="#2563eb" name="Longest Streak" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
