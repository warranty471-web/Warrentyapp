import { Smartphone, WashingMachine, Car, Sofa, ShieldCheck } from 'lucide-react';

export const CATEGORIES = [
  { 
    id: 'Electronics', 
    name: 'Electronics & Gadgets', 
    icon: Smartphone, 
    color: 'bg-blue-500/10 text-blue-600 border border-blue-500/20',
    colorSolid: 'bg-blue-600',
    hover: 'hover:bg-blue-500/20'
  },
  { 
    id: 'Appliance', 
    name: 'Home Appliances', 
    icon: WashingMachine, 
    color: 'bg-amber-500/10 text-amber-600 border border-amber-500/20',
    colorSolid: 'bg-amber-600',
    hover: 'hover:bg-amber-500/20'
  },
  { 
    id: 'Vehicle', 
    name: 'Vehicles', 
    icon: Car, 
    color: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
    colorSolid: 'bg-emerald-600',
    hover: 'hover:bg-emerald-500/20'
  },
  { 
    id: 'Furniture', 
    name: 'Furniture & Decor', 
    icon: Sofa, 
    color: 'bg-purple-500/10 text-purple-600 border border-purple-500/20',
    colorSolid: 'bg-purple-600',
    hover: 'hover:bg-purple-500/20'
  },
  { 
    id: 'Other', 
    name: 'Others', 
    icon: ShieldCheck, 
    color: 'bg-slate-500/10 text-slate-600 border border-slate-500/20',
    colorSolid: 'bg-slate-600',
    hover: 'hover:bg-slate-500/20'
  }
];

export function getCategoryDetails(categoryName) {
  const match = CATEGORIES.find(c => c.id === categoryName);
  if (match) return match;
  
  // Try case-insensitive comparison or generic match
  const lower = (categoryName || '').toLowerCase();
  if (lower.includes('electronic') || lower.includes('phone') || lower.includes('gadget') || lower.includes('laptop')) {
    return CATEGORIES[0];
  }
  if (lower.includes('appliance') || lower.includes('kitchen') || lower.includes('tv') || lower.includes('ac')) {
    return CATEGORIES[1];
  }
  if (lower.includes('vehicle') || lower.includes('car') || lower.includes('bike') || lower.includes('motor')) {
    return CATEGORIES[2];
  }
  if (lower.includes('furniture') || lower.includes('decor') || lower.includes('table') || lower.includes('chair')) {
    return CATEGORIES[3];
  }
  return CATEGORIES[4]; // Return 'Other' details
}
