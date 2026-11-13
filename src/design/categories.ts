// One icon and one colour per spending category, used by every list, chart and
// chip. Before this, some screens used emoji and others line icons, and the
// same category could be two different colours on two screens.
import {
  ArrowLeftRight, Banknote, Car, CircleDollarSign, HeartPulse, Plane, Repeat, ShoppingBag, Ticket, Utensils, Zap,
  type LucideIcon,
} from 'lucide-react-native';

export interface CategoryStyle { icon: LucideIcon; color: string }

const STYLES: Record<string, CategoryStyle> = {
  'Food & Dining':     { icon: Utensils,       color: '#F59E0B' },
  'Shopping':          { icon: ShoppingBag,    color: '#EC4899' },
  'Subscriptions':     { icon: Repeat,         color: '#8B5CF6' },
  'Transportation':    { icon: Car,            color: '#0EA5E9' },
  'Bills & Utilities': { icon: Zap,            color: '#EAB308' },
  'Entertainment':     { icon: Ticket,         color: '#F43F5E' },
  'Health & Fitness':  { icon: HeartPulse,     color: '#10B981' },
  'Travel':            { icon: Plane,          color: '#6366F1' },
  'Income':            { icon: Banknote,       color: '#22C55E' },
  'Transfer':          { icon: ArrowLeftRight, color: '#64748B' },
};

const FALLBACK: CategoryStyle = { icon: CircleDollarSign, color: '#94A3B8' };

export const categoryStyle = (category: string): CategoryStyle => STYLES[category] ?? FALLBACK;
