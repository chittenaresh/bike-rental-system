import { useState, useMemo, useRef, memo } from 'react';
import { Bike } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import Autoplay from 'embla-carousel-autoplay';
import { Gauge, Clock, Zap, Bike as BikeIcon } from 'lucide-react';
import { getAvailablePricingSlabs, calculateRentalPrice } from '@/utils/priceCalculator';
import { calculateSimplePrice } from '@/utils/simplePriceCalculator';

interface BikeCardProps {
  bike: Bike;
  onRent?: (bike: Bike, pricingType?: 'hourly' | 'daily' | 'weekly') => void;
  variant?: 'grid' | 'list';
  pickupDateTime?: Date;
  dropoffDateTime?: Date;
  durationHours?: number;
  docStatus?: { allApproved: boolean; hasDocs: boolean };
  isLoggedIn?: boolean;
}

const typeIcons = {
  fuel: Gauge,
  electric: Zap,
  scooter: BikeIcon,
};

const typeColors = {
  fuel: 'bg-accent/10 text-accent',
  electric: 'bg-primary/10 text-primary',
  scooter: 'bg-secondary text-secondary-foreground',
};

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const formatDate = (date: Date) => {
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};

const BikeImageSlider = memo(
  ({
    bike,
    TypeIcon,
    iconClassName = 'h-20 w-20',
  }: {
    bike: Bike;
    TypeIcon: any;
    iconClassName?: string;
  }) => {
    const plugin = useMemo(
      () => Autoplay({ delay: 3000, stopOnInteraction: true, stopOnMouseEnter: true }),
      []
    );

    const images = useMemo(() => {
      // 1. Filter out invalid/empty/hardcoded local fallback paths
      const isInvalidPath = (url: string) => {
        if (!url || typeof url !== 'string' || url.trim() === '') return true;
        const lowerUrl = url.toLowerCase();
        return (
          lowerUrl.includes('documents/') ||
          lowerUrl.includes('placeholder.png') ||
          lowerUrl.includes('uploads/') ||
          (!lowerUrl.startsWith('http') && !lowerUrl.startsWith('https') && !lowerUrl.startsWith('data:'))
        );
      };

      const validImages = (bike.images || []).filter((img) => !isInvalidPath(img));
      const mainImage = !isInvalidPath(bike.image) ? bike.image : null;

      // 2. Final logic: Prefer images from array, then main image
      const imgs = [...validImages];
      if (mainImage && !imgs.includes(mainImage)) {
        imgs.push(mainImage);
      }
      
      return [...new Set(imgs)];
    }, [bike.image, bike.images]);

    if (images.length === 0) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
          <TypeIcon className={`${iconClassName} text-muted-foreground/20`} />
        </div>
      );
    }

    if (images.length === 1) {
      return (
        <img
          src={images[0]}
          alt={bike.name}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      );
    }

    return (
      <Carousel
        className="w-full h-full group/carousel"
        opts={{ loop: true }}
        plugins={[plugin]}
        onMouseEnter={plugin.stop}
        onMouseLeave={plugin.reset}
      >
        <CarouselContent className="-ml-0 h-full">
          {images.map((img, idx) => (
            <CarouselItem key={idx} className="pl-0 h-full">
              <img
                src={img}
                alt={`${bike.name} view ${idx + 1}`}
                loading="lazy"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
        <div className="opacity-0 group-hover/carousel:opacity-100 transition-opacity">
          <CarouselPrevious className="left-2 bg-black/30 hover:bg-black/50 text-white border-none h-8 w-8" />
          <CarouselNext className="right-2 bg-black/30 hover:bg-black/50 text-white border-none h-8 w-8" />
        </div>
      </Carousel>
    );
  }
);

BikeImageSlider.displayName = 'BikeImageSlider';

export const BikeCard = memo(
  ({
    bike,
    onRent,
    variant = 'grid',
    pickupDateTime,
    dropoffDateTime,
    durationHours,
    docStatus,
    isLoggedIn,
  }: BikeCardProps) => {
    const TypeIcon = typeIcons[bike.type];
    const availableSlabs = getAvailablePricingSlabs(bike);
    const [selectedPricingType, setSelectedPricingType] = useState<'hourly' | 'daily' | 'weekly'>(
      availableSlabs[0] || 'hourly'
    );

    // Calculate price based on new simple pricing model or legacy
    const priceInfo = useMemo(() => {
      if (!pickupDateTime || !dropoffDateTime) {
        return null;
      }

      try {
        // Try new simple pricing model first
        const hasIndividualRates = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24].some(
          (hour) =>
            bike[`pricePerHour${hour}` as keyof typeof bike] &&
            Number(bike[`pricePerHour${hour}` as keyof typeof bike]) > 0
        );
        const hasTariff = bike.weekdayRate !== undefined || bike.weekendRate !== undefined;

        if (bike.price12Hours || hasIndividualRates || bike.pricePerWeek || hasTariff) {
          return calculateSimplePrice(bike, pickupDateTime, dropoffDateTime);
        }
        // Fallback to legacy pricing slabs
        return calculateRentalPrice(bike, pickupDateTime, dropoffDateTime, selectedPricingType);
      } catch (error) {
        console.error('Price calculation error:', error);
        return null;
      }
    }, [bike, pickupDateTime, dropoffDateTime, selectedPricingType]);

    // Get pricing slab info for display
    const currentSlab = bike.pricingSlabs?.[selectedPricingType];
    // For new pricing model, prioritize Tariff, then 12h Price, then Legacy
    const displayPrice =
      bike.weekdayRate ||
      (bike.price12Hours ? Math.round(bike.price12Hours / 12) : 0) ||
      bike.pricePerHour ||
      currentSlab?.price ||
      0;
    // Display static kmLimit value, not kmLimitPerHour
    const displayKmLimit = bike.kmLimit || currentSlab?.included_km || 0;

    if (variant === 'list') {
      return (
        <div className="bg-card rounded-2xl overflow-hidden shadow-card">
          <div className="relative h-44 overflow-hidden">
            <BikeImageSlider bike={bike} TypeIcon={TypeIcon} />
            <div className="absolute top-3 right-3 z-20">
              <Badge
                variant={bike.available ? 'default' : 'secondary'}
                className={bike.available ? 'bg-accent text-accent-foreground' : ''}
              >
                {bike.available ? 'Available' : 'In Use'}
              </Badge>
            </div>
            <div className="absolute top-3 left-3 z-20">
              <Badge className={typeColors[bike.type]}>
                <TypeIcon className="h-3 w-3 mr-1" />
                {bike.type.charAt(0).toUpperCase() + bike.type.slice(1)}
              </Badge>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <h3 className="font-display font-bold text-base whitespace-normal">{bike.name}</h3>
            {(bike.brand || bike.year) && (
              <p className="text-xs text-muted-foreground -mt-1 mb-2">
                {[bike.brand, bike.year].filter(Boolean).join(' • ')}
              </p>
            )}

            {/* Pricing Tabs */}
            {availableSlabs.length > 1 && (
              <Tabs
                value={selectedPricingType}
                onValueChange={(v) => setSelectedPricingType(v as typeof selectedPricingType)}
              >
                <TabsList
                  className="grid w-full"
                  style={{ gridTemplateColumns: `repeat(${availableSlabs.length}, 1fr)` }}
                >
                  {availableSlabs.map((slab) => (
                    <TabsTrigger key={slab} value={slab} className="text-xs capitalize">
                      {slab}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-xs">
                <Clock className="h-3 w-3 text-primary" />
                <span className="font-semibold">₹{displayPrice}</span>
                <span className="text-muted-foreground">
                  /
                  {selectedPricingType === 'hourly'
                    ? 'hr'
                    : selectedPricingType === 'daily'
                      ? 'day'
                      : 'week'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <Gauge className="h-3 w-3 text-accent" />
                <span className="font-semibold">{displayKmLimit}</span>
                <span className="text-muted-foreground">km</span>
              </div>
            </div>
            {bike.location?.name && (
              <div className="text-xs text-muted-foreground">
                Available at{' '}
                <span className="font-semibold text-foreground">{bike.location.name}</span>
              </div>
            )}
            {pickupDateTime && dropoffDateTime && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block">Pickup</span>
                  <span className="font-medium">
                    {formatTime(pickupDateTime)} {formatDate(pickupDateTime)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Dropoff</span>
                  <span className="font-medium">
                    {formatTime(dropoffDateTime)} {formatDate(dropoffDateTime)}
                  </span>
                </div>
              </div>
            )}
            {priceInfo && (
              <div className="text-sm font-semibold">
                Total: ₹{Math.round(priceInfo.total)}
                {priceInfo.hasWeekend && (
                  <span className="text-xs text-accent ml-2">(Weekend surge)</span>
                )}
              </div>
            )}
            <Button
              className="w-full"
              variant={bike.available ? 'default' : 'secondary'}
              disabled={!bike.available || (pickupDateTime && dropoffDateTime && durationHours === 0)}
              onClick={() => onRent?.(bike, selectedPricingType)}
            >
              {!isLoggedIn
                ? 'Login to Book'
                : pickupDateTime && dropoffDateTime && durationHours === 0
                  ? 'Invalid time range'
                  : bike.available
                    ? 'Rent Now'
                    : 'Not Available'}
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="group relative bg-card rounded-2xl overflow-hidden shadow-card hover:shadow-elevated transition-all duration-500 hover:-translate-y-2">
        <div className="relative h-56 overflow-hidden">
          <BikeImageSlider bike={bike} TypeIcon={TypeIcon} iconClassName="h-24 w-24" />
          <div className="absolute top-4 right-4 z-20">
            <Badge
              variant={bike.available ? 'default' : 'secondary'}
              className={bike.available ? 'bg-accent text-accent-foreground' : ''}
            >
              {bike.available ? 'Available' : 'In Use'}
            </Badge>
          </div>
          <div className="absolute top-4 left-4 z-20">
            <Badge className={typeColors[bike.type]}>
              <TypeIcon className="h-3 w-3 mr-1" />
              {bike.type.charAt(0).toUpperCase() + bike.type.slice(1)}
            </Badge>
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-display font-bold text-base mb-1 group-hover:text-primary transition-colors">
            {bike.name}
          </h3>
          {(bike.brand || bike.year) && (
            <p className="text-xs text-muted-foreground mb-3">
              {[bike.brand, bike.year].filter(Boolean).join(' • ')}
            </p>
          )}

          {/* Pricing Tabs */}
          {availableSlabs.length > 1 && (
            <Tabs
              value={selectedPricingType}
              onValueChange={(v) => setSelectedPricingType(v as typeof selectedPricingType)}
              className="mb-3"
            >
              <TabsList
                className="grid w-full"
                style={{ gridTemplateColumns: `repeat(${availableSlabs.length}, 1fr)` }}
              >
                {availableSlabs.map((slab) => (
                  <TabsTrigger key={slab} value={slab} className="text-xs capitalize">
                    {slab}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}

          {/* Pricing Information */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-primary" />
                <span className="font-semibold">₹{displayPrice}</span>
                <span className="text-muted-foreground">
                  /
                  {selectedPricingType === 'hourly'
                    ? 'hr'
                    : selectedPricingType === 'daily'
                      ? 'day'
                      : 'week'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Gauge className="h-3 w-3 text-accent" />
                <span className="font-semibold">{displayKmLimit}</span>
                <span className="text-muted-foreground">km</span>
              </div>
            </div>
            {currentSlab?.minimum_booking_rule !== 'none' && currentSlab?.minimum_value && (
              <div className="text-xs text-muted-foreground">
                Min:{' '}
                {currentSlab.minimum_booking_rule === 'min_duration'
                  ? `${currentSlab.minimum_value} hrs`
                  : `₹${currentSlab.minimum_value}`}
              </div>
            )}
          </div>

          {pickupDateTime && dropoffDateTime && (
            <div className="flex items-center justify-between mb-4 bg-muted/30 p-3 rounded-lg border border-border/50">
              <div className="text-left">
                <div className="font-bold text-sm text-foreground">
                  {formatTime(pickupDateTime)}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  {formatDate(pickupDateTime)}
                </div>
              </div>
              <div className="flex flex-col items-center justify-center px-2">
                <div className="w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center text-[10px] font-bold z-10">
                  to
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-sm text-foreground">
                  {formatTime(dropoffDateTime)}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  {formatDate(dropoffDateTime)}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 mt-auto">
            {priceInfo ? (
              <div className="flex flex-col">
                <div className="font-bold text-xl text-foreground">
                  ₹{Math.round(priceInfo.total)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {priceInfo.breakdown || (
                    <>
                      {priceInfo.hasWeekend && (
                        <span className="text-accent">Weekend surge applied</span>
                      )}
                      {!priceInfo.hasWeekend && (
                        <span>
                          Total for {Math.round(priceInfo.durationHours)}{' '}
                          {priceInfo.durationHours === 1 ? 'hr' : 'hrs'}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : durationHours && durationHours > 0 ? (
              <div className="flex flex-col">
                <div className="font-bold text-xl text-foreground">
                  ₹{Math.round((bike.pricePerHour || 0) * durationHours)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Total for {Math.round(durationHours)} hrs
                </div>
              </div>
            ) : null}
            <Button
              className={priceInfo || (durationHours && durationHours > 0) ? 'flex-1' : 'w-full'}
              variant={bike.available ? 'default' : 'secondary'}
              disabled={!bike.available || (pickupDateTime && dropoffDateTime && durationHours === 0)}
              onClick={() => onRent?.(bike, selectedPricingType)}
            >
              {!isLoggedIn
                ? 'Login to Book'
                : pickupDateTime && dropoffDateTime && durationHours === 0
                  ? 'Invalid range'
                  : bike.available
                    ? 'Rent Now'
                    : 'Not Available'}
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

BikeCard.displayName = 'BikeCard';
