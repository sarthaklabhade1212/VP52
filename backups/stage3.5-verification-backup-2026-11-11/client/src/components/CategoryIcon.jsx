import React from 'react';
import {
  ShoppingBag,
  UtensilsCrossed,
  Shirt,
  HeartPulse,
  Tv,
  Wrench,
  Sparkles,
  Truck,
  GraduationCap,
  Building2,
  PartyPopper,
  Scale,
  Briefcase,
  Smartphone,
  HardHat,
  FileText,
  HandHelping,
  Store
} from 'lucide-react';

const ICON_MAP = {
  ShoppingBag,
  UtensilsCrossed,
  Shirt,
  HeartPulse,
  Tv,
  Wrench,
  Sparkles,
  Truck,
  GraduationCap,
  Building2,
  PartyPopper,
  Scale,
  Briefcase,
  Smartphone,
  HardHat,
  FileText,
  HandHelping,
  Store
};

export default function CategoryIcon({ name, size = 18, color = '#D4AF37', style = {} }) {
  const IconComponent = ICON_MAP[name] || Store;
  return <IconComponent size={size} color={color} style={style} />;
}
