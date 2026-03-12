import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { SEO } from '@/components/SEO';
import { getCurrentUser, paymentsAPI, documentsAPI, rentalsAPI } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Bike } from '@/types';
import { calculateRentalPrice } from '@/utils/priceCalculator';
import { calculateSimplePrice } from '@/utils/simplePriceCalculator';

interface BookingDetails {
  bike: Bike;
  pickupTime: string;
  dropoffTime: string;
  durationHours: number;
  totalAmount: number;
  pricingType?: 'hourly' | 'daily' | 'weekly';
}



export default function Payment() {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const bookingDetails = location.state?.bookingDetails as BookingDetails;

  useEffect(() => {
    checkActiveRental();
  }, []);

  const checkActiveRental = async () => {
    try {
      const rentals = await rentalsAPI.getAll();
      const currentUser = getCurrentUser();
      const active = rentals.find((r: any) => {
        const rentalUserId = r.userId || r.user?.id;
        return (
          String(rentalUserId || '') === String(currentUser?.id || '') &&
          ['confirmed', 'ongoing', 'active'].includes(r.status)
        );
      });

      if (active) {
        toast({
          title: 'Active Rental Found',
          description: 'You already have an active rental. Please complete it before booking another.',
          variant: 'destructive',
        });
        navigate('/'); // Redirect to home
      }
    } catch (error) {
      console.error('Failed to check active rental', error);
    }
  };

  useEffect(() => {
    if (!bookingDetails) {
      navigate('/garage');
      return;
    }
    const user = getCurrentUser();
    if (!user) {
      toast({ title: 'Login Required', description: 'Please login to continue payment.', variant: 'destructive' });
      navigate('/auth');
      return;
    }

    // Check if all documents are verified
    const checkDocuments = async () => {
      try {
        const userDocs = await documentsAPI.getAll();
        const hasDocuments = userDocs && userDocs.length > 0;
        const allApproved = hasDocuments && userDocs.every((doc: any) => doc.status === 'approved');
        
        if (!hasDocuments) {
          toast({ 
            title: 'Documents Required', 
            description: 'Please upload and verify all required documents before booking a ride.', 
            variant: 'destructive' 
          });
          navigate('/dashboard?tab=documents');
          return;
        }

        if (!allApproved) {
          const pendingCount = userDocs.filter((doc: any) => doc.status !== 'approved').length;
          toast({ 
            title: 'Documents Pending Verification', 
            description: `You have ${pendingCount} document(s) pending verification. Please wait for admin approval before booking.`, 
            variant: 'destructive' 
          });
          navigate('/dashboard?tab=documents');
          return;
        }
      } catch (error: any) {
        toast({ 
          title: 'Error', 
          description: 'Failed to verify documents. Please try again.', 
          variant: 'destructive' 
        });
        navigate('/garage');
      }
    };

    checkDocuments();
  }, [bookingDetails, navigate]);

  if (!bookingDetails) return null;

  const { bike, pickupTime, dropoffTime, durationHours, totalAmount, pricingType = 'hourly' } = bookingDetails;
  
  // Calculate price breakdown - use the same logic as Garage.tsx to ensure consistency
  const startDate = new Date(pickupTime);
  const endDate = new Date(dropoffTime);
  let priceInfo: any = null;
  try {
    // Use the same calculation logic as Garage.tsx to ensure consistency
    const hasIndividualRates = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24].some(
      hour => bike[`pricePerHour${hour}` as keyof typeof bike] && Number(bike[`pricePerHour${hour}` as keyof typeof bike]) > 0
    );
    const hasTariff = bike.weekdayRate !== undefined || bike.weekendRate !== undefined;

    if (bike.price12Hours || hasIndividualRates || bike.pricePerWeek || hasTariff) {
      priceInfo = calculateSimplePrice(bike, startDate, endDate);
    } else {
      // Fallback to legacy pricing slabs
      priceInfo = calculateRentalPrice(bike, startDate, endDate, pricingType || 'hourly');
    }
    
    // Ensure priceInfo is valid
    if (!priceInfo || !priceInfo.total) {
      console.warn('Price calculation returned invalid result, using fallback');
      priceInfo = {
        basePrice: totalAmount / 1.18, // Reverse calculate base from total (assuming 18% GST)
        gstPercentage: bike.gstPercentage || 18.0,
        gstAmount: (totalAmount / 1.18) * ((bike.gstPercentage || 18.0) / 100),
        total: totalAmount,
        subtotal: totalAmount / 1.18
      };
    }
  } catch (error) {
    console.error('Price calculation error:', error);
    // Fallback calculation
    const gstPct = bike.gstPercentage || 18.0;
    const base = totalAmount / (1 + gstPct / 100);
    priceInfo = {
      basePrice: base,
      gstPercentage: gstPct,
      gstAmount: base * (gstPct / 100),
      total: totalAmount,
      subtotal: base
    };
  }

  const handlePayment = async () => {
    try {
      setLoading(true);
      const finalAmount = priceInfo ? Math.round(priceInfo.total) : totalAmount;
      const { keyId } = await paymentsAPI.getKey();
      const order = await paymentsAPI.createOrder(finalAmount);
      const options = {
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'RideFlow',
        description: `Rental for ${bike.name}`,
        order_id: order.id,
        handler: async function (response: any) {
          try {
            const selectedLocationId = localStorage.getItem('selectedLocation') || undefined;
            const finalAmount = priceInfo ? Math.round(priceInfo.total) : totalAmount;
            const result = await paymentsAPI.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              bookingDetails: {
                bikeId: bike.id,
                pickupTime,
                dropoffTime,
                totalAmount: finalAmount,
                pricingType,
                selectedLocationId,
                additionalImages: []
              }
            });
            
            if (result.success) {
              navigate('/payment-success', { state: { rental: result.rental, bike } });
            }
          } catch (error) {
            toast({
              title: 'Payment Verification Failed',
              description: 'Please contact support if money was deducted.',
              variant: 'destructive',
            });
          }
        },
        prefill: {
          name: 'RideFlow User',
          email: 'user@example.com',
          contact: '9999999999'
        },
        theme: {
          color: '#F97316'
        }
      };

      const rzp1 = new (window as any).Razorpay(options);
      rzp1.open();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to initiate payment',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SEO 
        title="Complete Your Booking"
        description="Securely complete your bike rental booking on RideFlow. Proceed to payment."
        noindex={true}
      />
      <Navbar />
      <div className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold mb-6">Payment Summary</h1>
          <Card>
            <CardHeader>
              <CardTitle>{bike.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pickup</span>
                <span className="font-medium">{new Date(pickupTime).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dropoff</span>
                <span className="font-medium">{new Date(dropoffTime).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">{Math.round(durationHours)} hours</span>
              </div>
              {priceInfo && (
                <>
                  <hr />
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Base Price</span>
                      <span className="font-medium">₹{priceInfo.basePrice.toFixed(2)}</span>
                    </div>
                    {priceInfo.hasWeekend && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Weekend Surge ({((priceInfo.surgeMultiplier - 1) * 100).toFixed(0)}%)</span>
                        <span className="font-medium text-accent">+₹{(priceInfo.priceAfterSurge - priceInfo.basePrice).toFixed(2)}</span>
                      </div>
                    )}
                    {priceInfo.excessKm > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Excess KM ({priceInfo.excessKm} km)</span>
                        <span className="font-medium">+₹{priceInfo.excessKmCharge.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">₹{priceInfo.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">GST ({priceInfo.gstPercentage}%)</span>
                      <span className="font-medium">+₹{priceInfo.gstAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </>
              )}
              <hr />
              <div className="flex justify-between text-lg font-bold">
                <span>Total Amount</span>
                <span>₹{priceInfo ? priceInfo.total.toFixed(2) : (totalAmount || 0).toFixed(2)}</span>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                size="lg" 
                onClick={handlePayment}
                disabled={loading}
              >
                {loading ? 'Processing...' : `Pay ₹${(priceInfo ? priceInfo.total : (totalAmount || 0)).toFixed(2)}`}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  );
}
