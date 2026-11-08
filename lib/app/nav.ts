import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  BarChart3,
  Megaphone,
  BadgeDollarSign,
  ShoppingBag,
  Library,
  CalendarDays,
  Trophy,
  History,
  Settings,
  CircleEllipsis,
} from "lucide-react";

export type WorkspaceNavItem = {
  href: string;
  label: string;
  mobileLabel?: string;
  match: (pathname: string) => boolean;
  icon: LucideIcon;
  desktop: boolean;
  /** Mobile bottom bar order (PDF: Головна, Продажі, Оголошення, Календар, Ще). */
  mobileBottom: boolean;
  mobileBottomOrder?: number;
  mobileMore: boolean;
  status: "live" | "soon";
};

export const WORKSPACE_NAV: WorkspaceNavItem[] = [
  {
    href: "/app",
    label: "Dashboard",
    mobileLabel: "Головна",
    match: (p) => p === "/app",
    icon: LayoutDashboard,
    desktop: true,
    mobileBottom: true,
    mobileBottomOrder: 1,
    mobileMore: false,
    status: "live",
  },
  {
    href: "/app/statistics",
    label: "Статистика",
    match: (p) => p.startsWith("/app/statistics"),
    icon: BarChart3,
    desktop: true,
    mobileBottom: false,
    mobileMore: true,
    status: "live",
  },
  {
    href: "/app/listings",
    label: "Оголошення",
    match: (p) => p.startsWith("/app/listings"),
    icon: Megaphone,
    desktop: true,
    mobileBottom: true,
    mobileBottomOrder: 3,
    mobileMore: false,
    status: "live",
  },
  {
    href: "/app/ads",
    label: "Реклама",
    match: (p) => p.startsWith("/app/ads"),
    icon: BadgeDollarSign,
    desktop: true,
    mobileBottom: false,
    mobileMore: true,
    status: "live",
  },
  {
    href: "/app/sales",
    label: "Продажі",
    match: (p) => p.startsWith("/app/sales"),
    icon: ShoppingBag,
    desktop: true,
    mobileBottom: true,
    mobileBottomOrder: 2,
    mobileMore: false,
    status: "live",
  },
  {
    href: "/app/models",
    label: "Банк моделей",
    match: (p) => p.startsWith("/app/models"),
    icon: Library,
    desktop: true,
    mobileBottom: false,
    mobileMore: true,
    status: "soon",
  },
  {
    href: "/app/calendar",
    label: "Календар",
    match: (p) => p.startsWith("/app/calendar"),
    icon: CalendarDays,
    desktop: true,
    mobileBottom: true,
    mobileBottomOrder: 4,
    mobileMore: false,
    status: "live",
  },
  {
    href: "/app/rating",
    label: "Рейтинг",
    match: (p) => p.startsWith("/app/rating"),
    icon: Trophy,
    desktop: true,
    mobileBottom: false,
    mobileMore: true,
    status: "live",
  },
  {
    href: "/app/history",
    label: "Історія",
    match: (p) => p.startsWith("/app/history"),
    icon: History,
    desktop: true,
    mobileBottom: false,
    mobileMore: true,
    status: "soon",
  },
  {
    href: "/app/settings",
    label: "Налаштування",
    match: (p) => p.startsWith("/app/settings"),
    icon: Settings,
    desktop: true,
    mobileBottom: false,
    mobileMore: true,
    status: "live",
  },
];

export const MOBILE_MORE_ITEM = {
  href: "/app/more",
  label: "Ще",
  match: (pathname: string) => pathname.startsWith("/app/more"),
  icon: CircleEllipsis,
} as const;

export function navLabel(item: WorkspaceNavItem, surface: "desktop" | "mobile") {
  if (surface === "mobile") {
    return item.mobileLabel ?? item.label;
  }
  return item.label;
}

export function mobileBottomItems() {
  return WORKSPACE_NAV.filter((i) => i.mobileBottom).sort(
    (a, b) => (a.mobileBottomOrder ?? 99) - (b.mobileBottomOrder ?? 99),
  );
}
