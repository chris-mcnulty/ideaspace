import { useState, useEffect } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  endTime: Date | string | null;
  onExpire?: () => void;
  className?: string;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
}

export function CountdownTimer({
  endTime,
  onExpire,
  className,
  showIcon = true,
  size = "md",
}: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!endTime) {
      setTimeRemaining(0);
      setIsExpired(false);
      return;
    }

    const targetTime = typeof endTime === "string" ? new Date(endTime) : endTime;

    const calculateRemaining = () => {
      const now = new Date();
      const diff = targetTime.getTime() - now.getTime();
      return Math.max(0, diff);
    };

    const initialRemaining = calculateRemaining();
    setTimeRemaining(initialRemaining);
    
    // Reset expired state when endTime changes - allows timer to restart for new sessions
    const initiallyExpired = initialRemaining <= 0;
    setIsExpired(initiallyExpired);
    
    // If already expired on mount, fire callback immediately and don't start interval
    if (initiallyExpired) {
      onExpire?.();
      return;
    }
    
    // Track if we've already fired the expire callback to prevent double-firing
    let hasExpired = false;

    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setTimeRemaining(remaining);

      if (remaining <= 0 && !hasExpired) {
        hasExpired = true;
        setIsExpired(true);
        onExpire?.();
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime, onExpire]);

  if (!endTime) {
    return null;
  }

  const totalSeconds = Math.floor(timeRemaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const formatTime = () => {
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  const isWarning = totalSeconds <= 300 && totalSeconds > 60;
  const isCritical = totalSeconds <= 60;
  const isUrgent = totalSeconds <= 30;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-1.5 font-semibold",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  if (isExpired) {
    return (
      <Badge
        variant="destructive"
        className={cn(sizeClasses[size], "gap-1.5 animate-pulse", className)}
        data-testid="timer-expired"
      >
        {showIcon && <AlertTriangle className={iconSizes[size]} />}
        <span className="font-mono tabular-nums">Time's Up!</span>
      </Badge>
    );
  }

  return (
    <Badge
      variant={isCritical ? "destructive" : isWarning ? "secondary" : "outline"}
      className={cn(
        sizeClasses[size],
        "gap-1.5 transition-colors duration-300",
        isUrgent && "animate-pulse",
        isCritical && "bg-red-600 hover:bg-red-600 text-white border-red-600",
        isWarning && "bg-yellow-500/20 hover:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500",
        className
      )}
      data-testid="timer-countdown"
    >
      {showIcon && (
        <Clock
          className={cn(
            iconSizes[size],
            isCritical ? "text-white" : isWarning ? "text-yellow-600 dark:text-yellow-400" : "text-muted-foreground"
          )}
        />
      )}
      <span className="font-mono tabular-nums">{formatTime()}</span>
    </Badge>
  );
}

export function useCountdownTimer(endTime: Date | string | null) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!endTime) {
      setTimeRemaining(0);
      setIsExpired(false);
      return;
    }

    const targetTime = typeof endTime === "string" ? new Date(endTime) : endTime;

    const calculateRemaining = () => {
      const now = new Date();
      const diff = targetTime.getTime() - now.getTime();
      return Math.max(0, diff);
    };

    const remaining = calculateRemaining();
    setTimeRemaining(remaining);
    setIsExpired(remaining <= 0);

    if (remaining <= 0) return;

    const interval = setInterval(() => {
      const newRemaining = calculateRemaining();
      setTimeRemaining(newRemaining);

      if (newRemaining <= 0) {
        setIsExpired(true);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime]);

  const totalSeconds = Math.floor(timeRemaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    timeRemaining,
    totalSeconds,
    hours,
    minutes,
    seconds,
    isExpired,
    isWarning: totalSeconds <= 300 && totalSeconds > 60,
    isCritical: totalSeconds <= 60,
    formatted: hours > 0
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      : `${minutes}:${String(seconds).padStart(2, "0")}`,
  };
}
