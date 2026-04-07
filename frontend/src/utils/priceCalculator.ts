/**
 * Frontend price calculation utility for bike rentals
 * Handles base price, excess km charges, GST, and weekend surge pricing
 */

import { Bike, PricingSlab } from '@/types';

/**
 * Check if a date falls on a weekend (Saturday or Sunday)
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

/**
 * Check if any part of the rental period falls on a weekend
 */
export function hasWeekendPeriod(startDate: Date, endDate: Date): boolean {
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return false;
  if (startDate > endDate) return false;

  const current = new Date(startDate);
  const end = new Date(endDate);

  // Safety counter
  let days = 0;
  while (current <= end && days < 100) {
    // Max 100 days
    days++;
    if (isWeekend(current)) {
      return true;
    }
    // Move to next day
    current.setDate(current.getDate() + 1);
  }

  return false;
}

export interface PriceBreakdown {
  basePrice: number;
  priceAfterSurge: number;
  surgeMultiplier: number;
  hasWeekend: boolean;
  excessKm: number;
  excessKmCharge: number;
  subtotal: number;
  gstPercentage: number;
  gstAmount: number;
  total: number;
  durationHours: number;
  pricingType: string;
  includedKm: number;
  extraKmPrice: number;
  breakdown?: string;
}

/**
 * Calculate rental price with all charges
 */
export function calculateRentalPrice(
  bike: Bike,
  startDate: Date,
  endDate: Date,
  pricingType: 'hourly' | 'daily' | 'weekly',
  actualKm: number | null = null
): PriceBreakdown {
  const durationMs = endDate.getTime() - startDate.getTime();
  const durationHours = Math.max(0, durationMs / (1000 * 60 * 60));

  // Get pricing slab
  let pricingSlab: PricingSlab | null = null;
  if (bike.pricingSlabs && bike.pricingSlabs[pricingType]) {
    pricingSlab = bike.pricingSlabs[pricingType];
  } else {
    // Fallback to legacy pricePerHour
    if (bike.pricePerHour) {
      return calculateLegacyPrice(bike, durationHours, actualKm);
    }
    throw new Error(`Pricing slab '${pricingType}' not found for bike ${bike.name}`);
  }

  if (!pricingSlab) {
    throw new Error(`Pricing slab '${pricingType}' not found`);
  }

  // Validate duration against slab
  if (durationHours < pricingSlab.duration_min || durationHours > pricingSlab.duration_max) {
    throw new Error(
      `Duration ${durationHours.toFixed(2)} hours is outside the valid range for ${pricingType} pricing (${pricingSlab.duration_min}-${pricingSlab.duration_max} hours)`
    );
  }

  // Calculate base price
  let basePrice = pricingSlab.price;

  // Apply minimum booking rule
  if (pricingSlab.minimum_booking_rule === 'min_duration') {
    if (durationHours < pricingSlab.minimum_value) {
      // Calculate price as if minimum duration was used
      basePrice = pricingSlab.price * (pricingSlab.minimum_value / durationHours);
    }
  } else if (pricingSlab.minimum_booking_rule === 'min_price') {
    basePrice = Math.max(basePrice, pricingSlab.minimum_value);
  }

  // Apply weekend surge pricing
  const hasWeekend = hasWeekendPeriod(startDate, endDate);
  const surgeMultiplier = hasWeekend ? bike.weekendSurgeMultiplier || 1.0 : 1.0;
  const priceAfterSurge = basePrice * surgeMultiplier;

  // Calculate excess km charges
  let excessKm = 0;
  let excessKmCharge = 0;
  if (actualKm !== null && actualKm > pricingSlab.included_km) {
    excessKm = Math.max(0, actualKm - pricingSlab.included_km);
    excessKmCharge = excessKm * pricingSlab.extra_km_price;
  }

  // Calculate subtotal
  const subtotal = priceAfterSurge + excessKmCharge;

  // Calculate GST - use the bike's gstPercentage if available, otherwise default to 18%
  // Ensure gstPercentage is a number and handle null/undefined/0 values correctly
  const gstPercentage =
    bike.gstPercentage !== undefined && bike.gstPercentage !== null
      ? Number(bike.gstPercentage)
      : 18.0;
  const gstAmount = (subtotal * gstPercentage) / 100;

  // Calculate total
  const total = subtotal + gstAmount;

  return {
    basePrice,
    priceAfterSurge,
    surgeMultiplier,
    hasWeekend,
    excessKm,
    excessKmCharge,
    subtotal,
    gstPercentage,
    gstAmount,
    total,
    durationHours,
    pricingType,
    includedKm: pricingSlab.included_km,
    extraKmPrice: pricingSlab.extra_km_price,
    breakdown: undefined,
  };
}

/**
 * Legacy price calculation (for backward compatibility)
 */
function calculateLegacyPrice(
  bike: Bike,
  durationHours: number,
  actualKm: number | null = null
): PriceBreakdown {
  const basePrice = (bike.pricePerHour || 0) * durationHours;

  // Calculate excess km charges (if kmLimit exists)
  let excessKm = 0;
  let excessKmCharge = 0;
  if (actualKm !== null && bike.kmLimit && actualKm > bike.kmLimit) {
    excessKm = actualKm - bike.kmLimit;
    // Default extra km price
    const extraKmPrice = 5; // ₹5 per extra km
    excessKmCharge = excessKm * extraKmPrice;
  }

  const subtotal = basePrice + excessKmCharge;
  // Calculate GST - use the bike's gstPercentage if available, otherwise default to 18%
  // Ensure gstPercentage is a number and handle null/undefined/0 values correctly
  const gstPercentage =
    bike.gstPercentage !== undefined && bike.gstPercentage !== null
      ? Number(bike.gstPercentage)
      : 18.0;
  const gstAmount = (subtotal * gstPercentage) / 100;
  const total = subtotal + gstAmount;

  return {
    basePrice,
    priceAfterSurge: basePrice,
    surgeMultiplier: 1.0,
    hasWeekend: false,
    excessKm,
    excessKmCharge,
    subtotal,
    gstPercentage,
    gstAmount,
    total,
    durationHours,
    pricingType: 'hourly',
    includedKm: bike.kmLimit || 0,
    extraKmPrice: 5,
    breakdown: undefined,
  };
}

/**
 * Get available pricing slabs for a bike
 */
export function getAvailablePricingSlabs(bike: Bike): ('hourly' | 'daily' | 'weekly')[] {
  const available: ('hourly' | 'daily' | 'weekly')[] = [];
  if (bike.pricingSlabs) {
    if (bike.pricingSlabs.hourly) available.push('hourly');
    if (bike.pricingSlabs.daily) available.push('daily');
    if (bike.pricingSlabs.weekly) available.push('weekly');
  }

  // Check for tariff fields
  const hasTariff = bike.weekdayRate !== undefined || bike.weekendRate !== undefined;

  // If no pricing slabs but has legacy pricePerHour OR tariff fields, return hourly
  if (available.length === 0 && (bike.pricePerHour || hasTariff)) {
    available.push('hourly');
  }

  return available;
}
