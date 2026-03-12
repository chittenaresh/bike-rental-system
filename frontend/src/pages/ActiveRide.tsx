import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Bike,
  Calendar,
  Clock,
  MapPin,
  IndianRupee,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Camera,
  Upload,
  X,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { rentalsAPI, bikesAPI, getCurrentUser, documentsAPI } from '@/lib/api';
import { safeAsync } from '@/lib/errorHandler';
import { calculateSimplePrice } from '@/utils/simplePriceCalculator';
import { calculateRentalPrice } from '@/utils/priceCalculator';
import { SEO } from '@/components/SEO';

const MAX_IMAGES = 5;

const statusStyles = {
  confirmed: { color: 'bg-primary/10 text-primary', icon: Clock },
  ongoing: { color: 'bg-accent/10 text-accent', icon: Bike },
  active: { color: 'bg-accent/10 text-accent', icon: Bike },
  completed: { color: 'bg-muted text-muted-foreground', icon: CheckCircle },
  cancelled: { color: 'bg-destructive/10 text-destructive', icon: XCircle },
};

export default function ActiveRide() {
  const navigate = useNavigate();
  const [rental, setRental] = useState<any>(null);
  const [bike, setBike] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canEndRide, setCanEndRide] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [currentDuration, setCurrentDuration] = useState<number>(0);
  const [extendHours, setExtendHours] = useState(1);
  const [canExtend, setCanExtend] = useState(false);

  // Image upload state
  const [extraImages, setExtraImages] = useState<(string | null)[]>(Array(MAX_IMAGES).fill(null));
  const [uploading, setUploading] = useState<number | null>(null);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>(Array(MAX_IMAGES).fill(null));
  const [showCamera, setShowCamera] = useState(false);
  const [activeCameraIndex, setActiveCameraIndex] = useState<number | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      navigate('/auth');
      return;
    }

    loadActiveRide(user);
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setCameraError(false);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      if (!videoRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = stream;
      videoRef.current.srcObject = stream;
    } catch (err) {
      console.error("Error accessing camera:", err);
      setCameraError(true);
      toast({ 
        title: 'Camera Error', 
        description: 'Unable to access camera. Please try uploading a file instead.', 
        variant: 'destructive' 
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || activeCameraIndex === null) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `camera_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
          handleFileProcess(activeCameraIndex, file);
          setShowCamera(false);
          stopCamera();
        }
      }, 'image/jpeg', 0.8);
    }
  };

  const openCamera = (index: number) => {
    setActiveCameraIndex(index);
    setShowCamera(true);
    setTimeout(startCamera, 100);
  };

  const handleFileUpload = () => {
    if (activeCameraIndex !== null) {
      fileInputRefs.current[activeCameraIndex]?.click();
      setShowCamera(false);
      stopCamera();
    }
  };

  const onPickFile = (index: number) => {
    openCamera(index);
  };

  const handleFileProcess = async (index: number, file: File) => {
    if (extraImages[index]) {
      toast({ title: 'Slot already filled', description: 'Please remove the existing image first', variant: 'destructive' });
      return;
    }

    try {
      setUploading(index);
      const res = await documentsAPI.uploadFile(file, file.name, 'rental_bike_image');
      const imageUrl = res?.fileUrl || res?.url;
      
      if (imageUrl) {
        const newImages = [...extraImages];
        newImages[index] = imageUrl;
        setExtraImages(newImages);
        
        // Save to rental immediately
        if (rental) {
          const validImages = newImages.filter((img): img is string => img !== null);
          await rentalsAPI.updateImages(rental.id, validImages);
        }
        
        toast({ title: 'Image uploaded', description: 'Image added successfully' });
      } else {
        toast({ title: 'Upload failed', description: 'No file URL returned', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Upload error', description: err.message || 'Failed to upload image', variant: 'destructive' });
    } finally {
      setUploading(null);
      if (fileInputRefs.current[index]) fileInputRefs.current[index]!.value = '';
    }
  };

  const onFileSelected = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleFileProcess(index, file);
  };

  const removeImage = async (index: number) => {
    const newImages = [...extraImages];
    newImages[index] = null;
    setExtraImages(newImages);
    
    // Update rental
    if (rental) {
      const validImages = newImages.filter((img): img is string => img !== null);
      await rentalsAPI.updateImages(rental.id, validImages);
    }
  };

  const loadActiveRide = async (currentUser: any) => {
    try {
      setIsLoading(true);
      const rentals = await rentalsAPI.getAll();
      const active = rentals.find((r: any) => {
        const rentalUserId = r.userId || r.user?.id;
        return (
          String(rentalUserId || '') === String(currentUser?.id || '') &&
          (r.status === 'ongoing' || r.status === 'active' || r.status === 'confirmed')
        );
      });

      if (!active) {
        toast({
          title: "No Active Ride",
          description: "You don't have an active or confirmed ride. Please book a bike first.",
          variant: "destructive",
        });
        navigate('/dashboard');
        return;
      }

      setRental(active);
      
      // Initialize images if they exist in the rental
      if (active.userImages && Array.isArray(active.userImages)) {
        const initialImages = Array(MAX_IMAGES).fill(null);
        active.userImages.forEach((url: string, idx: number) => {
          if (idx < MAX_IMAGES) initialImages[idx] = url;
        });
        setExtraImages(initialImages);
      }
      
      // Calculate initial duration (ensure non-negative)
      const startTime = new Date(active.pickupTime || active.startTime);
      const now = new Date();
      const elapsedMs = Math.max(0, now.getTime() - startTime.getTime());
      const elapsedHours = elapsedMs / (1000 * 60 * 60);
      setCurrentDuration(elapsedHours);
      
      // Load bike details if not already populated
      if (active.bikeId && typeof active.bikeId === 'object') {
        setBike(active.bikeId);
      } else {
        const bikeData = await safeAsync(
          () => bikesAPI.getById(active.bikeId),
          undefined,
          'ActiveRide.loadBike'
        );
        if (bikeData) {
          setBike(bikeData);
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load active ride",
        variant: "destructive",
      });
      navigate('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const checkCanEndRide = (rentalData: any) => {
    if (!rentalData) return;
    
    const startTime = new Date(rentalData.pickupTime || rentalData.startTime);
    const now = new Date();
    const elapsedMs = Math.max(0, now.getTime() - startTime.getTime());
    const elapsedHours = elapsedMs / (1000 * 60 * 60);
    const oneHourInMs = 60 * 60 * 1000;
    
    // Update current duration (ensure non-negative)
    setCurrentDuration(elapsedHours);
    
    if (elapsedHours >= 1) {
      setCanEndRide(true);
      setTimeRemaining(0);
    } else {
      setCanEndRide(false);
      const remainingMs = oneHourInMs - elapsedMs;
      setTimeRemaining(Math.ceil(remainingMs / (1000 * 60))); // minutes remaining
    }
  };

  const checkCanExtend = (rentalData: any) => {
    if (!rentalData || !rentalData.dropoffTime) {
      setCanExtend(false);
      return;
    }
    
    const scheduledEndTime = new Date(rentalData.dropoffTime);
    const now = new Date();
    const timeUntilEnd = scheduledEndTime.getTime() - now.getTime();
    const hoursUntilEnd = timeUntilEnd / (1000 * 60 * 60);
    
    // Can extend if more than 1 hour remaining before scheduled end
    setCanExtend(hoursUntilEnd > 1);
  };

  const calculatePrice = () => {
    if (!bike || !rental) return 0;
    
    const startTime = new Date(rental.pickupTime || rental.startTime);
    const endTime = rental.dropoffTime || rental.endTime 
      ? new Date(rental.dropoffTime || rental.endTime)
      : new Date();
    
    try {
      // Use the same calculation logic as booking to ensure consistency
      const hasIndividualRates = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24].some(
        hour => bike[`pricePerHour${hour}` as keyof typeof bike] && Number(bike[`pricePerHour${hour}` as keyof typeof bike]) > 0
      );
      const hasTariff = bike.weekdayRate !== undefined || bike.weekendRate !== undefined;

      let priceInfo: any = null;
      if (bike.price12Hours || hasIndividualRates || bike.pricePerWeek || hasTariff) {
        priceInfo = calculateSimplePrice(bike, startTime, endTime);
      } else {
        // Fallback to legacy pricing slabs
        priceInfo = calculateRentalPrice(bike, startTime, endTime, 'hourly');
      }
      
      return priceInfo ? priceInfo.total : 0;
    } catch (error) {
      console.error('Price calculation error:', error);
      // Fallback to simple calculation
      const hours = Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60));
      const basePrice = hours * (bike.pricePerHour || 0);
      const gstPercentage = bike.gstPercentage || 18.0;
      return basePrice * (1 + gstPercentage / 100);
    }
  };


  useEffect(() => {
    if (!rental || (rental.status !== 'ongoing' && rental.status !== 'active')) return;
    
    // Check immediately
    checkCanEndRide(rental);
    checkCanExtend(rental);
    
    // Update duration every 30 seconds for smoother display
    const durationInterval = setInterval(() => {
      if (rental) {
        const startTime = new Date(rental.pickupTime || rental.startTime);
        const now = new Date();
        const elapsedMs = Math.max(0, now.getTime() - startTime.getTime());
        const elapsedHours = elapsedMs / (1000 * 60 * 60);
        setCurrentDuration(elapsedHours);
      }
    }, 30000); // Update every 30 seconds
    
    // Check can end/extend every minute
    const checkInterval = setInterval(() => {
      checkCanEndRide(rental);
      checkCanExtend(rental);
    }, 60000); // Check every minute
    
    return () => {
      clearInterval(durationInterval);
      clearInterval(checkInterval);
    };
  }, [rental]);

  const handleExtendRide = async () => {
    if (!rental || !canExtend) return;
    
    try {
      const scheduledEndTime = new Date(rental.dropoffTime);
      const newEndTime = new Date(scheduledEndTime.getTime() + (extendHours * 60 * 60 * 1000));
      
      // Update the rental's dropoffTime
      await rentalsAPI.update(rental.id, { dropoffTime: newEndTime.toISOString() });
      
      // Reload the rental data
      const user = getCurrentUser();
      if (user) {
        await loadActiveRide(user);
      }
      
      toast({
        title: "Ride Extended",
        description: `Your ride has been extended by ${extendHours} hour${extendHours !== 1 ? 's' : ''}.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to extend ride",
        variant: "destructive",
      });
    }
  };

  const handleEndRide = async () => {
    if (!rental || !canEndRide) return;
    
    try {
      await rentalsAPI.completeRide(rental.id);
      toast({
        title: "Ride Ended",
        description: "Your ride has been completed successfully.",
      });
      // Refresh the page to update navbar
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);
    } catch (error: any) {
      const errorMessage = error.message || "Failed to end ride";
      toast({
        title: "Error",
        description: typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage),
        variant: "destructive",
      });
    }
  };

  const handleStartRide = async () => {
    if (!rental) return;
    
    const filledSlots = extraImages.filter(img => img !== null).length;
    if (filledSlots < MAX_IMAGES) {
      toast({
        title: "Images Required",
        description: `Please upload all ${MAX_IMAGES} bike condition images before starting your ride.`,
        variant: "destructive",
      });
      return;
    }

    try {
      await rentalsAPI.startRide(rental.id);
      toast({
        title: "Ride Started",
        description: "Your ride has been started successfully! Have a safe journey.",
      });
      
      // Reload the rental data
      const user = getCurrentUser();
      if (user) {
        await loadActiveRide(user);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start ride. Please ensure you have uploaded all required images.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-16 pb-24">
          <div className="container mx-auto px-4 py-12">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading ride details...</p>
              </div>
              </div>
            </div>
          </main>
        <Footer />
      </div>
    );
  }

  if (!rental) {
    return null;
  }

  const StatusIcon = statusStyles[rental.status as keyof typeof statusStyles]?.icon || Clock;
  const startTime = new Date(rental.pickupTime || rental.startTime);
  const endTime = rental.dropoffTime || rental.endTime 
    ? new Date(rental.dropoffTime || rental.endTime)
    : null;
  const currentPrice = calculatePrice();
  
  // Format duration for display
  const formatDuration = (hours: number) => {
    // Ensure non-negative
    const safeHours = Math.max(0, hours);
    const wholeHours = Math.floor(safeHours);
    const minutes = Math.floor((safeHours - wholeHours) * 60);
    if (wholeHours === 0) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    if (minutes === 0) {
      return `${wholeHours} hour${wholeHours !== 1 ? 's' : ''}`;
    }
    return `${wholeHours} hour${wholeHours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO 
        title={bike ? `Active Ride: ${bike.name}` : "Active Ride"}
        description="Track your current bike rental, check remaining time, and manage your active ride on RideFlow."
        keywords="active bike rental, track ride, rental duration, bike rental management"
      />
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-24">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>

          <div className="max-w-4xl mx-auto">
            <div className="bg-card rounded-2xl shadow-card p-8 mb-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h1 className="text-3xl font-display font-bold mb-2">Active Ride</h1>
                  <p className="text-muted-foreground">Your current ride details</p>
                </div>
                <Badge className={statusStyles[rental.status as keyof typeof statusStyles]?.color || 'bg-muted'}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {rental.status.charAt(0).toUpperCase() + rental.status.slice(1)}
                </Badge>
              </div>

              {/* Bike Details */}
              {bike && (
                <div className="bg-muted/50 rounded-xl p-6 mb-6">
                  <div className="flex items-center gap-4 mb-4">
                    {bike.image && (
                      <img
                        src={bike.image}
                        alt={`Active ride bike: ${bike.name}`}
                        className="w-24 h-24 object-cover rounded-lg"
                      />
                    )}
                    <div>
                      <h2 className="text-2xl font-display font-bold">{bike.name}</h2>
                      {bike.brand && (
                        <p className="text-muted-foreground">Brand: {bike.brand}</p>
                      )}
                      <Badge variant="secondary" className="mt-2">
                        {bike.type}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              {/* Booking Details */}
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="bg-muted/50 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Calendar className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-lg">Booking Information</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Booking ID</p>
                      <p className="font-mono font-medium">{rental.bookingId || rental.id.slice(0, 8)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pickup Time</p>
                      <p className="font-medium">{startTime.toLocaleString()}</p>
                    </div>
                    {endTime && (
                      <div>
                        <p className="text-sm text-muted-foreground">Dropoff Time</p>
                        <p className="font-medium">{endTime.toLocaleString()}</p>
                      </div>
                    )}
                    {!endTime && (
                      <div>
                        <p className="text-sm text-muted-foreground">Scheduled Dropoff</p>
                        <p className="font-medium">
                          {rental.dropoffTime 
                            ? new Date(rental.dropoffTime).toLocaleString()
                            : 'Not set'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-muted/50 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <IndianRupee className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-lg">Pricing</h3>
                  </div>
                  <div className="space-y-3">
                    {bike && (
                      <div>
                        <p className="text-sm text-muted-foreground">Rate per Hour</p>
                        <p className="font-medium">₹{bike.pricePerHour}/hr</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">Current Duration</p>
                      <p className="font-medium">
                        {formatDuration(currentDuration)}
                      </p>
                    </div>
                    <div className="pt-3 border-t">
                      <p className="text-sm text-muted-foreground">Current Total</p>
                      <p className="text-2xl font-display font-bold text-primary">
                        ₹{currentPrice.toFixed(2)}
                      </p>
                    </div>
                    {rental.totalAmount && (
                      <div>
                        <p className="text-sm text-muted-foreground">Paid Amount</p>
                        <p className="font-medium">₹{rental.totalAmount.toFixed(2)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              {rental.status === 'confirmed' && (
                <div className="space-y-6 pt-6 border-t">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Unlock & Inspect Bike</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Please unlock the bike and upload {MAX_IMAGES} clear images of the bike's current condition to start your ride.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {Array.from({ length: MAX_IMAGES }).map((_, index) => {
                        const imageUrl = extraImages[index];
                        const isUploading = uploading === index;
                        return (
                          <div key={index} className="relative w-full aspect-square">
                            <input
                              ref={(el) => { fileInputRefs.current[index] = el; }}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => onFileSelected(index, e)}
                              disabled={isUploading || !!imageUrl}
                            />
                            {imageUrl ? (
                              <div className="relative w-full h-full rounded-xl border overflow-hidden group">
                                <img
                                  src={imageUrl}
                                  alt={`Bike condition ${index + 1}`}
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeImage(index)}
                                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                >
                                  <X className="h-5 w-5 text-white" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onPickFile(index)}
                                disabled={isUploading}
                                className="w-full h-full rounded-xl border-2 border-dashed flex items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors"
                              >
                                {isUploading ? (
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                                ) : (
                                  <Camera className="h-6 w-6" />
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-4 pt-6 border-t">
                    <Button 
                      variant="outline" 
                      size="lg"
                      onClick={() => navigate('/support')}
                      className="w-full sm:w-auto"
                    >
                      Need Help?
                    </Button>
                    <Button 
                      onClick={handleStartRide} 
                      className="w-full sm:flex-1 h-14 text-lg font-bold shadow-hero"
                      disabled={extraImages.filter(img => img !== null).length < MAX_IMAGES}
                    >
                      Start Ride
                    </Button>
                  </div>
                </div>
              )}

              {(rental.status === 'ongoing' || rental.status === 'active') && (
                <div className="space-y-6">
                  {/* Bike Condition Images */}
                  <div className="pt-6 border-t">
                    <h3 className="text-lg font-semibold mb-2">Bike Condition Images</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Please upload clear images of the bike (minimum 2, maximum 5) for your safety and verification.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {Array.from({ length: MAX_IMAGES }).map((_, index) => {
                        const imageUrl = extraImages[index];
                        const isUploading = uploading === index;
                        return (
                          <div key={index} className="relative w-full aspect-square">
                            <input
                              ref={(el) => { fileInputRefs.current[index] = el; }}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => onFileSelected(index, e)}
                              disabled={isUploading || !!imageUrl}
                            />
                            {imageUrl ? (
                              <div className="relative w-full h-full rounded-xl border overflow-hidden group">
                                <img
                                  src={imageUrl}
                                  alt={`Bike condition ${index + 1}`}
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeImage(index)}
                                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                >
                                  <X className="h-5 w-5 text-white" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onPickFile(index)}
                                disabled={isUploading}
                                className="w-full h-full rounded-xl border-2 border-dashed flex items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors"
                              >
                                {isUploading ? (
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                                ) : (
                                  <Camera className="h-6 w-6" />
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t">
                    {canExtend && (
                      <div className="flex-1 flex items-center gap-4">
                        <label className="text-sm font-medium">Extend by:</label>
                        <select
                          value={extendHours}
                          onChange={(e) => setExtendHours(Number(e.target.value))}
                          className="px-3 py-2 border rounded-lg bg-background"
                        >
                          <option value={1}>1 hour</option>
                          <option value={2}>2 hours</option>
                          <option value={3}>3 hours</option>
                          <option value={4}>4 hours</option>
                          <option value={5}>5 hours</option>
                        </select>
                        <Button 
                          onClick={handleExtendRide} 
                          variant="outline"
                          disabled={!canExtend}
                          className={!canExtend ? 'opacity-50 cursor-not-allowed' : ''}
                        >
                          Extend Ride
                        </Button>
                      </div>
                    )}
                    {!canExtend && rental.dropoffTime && (
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">
                          Extension window closed. You can only extend rides more than 1 hour before the scheduled end time.
                        </p>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <Button 
                        variant="outline" 
                        size="lg"
                        onClick={() => navigate('/support')}
                        className="w-full sm:w-auto"
                      >
                        Support
                      </Button>
                      <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                        <Button 
                          onClick={handleEndRide} 
                          variant="destructive" 
                          size="lg"
                          disabled={!canEndRide}
                          className={`w-full sm:w-auto ${!canEndRide ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title={!canEndRide ? `Please wait ${timeRemaining} more minute${timeRemaining !== 1 ? 's' : ''} before ending the ride` : 'End your ride'}
                        >
                          End Ride
                        </Button>
                        {!canEndRide && timeRemaining > 0 && (
                          <p className="text-xs text-muted-foreground text-right">
                            Minimum 1 hour required. {timeRemaining} minute{timeRemaining !== 1 ? 's' : ''} remaining
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
      </main>
      <Footer />

      <Dialog open={showCamera} onOpenChange={(open) => {
        if (!open) {
          setShowCamera(false);
          stopCamera();
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Take Photo</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
              {cameraError ? (
                <div className="text-white text-sm p-4 text-center">
                  <p className="font-bold mb-1">Camera Unavailable</p>
                  <p className="text-xs text-gray-400">Please use the "Upload File" button below.</p>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleFileUpload}>
                <Upload className="mr-2 h-4 w-4" />
                Upload File
              </Button>
              {!cameraError && (
                <Button className="flex-1" onClick={capturePhoto}>
                  <Camera className="mr-2 h-4 w-4" />
                  Capture
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

