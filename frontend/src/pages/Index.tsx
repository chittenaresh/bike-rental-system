import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { BikeCard } from '@/components/BikeCard';
import { ArrowRight, Shield, Clock, Wallet, CheckCircle } from 'lucide-react';
import heroBike from '@/assets/hero-bike.png';
import { bikesAPI, settingsAPI, heroImagesAPI, getCurrentUser, locationsAPI } from '@/lib/api';
import { Bike } from '@/types';
import { HeroCarousel } from '@/components/HeroCarousel';
import { SEO } from '@/components/SEO';

const features = [
  {
    icon: Shield,
    title: 'Fully Insured',
    description: 'All rentals include comprehensive insurance coverage.',
  },
  {
    icon: Clock,
    title: 'Flexible Hours',
    description: 'Rent by the hour, day, or week. Your schedule, your ride.',
  },
  {
    icon: Wallet,
    title: 'Easy Payments',
    description: 'Digital wallet for seamless transactions.',
  },
  {
    icon: CheckCircle,
    title: 'Verified Riders',
    description: 'Quick document verification for safe rentals.',
  },
];

const FeaturesSection = memo(() => (
  <section className="py-16 bg-muted/30">
    <div className="container mx-auto px-4">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
          Why Choose RideFlow?
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          We make bike rentals simple, safe, and enjoyable for everyone.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((feature, index) => (
          <div
            key={feature.title}
            className="bg-card p-6 rounded-2xl shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 animate-slide-up"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="w-12 h-12 rounded-xl gradient-hero flex items-center justify-center mb-4">
              <feature.icon className="h-6 w-6 text-primary-foreground" />
            </div>
            <h3 className="font-display font-semibold text-lg mb-2">{feature.title}</h3>
            <p className="text-muted-foreground text-sm">{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
));

FeaturesSection.displayName = 'FeaturesSection';

const HowItWorksSection = memo(() => (
  <section className="py-16 border-y border-border/50">
    <div className="container mx-auto px-4">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">How It Works</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">Get on the road in 4 simple steps.</p>
      </div>
      <div className="grid md:grid-cols-4 gap-8 relative">
        <div className="hidden md:block absolute top-12 left-0 w-full h-0.5 bg-gradient-to-r from-primary/10 via-primary/30 to-primary/10 -z-10" />
        
        {[
          { step: '01', title: 'Choose Your Ride', desc: 'Browse our extensive collection and select the bike that fits your needs.' },
          { step: '02', title: 'Quick Verification', desc: 'Upload your documents and get verified in minutes with our AI-powered system.' },
          { step: '03', title: 'Make Payment', desc: 'Pay securely using our flexible hourly or daily plans with zero security deposit.' },
          { step: '04', title: 'Pickup & Ride', desc: 'Pick up your bike from the selected location and enjoy your journey!' }
        ].map((item, idx) => (
          <div key={idx} className="flex flex-col items-center text-center group">
            <div className="w-16 h-16 rounded-full bg-background border-2 border-primary/20 flex items-center justify-center mb-6 group-hover:border-primary transition-colors">
              <span className="text-xl font-display font-bold text-primary">{item.step}</span>
            </div>
            <h3 className="font-display font-semibold text-lg mb-3">{item.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
));

HowItWorksSection.displayName = 'HowItWorksSection';

export default function Index() {
  const navigate = useNavigate();
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [homeHeroImageUrl, setHomeHeroImageUrl] = useState<string | null>(null);
  const [heroImages, setHeroImages] = useState<any[]>([]);
  const [locationName, setLocationName] = useState<string>('');

  useEffect(() => {
    const user = getCurrentUser();
    if (user?.role === 'superadmin') {
      navigate('/superadmin');
      return;
    }
    if (user?.role === 'admin') {
      navigate('/admin');
      return;
    }

    loadBikes();
    loadSettings();
    loadHeroImages();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await settingsAPI.getHomeHero();
      if (settings && settings.imageUrl) {
        setHomeHeroImageUrl(settings.imageUrl);
      }
    } catch (error) {
      console.error('Failed to load home hero settings:', error);
    }
  };

  const loadHeroImages = async () => {
    try {
      const images = await heroImagesAPI.getAll();
      setHeroImages(images.filter(img => img.isActive));
    } catch (error) {
      console.error('Failed to load hero images:', error);
    }
  };

  const loadBikes = async () => {
    try {
      const selectedLocation = localStorage.getItem('selectedLocation');
      const data = await bikesAPI.getAll(selectedLocation || undefined);
      setBikes(data);

      if (selectedLocation) {
        try {
          const loc = await locationsAPI.getById(selectedLocation);
          if (loc) setLocationName(loc.city || loc.name);
        } catch (e) {
          console.error('Failed to load location for SEO', e);
        }
      }
    } catch (error) {
      // Silently handle error - bikes will just be empty
    }
  };

  const featuredBikes = bikes.slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title={locationName ? `Bike Rental in ${locationName} - Best Prices & Wide Selection` : "Premium Bike Rental Service - Rent Motorcycles, Scooters & E-Bikes"}
        description={locationName ? `Rent a bike in ${locationName} starting at just ₹10/hour. RideFlow offers the best selection of scooters, electric bikes, and motorcycles in ${locationName}. Book online in minutes!` : "RideFlow is India's most trusted bike rental platform. Rent electric bikes, scooters, and motorcycles with flexible hourly, daily, and weekly plans. Zero deposit for verified users."}
        keywords={locationName ? `bike rental ${locationName}, rent a bike in ${locationName}, scooter rental ${locationName}, motorcycle hire ${locationName}, RideFlow ${locationName}` : "bike rental, rent a motorcycle, electric bike rental, scooter hire near me, urban mobility, RideFlow rentals"}
        schema={{
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          "name": "RideFlow Bike Rentals",
          "description": "Premium bike rentals for every adventure. From electric rides to mountain trails, find your perfect match and explore like never before.",
          "url": "https://rideflow.com",
          "telephone": "+91 98765 43210",
          "image": "https://rideflow.com/og-image.png",
          "priceRange": "₹₹",
          "openingHours": "Mo-Fr 07:00-21:00, Sa 08:00-20:00, Su 09:00-18:00",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": locationName || "Our Office",
            "addressLocality": locationName || "India",
            "addressRegion": "Telangana",
            "postalCode": "500001",
            "addressCountry": "IN"
          },
          "geo": {
            "@type": "GeoCoordinates",
            "latitude": 12.9716,
            "longitude": 77.5946
          }
        }}
      />
      <Navbar />
      
      <main>
        {/* Hero Section */}
      <section 
        className={`relative pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden ${
          !heroImages.length && homeHeroImageUrl
            ? 'min-h-screen md:min-h-[80vh] bg-no-repeat bg-cover bg-center md:bg-cover md:bg-center md:bg-fixed'
            : 'min-h-screen md:min-h-[80vh]'
        }`}
        style={!heroImages.length && homeHeroImageUrl ? {
          backgroundImage: `url(${homeHeroImageUrl})`,
        } : undefined}
      >
        {/* Carousel Layer */}
        {heroImages.length > 0 && <HeroCarousel images={heroImages} />}

        {/* Background Elements (Fallback only) */}
        <div className={`absolute inset-0 -z-10 ${(!heroImages.length && homeHeroImageUrl) ? 'bg-background/75 backdrop-blur-[1px]' : ''}`}>
          {!heroImages.length && !homeHeroImageUrl && (
            <>
              <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/5 rounded-full blur-3xl" />
            </>
          )}
        </div>

        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Content */}
            <div className="space-y-8 animate-slide-up">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                Now open in your city
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold leading-tight">
                {locationName ? `Premium Bike Rental in ${locationName}` : "Ride the City"}
                <span className="block relative inline-block pb-2">
                  <span className="relative z-10 text-foreground">Your Way</span>
                  <span className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-r from-primary to-primary/60 rounded-sm"></span>
                </span>
              </h1>

              <p className="text-lg text-muted-foreground max-w-lg">
                {locationName 
                  ? `Explore ${locationName} on two wheels. RideFlow provides the most reliable and affordable bike rental service in ${locationName} with a wide range of well-maintained motorcycles and scooters.`
                  : "RideFlow is your premium destination for hassle-free bike rentals. Whether you're commuting, touring, or just exploring, we have the perfect ride for every journey."
                }
              </p>

              <div className="flex flex-wrap gap-4">
                <Link to="/garage">
                  <Button variant="hero" className="md:h-14 md:px-10 md:text-lg md:rounded-xl">
                    Browse Bikes
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/auth?mode=signup">
                  <Button variant="dark" className="md:h-14 md:px-10 md:text-lg md:rounded-xl">
                    Create Account
                  </Button>
                </Link>
              </div>

              {/* Stats */}
              <div className="flex gap-8 pt-4">
                <div>
                  <div className="text-3xl font-display font-bold text-primary">500+</div>
                  <div className="text-sm text-muted-foreground">Happy Riders</div>
                </div>
                <div>
                  <div className="text-3xl font-display font-bold text-primary">50+</div>
                  <div className="text-sm text-muted-foreground">Premium Bikes</div>
                </div>
                <div>
                  <div className="text-3xl font-display font-bold text-primary">24/7</div>
                  <div className="text-sm text-muted-foreground">Support</div>
                </div>
              </div>
            </div>

            {/* Hero Image Removed */}
            <div className="relative animate-fade-in hidden lg:block" style={{ animationDelay: '0.3s' }}>
              {/* Image element removed as per user request */}
            </div>
          </div>
        </div>
      </section>

      <FeaturesSection />

      <HowItWorksSection />

      {/* Featured Bikes */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
                {locationName ? `Popular Bikes for Rent in ${locationName}` : "Featured Bikes"}
              </h2>
              <p className="text-muted-foreground">
                {locationName 
                  ? `Choose from our most popular rental bikes in ${locationName}. From fuel-efficient scooters to powerful cruisers.`
                  : "Our most popular rides, ready for your next adventure."
                }
              </p>
            </div>
            <Link to="/garage">
              <Button variant="outline" className="hidden md:flex">
                View All
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredBikes.map((bike, index) => (
              <div
                key={bike.id}
                className="animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <BikeCard
                  bike={bike}
                  onRent={(b) => navigate(`/garage?rent=1&bikeId=${encodeURIComponent(b.id)}`)}
                />
              </div>
            ))}
          </div>

          <div className="mt-8 text-center md:hidden">
            <Link to="/garage">
              <Button variant="outline">
                View All Bikes
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="relative rounded-3xl overflow-hidden gradient-dark p-8 md:p-16">
            <div className="relative z-10 text-center">
              <h2 className="text-3xl md:text-4xl font-display font-bold text-secondary-foreground mb-4">
                Ready to Ride?
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto mb-8">
                Create your account today and get ₹500 credit for your first rental.
              </p>
              <Link to="/auth?mode=signup">
                <Button variant="hero" size="xl">
                  Get Started Free
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            </div>
            {/* Decorative */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/20 rounded-full blur-3xl" />
          </div>
        </div>
      </section>
      </main>

      <Footer />
    </div>
  );
}
