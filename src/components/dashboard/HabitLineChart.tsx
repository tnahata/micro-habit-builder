import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';

export default function HabitLineChart({ data }: { data: any[] }) {
  return (
    <div className="bg-gray-800 p-6 rounded shadow-lg">
      <h4 className="font-semibold text-lg mb-4">Habit Progress (Line Chart)</h4>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <XAxis dataKey="day" stroke="#ccc" />
          <YAxis
            stroke="#ccc"
            ticks={[0, 1]}
            tickFormatter={(value) => (value === 1 ? "Done" : "Missed")}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: 'none' }}
            itemStyle={{ color: '#fff' }}
            formatter={(value: number) => (value === 1 ? "Completed" : "Missed")}
          />
          <Legend wrapperStyle={{ color: '#ccc' }} />
          <Line
            type="stepAfter"
            dataKey="completed"
            stroke="#22d3ee"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
