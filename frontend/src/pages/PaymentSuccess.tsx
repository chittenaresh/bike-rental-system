import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { SEO } from '@/components/SEO';
import { CheckCircle } from 'lucide-react';

export default function PaymentSuccess() {
  const location = useLocation();
  const navigate = useNavigate();
  const { rental, bike } = location.state || {};

  useEffect(() => {
    if (!rental) {
      navigate('/dashboard');
    }
  }, [rental, navigate]);

  if (!rental) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title="Booking Confirmed"
        description="Your bike rental booking has been successfully confirmed. View your booking details and get ready for your ride."
        noindex={true}
      />
      <Navbar />
      <div className="flex-grow container mx-auto px-4 py-8 flex items-center justify-center">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-2xl">Booking Confirmed!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-left">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="text-sm text-muted-foreground">Booking ID</p>
              <p className="font-mono font-bold text-lg">{rental.bookingId}</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bike</span>
                <span className="font-medium">{bike?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pickup</span>
                <span className="font-medium">{new Date(rental.pickupTime).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dropoff</span>
                <span className="font-medium">{new Date(rental.dropoffTime).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="font-medium">₹{rental.totalAmount}</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button className="w-full" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
            <Button variant="outline" className="w-full" onClick={() => window.print()}>
              Download Invoice
            </Button>
          </CardFooter>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
