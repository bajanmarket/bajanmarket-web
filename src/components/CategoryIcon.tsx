import {
  Car, Home, Laptop, Smartphone, Armchair, Shirt, Flower, Briefcase, Wrench,
  PawPrint, Dumbbell, Printer, Sprout, UtensilsCrossed, HeartPulse, GraduationCap,
  PartyPopper, CircleDot, MoreHorizontal, Tag,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  Car, Home, Laptop, Smartphone, Armchair, Shirt, Flower, Briefcase, Wrench,
  PawPrint, Dumbbell, Printer, Sprout, UtensilsCrossed, HeartPulse, GraduationCap,
  PartyPopper, CircleDot, MoreHorizontal,
};

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = MAP[name] ?? Tag;
  return <Icon className={className} />;
}
