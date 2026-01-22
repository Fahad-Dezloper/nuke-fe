import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a number as currency
 */
export function formatCurrency(
  value: number,
  currency: string = "USD",
  locale: string = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(value);
}

/**
 * Formats a percentage
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Formats a percentage with sign (+ or -)
 */
export function formatPercentWithSign(
  value: number,
  decimals: number = 2
): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

/**
 * Formats a price with specific decimal places
 */
export function formatPrice(
  price: number,
  currency: string = "USD",
  locale: string = "en-US",
  minFractionDigits: number = 1,
  maxFractionDigits: number = 1
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: maxFractionDigits,
  }).format(price);
}

/**
 * Formats a price change percentage
 */
export function formatPriceChange(
  change: number,
  decimals: number = 2
): string {
  return `${change >= 0 ? "+" : ""}${change.toFixed(decimals)}%`;
}

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
