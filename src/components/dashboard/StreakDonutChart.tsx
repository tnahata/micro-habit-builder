"use client";

import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

export default function StreakDonutChart({
  current,
  longest,
}: {
  current: number;
  longest: number;
}) {
  const percentage = longest > 0 ? (current / longest) * 100 : 0;

  return (
    <div className="bg-gray-800 p-6 rounded shadow-lg flex flex-col items-center">
      <h4 className="font-semibold text-lg mb-4">Overall Streak Progress</h4>
      <div style={{ width: 150, height: 150 }}>
        <CircularProgressbar
          value={percentage}
          text={`${current}/${longest}`}
          styles={buildStyles({
            textColor: "#fff",
            pathColor: "#22c55e",
            trailColor: "#fff",
            strokeLinecap: "round",
          })}
        />
      </div>
    </div>
  );
}
