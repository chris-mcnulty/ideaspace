import { Brain, Lightbulb, Rocket, Target, Zap, Users, Sparkles, TrendingUp, Compass, Star } from "lucide-react";

export type WorkspaceIconType = "brain" | "lightbulb" | "rocket" | "target" | "zap" | "users" | "sparkles" | "trending" | "compass" | "star";

export const WORKSPACE_ICONS: {
  id: WorkspaceIconType;
  label: string;
  Icon: typeof Brain;
  colors: {
    light: string;
    dark: string;
  };
}[] = [
  {
    id: "brain",
    label: "Brain",
    Icon: Brain,
    colors: { light: "text-purple-600", dark: "text-purple-400" },
  },
  {
    id: "lightbulb",
    label: "Lightbulb",
    Icon: Lightbulb,
    colors: { light: "text-yellow-600", dark: "text-yellow-400" },
  },
  {
    id: "rocket",
    label: "Rocket",
    Icon: Rocket,
    colors: { light: "text-blue-600", dark: "text-blue-400" },
  },
  {
    id: "target",
    label: "Target",
    Icon: Target,
    colors: { light: "text-red-600", dark: "text-red-400" },
  },
  {
    id: "zap",
    label: "Zap",
    Icon: Zap,
    colors: { light: "text-orange-600", dark: "text-orange-400" },
  },
  {
    id: "users",
    label: "Users",
    Icon: Users,
    colors: { light: "text-green-600", dark: "text-green-400" },
  },
  {
    id: "sparkles",
    label: "Sparkles",
    Icon: Sparkles,
    colors: { light: "text-pink-600", dark: "text-pink-400" },
  },
  {
    id: "trending",
    label: "Trending Up",
    Icon: TrendingUp,
    colors: { light: "text-emerald-600", dark: "text-emerald-400" },
  },
  {
    id: "compass",
    label: "Compass",
    Icon: Compass,
    colors: { light: "text-indigo-600", dark: "text-indigo-400" },
  },
  {
    id: "star",
    label: "Star",
    Icon: Star,
    colors: { light: "text-amber-600", dark: "text-amber-400" },
  },
];

export function getWorkspaceIcon(iconId: string) {
  return WORKSPACE_ICONS.find((icon) => icon.id === iconId) || WORKSPACE_ICONS[0];
}

interface WorkspaceIconProps {
  iconId: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function WorkspaceIcon({ iconId, size = "md", className = "" }: WorkspaceIconProps) {
  const iconData = getWorkspaceIcon(iconId);
  const Icon = iconData.Icon;

  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
    xl: "h-12 w-12",
  };

  return (
    <Icon
      className={`${sizeClasses[size]} ${iconData.colors.light} dark:${iconData.colors.dark} ${className}`}
      data-testid={`icon-workspace-${iconId}`}
    />
  );
}
