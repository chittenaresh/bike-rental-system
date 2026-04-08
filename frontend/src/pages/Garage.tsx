import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { bikesAPI, locationsAPI, documentsAPI, getCurrentUser } from '@/lib/api';
import { Bike } from '@/types';
import { BikeCard } from '@/components/BikeCard';
import { SEO } from '@/components/SEO';
import { toast } from '@/hooks/use-toast';

export default function Garage() {
  const navigate = useNavigate();
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [cityName, setCityName] = useState<string>('Your City');
  const [docStatus, setDocStatus] = useState({ allApproved: false, hasDocs: false });
  const [isLoggedIn] = useState(() => !!getCurrentUser());

  useEffect(() => {
    const checkDocs = async () => {
      const user = getCurrentUser();
      if (!user) return;
      try {
        const userDocs = await documentsAPI.getAll();
        const requiredTypes = ['aadhar_front', 'aadhar_back', 'pan', 'driving_license'];
        const approvedTypes = (userDocs || [])
          .filter((doc: any) => doc.status === 'approved')
          .map((doc: any) => doc.type);

        const allApproved = requiredTypes.every((type) => approvedTypes.includes(type));
        const hasDocs = userDocs && userDocs.length > 0;
        setDocStatus({ allApproved, hasDocs });
      } catch (error) {
        console.error('Failed to check documents', error);
      }
    };

    const load = async () => {
      try {
        const selectedLocation = localStorage.getItem('selectedLocation') || undefined;
        const data = await bikesAPI.getAll(selectedLocation);
        setBikes(data || []);
        if (selectedLocation) {
          const loc = await locationsAPI.getById(selectedLocation);
          setCityName(loc?.name || loc?.city || 'Your City');
        }
      } catch {
        setBikes([]);
      }
    };

    load();
    const user = getCurrentUser();
    if (user) {
      checkDocs();
    }

    const onLocationChanged = () => {
      load();
    };

    window.addEventListener('rideflow:locationChanged', onLocationChanged);
    return () => {
      window.removeEventListener('rideflow:locationChanged', onLocationChanged);
    };
  }, []);

  const checkDocuments = async () => {
    const user = getCurrentUser();
    if (!user) return;
    try {
      const userDocs = await documentsAPI.getAll();
      const requiredTypes = ['aadhar_front', 'aadhar_back', 'pan', 'driving_license'];
      const approvedTypes = (userDocs || [])
        .filter((doc: any) => doc.status === 'approved')
        .map((doc: any) => doc.type);

      const allApproved = requiredTypes.every((type) => approvedTypes.includes(type));
      const hasDocs = userDocs && userDocs.length > 0;
      setDocStatus({ allApproved, hasDocs });
    } catch (error) {
      console.error('Failed to check documents', error);
    }
  };

  const handleRent = async (bike: Bike) => {
    const user = getCurrentUser();
    if (!user) {
      toast({
        title: 'Login Required',
        description: 'Please login to book a ride.',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    // Check if all documents are verified
    try {
      const userDocs = await documentsAPI.getAll();
      const requiredTypes = ['aadhar_front', 'aadhar_back', 'pan', 'driving_license'];
      const approvedTypes = (userDocs || [])
        .filter((doc: any) => doc.status === 'approved')
        .map((doc: any) => doc.type);

      const allVerified = requiredTypes.every((type) => approvedTypes.includes(type));

      if (!allVerified) {
        toast({
          title: 'Verification Required',
          description: 'Please upload and verify documents to continue.',
          variant: 'destructive',
        });
        navigate('/dashboard?tab=documents');
        return;
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to verify documents. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    navigate(`/ride-finder?rent=1&bikeId=${encodeURIComponent(bike.id)}`);
  };

  const formatPrice = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`Garage in ${cityName} - Affordable Rental Plans`}
        description={`Check out our competitive bike rental prices and tariffs in the RideFlow Garage in ${cityName}. We offer a wide range of motorcycles, scooters, and electric bikes for rent.`}
        keywords={`garage ${cityName}, bike rental tariffs ${cityName}, motorcycle rental prices ${cityName}, scooter rental cost ${cityName}`}
        schema={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Home',
              item: 'https://rideflow.com',
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Garage',
              item: 'https://rideflow.com/garage',
            },
          ],
        }}
      />
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="mb-8 text-center">
            <h1 className="text-3xl md:text-4xl font-display font-bold mb-2">
              Garage in {cityName}
            </h1>
            <p className="text-muted-foreground text-sm md:text-base">
              *All prices are exclusive of taxes and fuel. Images used for representation purposes
              only, actual color may vary. Prices may vary subject to availability.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bikes.map((bike, index) => (
              <div
                key={bike.id}
                className="animate-slide-up"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <BikeCard
                  bike={bike}
                  onRent={handleRent}
                  docStatus={docStatus}
                  isLoggedIn={isLoggedIn}
                />
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
