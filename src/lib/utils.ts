import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatWeight(kg: number): string {
  const whole = Math.floor(kg);
  const fraction = Math.round((kg - whole) * 1000);
  return `${whole}x ${fraction.toString().padStart(3, '0')}`;
}

export function parseWeight(raw: string): number {
  // Handle both 'x' and '.' as separators
  const cleanRaw = raw.replace('x', '.');
  const parts = cleanRaw.split('.');
  
  if (parts.length === 1) {
    // If just a number like "16.8", treat as 16.800
    const val = parseFloat(parts[0]);
    return isNaN(val) ? 0 : val;
  }
  
  if (parts.length === 2) {
    const whole = parseInt(parts[0], 10);
    let fractionStr = parts[1].trim();
    
    // If fraction is single digit like "8", treat as "800"
    // If "80", treat as "800"
    // If "08", treat as "080"
    if (fractionStr.length === 1) fractionStr += "00";
    else if (fractionStr.length === 2) fractionStr += "0";
    
    const fraction = parseInt(fractionStr, 10);
    if (isNaN(whole) || isNaN(fraction)) return 0;
    return whole + (fraction / 1000);
  }
  
  return 0;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function customRound(value: number): number {
  const floor = Math.floor(value);
  const decimal = value - floor;
  if (decimal >= 0.9) {
    return Math.ceil(value);
  }
  return floor;
}
