type Props = {
  habits: any[];
  selectedHabit: any | null;
  setSelectedHabit: (habit: any | null) => void;
};

export default function HabitSelector({ habits, selectedHabit, setSelectedHabit }: Props) {
  return (
    <div className="mt-6">
      <label className="mr-2 text-lg font-medium">Select Habit:</label>
      <select
        value={selectedHabit?.name || ""}
        onChange={(e) => {
          const habit = habits.find(h => h.name === e.target.value);
          setSelectedHabit(habit || null);
        }}
        className="bg-gray-800 text-white px-3 py-2 rounded"
      >
        {habits.map((habit, idx) => (
          <option key={idx} value={habit.name}>
            {habit.name}
          </option>
        ))}
      </select>
    </div>
  );
}
