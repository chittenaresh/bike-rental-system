import React, { useEffect } from 'react';
import useEmblaCarousel from 'embla-carousel-react';

interface HeroImage {
  id: string;
  imageUrl: string;
  title: string;
  subtitle: string;
}

interface HeroCarouselProps {
  images: HeroImage[];
}

export function HeroCarousel({ images }: HeroCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: images.length > 1,
  });

  useEffect(() => {
    if (!emblaApi) return;

    // Auto-play only if multiple images
    let intervalId: NodeJS.Timeout;
    if (images.length > 1) {
      intervalId = setInterval(() => {
        emblaApi.scrollNext();
      }, 5000); // 5 seconds
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [emblaApi, images.length]);

  if (!images || images.length === 0) return null;

  return (
    <div className="absolute inset-0 h-full w-full overflow-hidden">
      <div className="h-full w-full" ref={emblaRef}>
        <div className="flex h-full w-full">
          {images.map((image, index) => (
            <div key={image.id} className="relative flex-[0_0_100%] h-full w-full min-w-0">
              {/* Background Image */}
              <img
                src={image.imageUrl}
                alt="Premium Bike Rental Service - RideFlow"
                loading={index === 0 ? 'eager' : 'lazy'}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500"
              />
              {/* Overlay - lighter opacity to show images better */}
              <div className="absolute inset-0 bg-background/40 backdrop-blur-[0px]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
