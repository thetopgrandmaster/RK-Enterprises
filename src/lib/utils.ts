import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatWeight(kg: number): string {
  if (isNaN(kg)) return '0 x 000';
  const whole = Math.floor(kg);
  const fraction = Math.round((kg - whole) * 1000);
  return `${whole} x ${fraction.toString().padStart(3, '0')}`;
}

export function parseWeight(raw: string): number {
  if (!raw) return 0;
  // Handle both 'x' and '.' as separators
  const cleanRaw = raw.replace('x', '.');
  const parts = cleanRaw.split('.');
  
  if (parts.length === 1) {
    // If just a number like "16.8", treat as 16.800
    const val = parseFloat(parts[0]);
    return isNaN(val) ? 0 : val;
  }
  
  if (parts.length === 2) {
    const whole = parseInt(parts[0].trim(), 10) || 0;
    let fractionStr = parts[1].trim();
    
    // Standardize to 3 digits for grams
    // If "95", treat as "950"
    // If "9", treat as "900"
    // If "09", treat as "090"
    if (fractionStr.length === 1) fractionStr += "00";
    else if (fractionStr.length === 2) fractionStr += "0";
    else if (fractionStr.length > 3) fractionStr = fractionStr.substring(0, 3);
    
    const fraction = parseInt(fractionStr, 10) || 0;
    return whole + (fraction / 1000);
  }
  
  return 0;
}

export function formatCurrency(amount: number): string {
  const rounded = customRound(amount);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(rounded);
}

export function customRound(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const absValue = Math.abs(value);
  const floor = Math.floor(absValue);
  const decimal = absValue - floor;
  
  // Round up only if decimal is 0.9 or greater
  if (decimal >= 0.9) {
    return sign * Math.ceil(absValue);
  }
  // Otherwise round down (towards zero for magnitude)
  return sign * floor;
}
