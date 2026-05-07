import { useState, useEffect } from "react";

interface CircularTimerProps {
  createdAt: Date | string;
  maxHours?: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}

export function CircularTimer({
  createdAt,
  maxHours = 24,
}: CircularTimerProps) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const created = new Date(createdAt).getTime();
    const updateElapsed = () => setElapsedMs(Date.now() - created);
    updateElapsed();
    const interval = setInterval(updateElapsed, 60000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const maxMs = maxHours * 60 * 60 * 1000;
  const progress = Math.min(elapsedMs / maxMs, 1);
  const remainingMs = Math.max(0, maxMs - elapsedMs);

  const totalMinutes = Math.floor(remainingMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const getColor = () => {
    if (progress >= 0.9) return { bar: "bg-red-500", text: "text-red-600" };
    if (progress >= 0.75) return { bar: "bg-amber-500", text: "text-amber-600" };
    if (progress >= 0.5) return { bar: "bg-yellow-400", text: "text-yellow-600" };
    return { bar: "bg-emerald-500", text: "text-emerald-600" };
  };

  const { bar, text } = getColor();

  const formatTime = () => {
    if (progress >= 1) return "Expired";
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const barWidth = `${Math.max(0, (1 - progress) * 100)}%`;

  return (
    <div className="flex flex-col items-end gap-0.5 w-fit">
      <span className={`text-xs font-bold tabular-nums ${progress >= 1 ? "text-red-600" : text}`}>
        {formatTime()}
      </span>
      <div className="w-full h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${bar}`}
          style={{ width: barWidth }}
        />
      </div>
      <span className="text-[10px] text-gray-400 font-medium leading-none">
        {progress >= 1 ? "Expired" : "Remaining"}
      </span>
    </div>
  );
}

interface LargeCircularTimerProps {
  createdAt: Date | string;
  maxHours?: number;
}

export function LargeCircularTimer({ createdAt, maxHours = 24 }: LargeCircularTimerProps) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const created = new Date(createdAt).getTime();
    const updateElapsed = () => setElapsedMs(Date.now() - created);
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const maxMs = maxHours * 60 * 60 * 1000;
  const progress = Math.min(elapsedMs / maxMs, 1);
  const remainingMs = Math.max(0, maxMs - elapsedMs);

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const size = 120;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * progress;

  const getColor = () => {
    if (progress >= 0.9) return "#EF4444";
    if (progress >= 0.75) return "#F59E0B";
    if (progress >= 0.5) return "#EAB308";
    return "#22C55E";
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={getColor()}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {progress >= 1 ? (
            <span className="text-2xl font-bold text-red-500">Expired</span>
          ) : (
            <>
              <span className="text-xl font-bold text-gray-800">
                {hours.toString().padStart(2, "0")}:{minutes.toString().padStart(2, "0")}
              </span>
              <span className="text-sm text-gray-500">
                :{seconds.toString().padStart(2, "0")}
              </span>
            </>
          )}
        </div>
      </div>
      <span className="text-sm text-gray-600 mt-2 font-medium">
        {progress >= 1 ? "Ticket expired" : "Time remaining (24h)"}
      </span>
    </div>
  );
}
