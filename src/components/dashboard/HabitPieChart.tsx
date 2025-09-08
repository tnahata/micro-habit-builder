import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

export default function HabitPieChart({ data }: { data: any[] }) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="bg-gray-800 p-6 rounded shadow-lg">
      <h4 className="font-semibold text-lg mb-4">Completion vs Missed</h4>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={({ name, value }) => {
              const safeValue = value ?? 0;
              const pct = total > 0 ? ((safeValue / total) * 100).toFixed(0) : "0";
              return `${name}: ${pct}%`;
            }}
          >
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.name === "Completed" ? "#4ade80" : "#f87171"}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: 'none' }}
            itemStyle={{ color: '#fff' }}
            formatter={(value: number) => `${value} day(s)`}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
