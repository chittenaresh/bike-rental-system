export interface PricingSlab {
  price: number;
  duration_min: number; // in hours
  duration_max: number; // in hours
  included_km: number;
  extra_km_price: number;
  minimum_booking_rule: 'none' | 'min_duration' | 'min_price';
  minimum_value: number;
}

export interface Bike {
  id: string;
  name: string;
  type: 'fuel' | 'electric' | 'scooter';
  category?: 'budget' | 'midrange' | 'topend';
  brand?: string;
  year?: number;
  image: string;
  images?: string[];
  // Legacy fields for backward compatibility
  pricePerHour?: number;
  // New simple pricing fields
  price12Hours?: number;
  pricePerWeek?: number;

  // Tariff Configuration
  weekdayRate?: number; // Mon-Thu hourly rate
  weekendRate?: number; // Fri-Sun hourly rate
  excessKmCharge?: number;
  kmLimitPerHour?: number;
  minBookingHours?: number;

  kmLimit?: number;
  // New pricing model
  pricingSlabs?: {
    hourly?: PricingSlab;
    daily?: PricingSlab;
    weekly?: PricingSlab;
  };
  weekendSurgeMultiplier?: number;
  gstPercentage?: number;
  available: boolean;
  status?: 'available' | 'maintenance' | 'disabled';
  description: string;
  features: string[];
  locationId: string | null;
  location?: {
    id: string;
    name: string;
    city: string;
    state: string;
  };
}

export interface Location {
  id: string;
  name: string;
  city: string;
  state: string;
  country: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin' | 'superadmin';
  walletBalance: number;
  documents: Document[];
  createdAt: string;
}

export interface Document {
  id: string;
  userId: string;
  name: string;
  type: 'license' | 'id' | 'other';
  url: string;
  status: 'pending' | 'approved' | 'rejected';
  uploadedAt: string;
}

export interface HeroImage {
  id: string;
  imageUrl: string;
  title?: string;
  subtitle?: string;
  order: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Rental {
  id: string;
  bikeId: string | Bike; // Can be populated
  userId: string | User; // Can be populated
  startTime: string;
  endTime?: string;
  pickupTime?: string;
  dropoffTime?: string;
  totalAmount?: number; // Initial booking amount
  totalCost?: number; // Final total cost
  status: 'active' | 'ongoing' | 'completed' | 'cancelled' | 'confirmed';
  paymentStatus?: string;
  startKm?: string;
  endKm?: string;
  delay?: string;
  bike?: Bike; // Sometimes populated separately
  bookingId?: string;
}
