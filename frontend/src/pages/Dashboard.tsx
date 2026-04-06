import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FileText,
  Upload,
  History,
  User,
  CheckCircle,
  Clock,
  XCircle,
  Bike,
  Download,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { usersAPI, rentalsAPI, documentsAPI, getCurrentUser, authAPI, locationsAPI } from '@/lib/api';
import { generateInvoice } from '@/lib/invoiceGenerator';
import { SEO } from '@/components/SEO';

const rentalStatusStyles = {
  confirmed: { color: 'bg-blue-500/10 text-blue-500', icon: Clock },
  ongoing: { color: 'bg-accent/10 text-accent', icon: Bike },
  active: { color: 'bg-accent/10 text-accent', icon: Bike },
  completed: { color: 'bg-green-500/10 text-green-500', icon: CheckCircle },
  cancelled: { color: 'bg-destructive/10 text-destructive', icon: XCircle },
};

const statusStyles = {
  pending: { color: 'bg-yellow-500/10 text-yellow-500', icon: Clock },
  approved: { color: 'bg-green-500/10 text-green-500', icon: CheckCircle },
  rejected: { color: 'bg-destructive/10 text-destructive', icon: XCircle },
};

const formatLocationDisplay = (loc: any): string => {
  if (!loc) return '';
  // Show only the city name as per requirement
  return loc.city || loc.name || '';
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('overview');
  const [user, setUser] = useState<any>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [rentals, setRentals] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEmailVerifying, setIsEmailVerifying] = useState(false);
  const [isMobileVerifying, setIsMobileVerifying] = useState(false);
  const [emailOTP, setEmailOTP] = useState('');
  const [mobileOTP, setMobileOTP] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    emergencyContact: '',
    familyContact: '',
    permanentAddress: '',
    currentAddress: '',
    currentLocationId: '',
    hotelStay: '',
  });
  const [documentFiles, setDocumentFiles] = useState({
    aadharFront: null as File | null,
    aadharBack: null as File | null,
    pan: null as File | null,
    drivingLicense: null as File | null,
  });

  const getLatestDoc = (type: 'aadhar_front' | 'aadhar_back' | 'pan' | 'driving_license') => {
    const docsOfType = documents.filter((d) => d.type === type);
    if (docsOfType.length === 0) return null;
    return docsOfType.sort(
      (a: any, b: any) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )[0];
  };
  const getDocStatus = (type: 'aadhar_front' | 'aadhar_back' | 'pan' | 'driving_license') =>
    getLatestDoc(type)?.status || 'none';

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      navigate('/auth');
      return;
    }

    loadUserData();
    loadLocations();
  }, []);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['overview', 'documents', 'history'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const setTab = (tabId: string) => {
    setActiveTab(tabId);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tabId);
    setSearchParams(next, { replace: true });
  };

  const loadUserData = async () => {
    setIsLoading(true);
    try {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        navigate('/auth');
        return;
      }
      // Load user data
      try {
        const userData = await authAPI.getCurrentUser();
        setUser(userData);
        setFormData({
          name: userData.name || '',
          mobile: userData.mobile || '',
          email: userData.email || '',
          emergencyContact: userData.emergencyContact || '',
          familyContact: userData.familyContact || '',
          permanentAddress: userData.permanentAddress || '',
          currentAddress: userData.currentAddress || '',
          currentLocationId: userData.currentLocationId || '',
          hotelStay: userData.hotelStay || '',
        });
      } catch (err: any) {
        if (err.message?.toLowerCase().includes('token')) {
          authAPI.logout();
          navigate('/auth');
          return;
        }
      }
      // Load rentals
      try {
        const rentalsData = await rentalsAPI.getAll();

if (JSON.stringify(rentals) !== JSON.stringify(rentalsData)) {
  setRentals(rentalsData as any[]);
}
      } catch {}
      // Load documents
      try {
        const docsData = await documentsAPI.getAll();
        setDocuments(docsData);
      } catch {}
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load user data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadLocations = async () => {
    try {
      const data = await locationsAPI.getAll();
      setLocations(Array.isArray(data) ? data : []);
    } catch {
      setLocations([]);
    }
  };

  const handleFileChange = (type: 'aadharFront' | 'aadharBack' | 'pan' | 'drivingLicense', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDocumentFiles(prev => ({ ...prev, [type]: file }));
    }
  };

  const handleSendEmailOTP = async () => {
    if (!formData.email) return;
    try {
      await authAPI.sendEmailOTP(formData.email);
      setIsEmailVerifying(true);
      toast({ title: "OTP Sent", description: "Verification code sent to your email" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleVerifyEmailOTP = async () => {
    if (!emailOTP) return;
    try {
      const result = await authAPI.verifyEmailOTP(formData.email, emailOTP);
      setUser(result.user);
      setIsEmailVerifying(false);
      setEmailOTP('');
      toast({ title: "Success", description: "Email verified successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSendMobileOTP = async () => {
    if (!formData.mobile) return;
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(formData.mobile)) {
      toast({ title: "Invalid Mobile", description: "Please enter a valid 10-digit mobile number", variant: "destructive" });
      return;
    }
    try {
      const response = await authAPI.sendMobileOTP(formData.mobile);
      setIsMobileVerifying(true);
      toast({ 
        title: "OTP Sent", 
        description: response.message || "Verification code sent successfully",
        variant: response.error ? "default" : "default" 
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleVerifyMobileOTP = async () => {
    if (!mobileOTP) return;
    try {
      const result = await authAPI.verifyMobileOTP(formData.mobile, mobileOTP);
      setUser(result.user);
      setIsMobileVerifying(false);
      setMobileOTP('');
      toast({ title: "Success", description: "Mobile number verified successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;

    const mobileRegex = /^[6-9]\d{9}$/;
    const contactRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(formData.mobile)) {
      toast({
        title: "Invalid Mobile Number",
        description: "Mobile number must be 10 digits and start with 6, 7, 8, or 9.",
        variant: "destructive",
      });
      return;
    }
    if (!contactRegex.test(formData.emergencyContact)) {
      toast({
        title: "Invalid Emergency Contact",
        description: "Emergency contact must be 10 digits and start with 6, 7, 8, or 9.",
        variant: "destructive",
      });
      return;
    }
    if (!contactRegex.test(formData.familyContact)) {
      toast({
        title: "Invalid Family Contact",
        description: "Family contact must be 10 digits and start with 6, 7, 8, or 9.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.name || !formData.email || !formData.emergencyContact || !formData.familyContact || !formData.permanentAddress || (!formData.currentLocationId && !formData.currentAddress)) {
      toast({
        title: "Missing Information",
        description: "Please fill all required fields (except Hotel Stay).",
        variant: "destructive",
      });
      return;
    }

    if (!user.emailVerified || formData.email !== user.email) {
      toast({
        title: "Email Not Verified",
        description: "Please verify your email address using OTP.",
        variant: "destructive",
      });
      return;
    }

    if (!user.mobileVerified || formData.mobile !== user.mobile) {
      toast({
        title: "Mobile Not Verified",
        description: "Please verify your mobile number using OTP.",
        variant: "destructive",
      });
      return;
    }

    try {
      await usersAPI.update(user.id, {
        name: formData.name,
        mobile: formData.mobile,
        emergencyContact: formData.emergencyContact,
        familyContact: formData.familyContact,
        permanentAddress: formData.permanentAddress,
        currentAddress: formData.currentAddress,
        currentLocationId: formData.currentLocationId || null,
        hotelStay: formData.hotelStay,
      });
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
      loadUserData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    }
  };

  const handleDocumentUpload = async (type: 'aadhar_front' | 'aadhar_back' | 'pan' | 'driving_license', file: File) => {
    if (!file || !user) return;

    try {
      let fileUrl: string | undefined;
      try {
        const presign = await documentsAPI.getUploadUrl(file.name, type, file.type);
        await fetch(presign.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        fileUrl = presign.fileUrl;
      } catch (err) {
        const direct = await documentsAPI.uploadFile(file, file.name, type);
        fileUrl = direct.fileUrl;
      }
      const doc = await documentsAPI.upload(file.name, type, fileUrl);
      setDocuments([...documents, doc]);
      toast({
        title: "Success",
        description: "Document uploaded successfully. Pending admin approval.",
      });
      // Clear the file input
      setDocumentFiles(prev => ({ ...prev, [type === 'aadhar_front' ? 'aadharFront' : type === 'aadhar_back' ? 'aadharBack' : type === 'pan' ? 'pan' : 'drivingLicense']: null }));
      loadUserData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload document",
        variant: "destructive",
      });
    }
  };

  const handleAction = async (action: 'cancel' | 'start' | 'complete', id: string) => {
    // Handle rental actions
    try {
      if (action === 'cancel') await rentalsAPI.cancel(id);
      if (action === 'start') await rentalsAPI.startRide(id);
      if (action === 'complete') await rentalsAPI.completeRide(id);
      toast({ title: "Success", description: `Rental ${action}ed successfully` });
      loadUserData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleReview = async (id: string) => {
    const ratingStr = window.prompt("Rate (1-5):", "5");
    const comment = window.prompt("Comment:", "Great ride!");
    if (ratingStr && comment) {
      const rating = parseInt(ratingStr);
      if (isNaN(rating) || rating < 1 || rating > 5) {
        toast({ title: "Error", description: "Invalid rating", variant: "destructive" });
        return;
      }
      try {
        await rentalsAPI.submitReview(id, { rating, comment });
        toast({ title: "Success", description: "Review submitted" });
      } catch (error: any) {
         toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'history', label: 'Rental History', icon: History },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="User Dashboard"
        description="Manage your profile, upload documents, and view your bike rental history on your RideFlow dashboard."
        keywords="bike rental dashboard, user profile, rental history, document verification"
        noindex={true}
      />
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-display font-bold mb-2">
              {isLoading ? 'Loading...' : `Welcome, ${user?.name || 'User'}`}
            </h1>
            <p className="text-muted-foreground">
              Manage your account and documents.
            </p>
          </div>

          <div className="grid lg:grid-cols-4 gap-6">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-card rounded-2xl shadow-card p-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] overflow-y-auto">
                <nav className="space-y-1">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                        activeTab === tab.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <tab.icon className="h-5 w-5" />
                      <span className="font-medium">{tab.label}</span>
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            {/* Content */}
            <div className="lg:col-span-3 space-y-6">
              {/* Overview */}
              {activeTab === 'overview' && (
                <>
                  {/* Stats Cards */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-card rounded-2xl shadow-card p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                          <Bike className="h-6 w-6 text-accent" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Rentals</p>
                          <p className="text-2xl font-display font-bold">{rentals.length}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-card rounded-2xl shadow-card p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                          <FileText className="h-6 w-6 text-secondary-foreground" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Documents</p>
                          <p className="text-2xl font-display font-bold">{documents.length}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* My Documents */}
                  <div className="bg-card rounded-2xl shadow-card p-6">
                    <h3 className="font-display font-semibold text-lg mb-4">My Documents</h3>
                    {documents.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        {documents.map((doc) => {
                          const StatusIcon = statusStyles[doc.status as keyof typeof statusStyles].icon;
                          const isImage =
                            (doc.url && /\.(png|jpg|jpeg)$/i.test(doc.url)) ||
                            (doc.name && /\.(png|jpg|jpeg)$/i.test(doc.name));
                          return (
                            <div key={doc.id || doc._id} className="rounded-xl overflow-hidden bg-muted/50 border flex flex-col h-full">
                              <div className="relative">
                                {isImage ? (
                                  <img
                                    src={doc.url}
                                    alt={`Uploaded document: ${doc.name}`}
                                    className="w-full h-24 sm:h-32 object-contain bg-muted"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="flex items-center justify-center w-full h-24 sm:h-32 bg-muted">
                                    <a
                                      href={doc.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs underline text-muted-foreground"
                                    >
                                      Open Document
                                    </a>
                                  </div>
                                )}
                                <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                                  <Badge className={`${statusStyles[doc.status as keyof typeof statusStyles].color} text-[10px] px-1 py-0 h-5`}>
                                    <StatusIcon className="h-3 w-3 mr-1" />
                                    <span className="hidden sm:inline">{doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}</span>
                                  </Badge>
                                  {doc.status === 'rejected' && doc.rejectionReason && (
                                    <Badge variant="outline" className="bg-destructive/5 text-destructive border-destructive/20 text-[9px] px-1 py-0 leading-tight max-w-[120px] text-right">
                                      {doc.rejectionReason}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="p-3 sm:p-4 flex items-center justify-between mt-auto">
                                <div className="min-w-0 flex-1 mr-2">
                                  <p className="font-medium text-sm truncate">{doc.name}</p>
                                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                                    {doc.type.replace('_', ' ')}
                                  </p>
                                </div>
                                <a
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs underline text-muted-foreground shrink-0"
                                >
                                  View
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">No documents uploaded yet</p>
                    )}
                  </div>

                  {/* Recent Activity */}
                  <div className="bg-card rounded-2xl shadow-card p-6">
                    <h3 className="font-display font-semibold text-lg mb-4">Recent Rentals</h3>
                    <div className="space-y-4">
                      {rentals.slice(0, 3).length > 0 ? (
                        rentals.slice(0, 3).map((rental) => {
                          const StatusIcon = rentalStatusStyles[rental.status as keyof typeof rentalStatusStyles]?.icon || Clock;
                          return (
                            <div key={rental._id || rental.id} className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                                  <Bike className="h-5 w-5 text-secondary-foreground" />
                                </div>
                                <div>
                                  <p className="font-medium">Rental #{rental.id.slice(0, 8)}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {new Date(rental.startTime).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <Badge className={rentalStatusStyles[rental.status as keyof typeof rentalStatusStyles]?.color || 'bg-muted'}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {rental.status.charAt(0).toUpperCase() + rental.status.slice(1)}
                              </Badge>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-muted-foreground text-center py-4">No rentals yet</p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Documents */}
              {activeTab === 'documents' && (
                <div className="space-y-6">
                  {/* Personal Information */}
                  <div className="bg-card rounded-2xl shadow-card p-6">
                    <h3 className="font-display font-semibold text-lg mb-4">Personal Information</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => {
                          // Allow only alphabets and spaces, max 50 chars
                          const value = e.target.value;
                          if (/^[a-zA-Z\s]*$/.test(value)) {
                            setFormData(prev => ({ ...prev, name: value.slice(0, 50) }));
                          }
                        }}
                        maxLength={50}
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mobile">Mobile Number</Label>
                      <div className="flex gap-2">
                        <Input
                          id="mobile"
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          pattern="^[6-9]\\d{9}$"
                          value={formData.mobile}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                            setFormData(prev => ({ ...prev, mobile: digits }));
                          }}
                          placeholder="Enter your mobile number"
                          className="flex-1"
                          disabled={user?.mobileVerified && formData.mobile === user.mobile}
                        />
                        {formData.mobile && formData.mobile !== user?.mobile && !isMobileVerifying && (
                          <Button size="sm" onClick={handleSendMobileOTP}>Send OTP</Button>
                        )}
                        {user?.mobileVerified && formData.mobile === user.mobile && (
                          <Badge className="bg-green-500/10 text-green-500 border-none">Verified</Badge>
                        )}
                      </div>
                      {isMobileVerifying && (
                        <div className="flex gap-2 mt-2">
                          <Input
                            placeholder="Enter 6-digit OTP"
                            value={mobileOTP}
                            onChange={(e) => setMobileOTP(e.target.value)}
                            maxLength={6}
                            className="w-32"
                          />
                          <Button size="sm" onClick={handleVerifyMobileOTP}>Verify</Button>
                          <Button size="sm" variant="ghost" onClick={() => setIsMobileVerifying(false)}>Cancel</Button>
                        </div>
                      )}
                      {formData.mobile && !/^[6-9]\d{9}$/.test(formData.mobile) && (
                        <p className="text-xs text-destructive">Enter 10 digits starting with 6, 7, 8, or 9</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emergencyContact">Emergency Contact</Label>
                      <Input
                        id="emergencyContact"
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        pattern="^[6-9]\\d{9}$"
                        value={formData.emergencyContact}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setFormData(prev => ({ ...prev, emergencyContact: digits }));
                        }}
                        placeholder="Enter emergency contact number"
                      />
                      {formData.emergencyContact && !/^[6-9]\d{9}$/.test(formData.emergencyContact) && (
                        <p className="text-xs text-destructive">Enter 10 digits starting with 6, 7, 8, or 9</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="familyContact">Family Contact</Label>
                      <Input
                        id="familyContact"
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        pattern="^[6-9]\\d{9}$"
                        value={formData.familyContact}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setFormData(prev => ({ ...prev, familyContact: digits }));
                        }}
                        placeholder="Enter family contact number"
                      />
                      {formData.familyContact && !/^[6-9]\d{9}$/.test(formData.familyContact) && (
                        <p className="text-xs text-destructive">Enter 10 digits starting with 6, 7, 8, or 9</p>
                      )}
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="permanentAddress">Permanent Address</Label>
                      <Input
                        id="permanentAddress"
                        value={formData.permanentAddress}
                        onChange={(e) => {
                          const value = e.target.value.slice(0, 200);
                          setFormData(prev => ({ ...prev, permanentAddress: value }));
                        }}
                        maxLength={200}
                        placeholder="Enter your permanent address"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="currentLocation">Current Location</Label>
                      <Select
                        value={formData.currentLocationId}
                        onValueChange={(value) => {
                          const selected = locations.find((l) => l?.id === value);
                          setFormData((prev) => ({
                            ...prev,
                            currentLocationId: value,
                            currentAddress: selected ? formatLocationDisplay(selected) : prev.currentAddress,
                          }));
                        }}
                      >
                        <SelectTrigger id="currentLocation">
                          <SelectValue placeholder="Select your current location" />
                        </SelectTrigger>
                        <SelectContent>
                          {locations
                            .slice()
                            .sort((a, b) => formatLocationDisplay(a).localeCompare(formatLocationDisplay(b)))
                            .map((loc) => (
                              <SelectItem key={loc.id} value={loc.id}>
                                {formatLocationDisplay(loc)}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="hotelStay">Hotel Stay</Label>
                      <Input
                        id="hotelStay"
                        value={formData.hotelStay}
                        onChange={(e) => {
                          const value = e.target.value.slice(0, 100);
                          setFormData(prev => ({ ...prev, hotelStay: value }));
                        }}
                        maxLength={100}
                        placeholder="Enter hotel details (if any)"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="email">Email Address</Label>
                      <div className="flex gap-2">
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="Enter your email address"
                          className="flex-1"
                          disabled={user?.emailVerified && formData.email === user.email}
                        />
                        {formData.email && formData.email !== user?.email && !isEmailVerifying && (
                          <Button size="sm" onClick={handleSendEmailOTP}>Send OTP</Button>
                        )}
                        {user?.emailVerified && formData.email === user.email && (
                          <Badge className="bg-green-500/10 text-green-500 border-none">Verified</Badge>
                        )}
                      </div>
                      {isEmailVerifying && (
                        <div className="flex gap-2 mt-2">
                          <Input
                            placeholder="Enter 6-digit OTP"
                            value={emailOTP}
                            onChange={(e) => setEmailOTP(e.target.value)}
                            maxLength={6}
                            className="w-32"
                          />
                          <Button size="sm" onClick={handleVerifyEmailOTP}>Verify</Button>
                          <Button size="sm" variant="ghost" onClick={() => setIsEmailVerifying(false)}>Cancel</Button>
                        </div>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <Button onClick={handleUpdateProfile}>
                        Update Profile
                      </Button>
                    </div>
                  </div>
                </div>

                  {/* Document Upload Section */}
                  <div className="bg-card rounded-2xl shadow-card p-6">
                    <h3 className="font-display font-semibold text-lg mb-4">Upload Documents</h3>
                    
                    {(() => {
                      const mobileRegex = /^[6-9]\d{9}$/;
                      const contactRegex = /^[6-9]\d{9}$/;
                      const isProfileComplete = 
                        formData.name && 
                        formData.mobile && mobileRegex.test(formData.mobile) &&
                        formData.email && 
                        formData.emergencyContact && contactRegex.test(formData.emergencyContact) &&
                        formData.familyContact && contactRegex.test(formData.familyContact) &&
                        formData.permanentAddress && 
                        (formData.currentLocationId || formData.currentAddress);

                      if (!isProfileComplete) {
                        return (
                          <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                            <p>Please complete your Personal Information (including a valid mobile number) to enable document uploads.</p>
                          </div>
                        );
                      }

                      return (
                        <>
                    {/* Aadhar Card - Front and Back Side by Side */}
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Aadhar Card - Front</Label>
                          {(() => {
                            const doc = getLatestDoc('aadhar_front');
                            const status = doc?.status || 'none';
                            if (status === 'none') return null;
                            const StatusIcon = statusStyles[status as keyof typeof statusStyles]?.icon || Clock;
                            return (
                              <div className="flex flex-col items-end gap-1">
                                <Badge className={statusStyles[status as keyof typeof statusStyles]?.color || 'bg-muted'}>
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {status === 'approved' ? 'Accepted' : status.charAt(0).toUpperCase() + status.slice(1)}
                                </Badge>
                                {status === 'rejected' && doc?.rejectionReason && (
                                  <span className="text-[10px] text-destructive font-medium bg-destructive/5 px-1 rounded border border-destructive/10 max-w-[150px] truncate" title={doc.rejectionReason}>
                                    Reason: {doc.rejectionReason}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        <div className="border-2 border-dashed border-border rounded-xl p-4">
                          {(() => {
                            const status = getDocStatus('aadhar_front') as 'approved' | 'pending' | 'rejected' | 'none';
                            const canUpload = status === 'none' || status === 'rejected';
                            if (!canUpload) {
                              return (
                                <div className="text-center text-sm text-muted-foreground">
                                  {status === 'approved' ? 'Document accepted' : 'Document pending review'}
                                </div>
                              );
                            }
                            return (
                              <>
                                <input
                                  type="file"
                                  id="aadhar-front"
                                  className="hidden"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  onChange={(e) => handleFileChange('aadharFront', e)}
                                />
                                <label
                                  htmlFor="aadhar-front"
                                  className="cursor-pointer flex flex-col items-center"
                                >
                                  <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                                  <p className="text-sm text-center">
                                    {documentFiles.aadharFront ? documentFiles.aadharFront.name : 'Click to upload'}
                                  </p>
                                </label>
                                {documentFiles.aadharFront && (
                                  <Button
                                    size="sm"
                                    className="w-full mt-2"
                                    onClick={() => handleDocumentUpload('aadhar_front', documentFiles.aadharFront!)}
                                  >
                                    Upload
                                  </Button>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Aadhar Card - Back</Label>
                          {(() => {
                            const doc = getLatestDoc('aadhar_back');
                            const status = doc?.status || 'none';
                            if (status === 'none') return null;
                            const StatusIcon = statusStyles[status as keyof typeof statusStyles]?.icon || Clock;
                            return (
                              <div className="flex flex-col items-end gap-1">
                                <Badge className={statusStyles[status as keyof typeof statusStyles]?.color || 'bg-muted'}>
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {status === 'approved' ? 'Accepted' : status.charAt(0).toUpperCase() + status.slice(1)}
                                </Badge>
                                {status === 'rejected' && doc?.rejectionReason && (
                                  <span className="text-[10px] text-destructive font-medium bg-destructive/5 px-1 rounded border border-destructive/10 max-w-[150px] truncate" title={doc.rejectionReason}>
                                    Reason: {doc.rejectionReason}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        <div className="border-2 border-dashed border-border rounded-xl p-4">
                          {(() => {
                            const status = getDocStatus('aadhar_back') as 'approved' | 'pending' | 'rejected' | 'none';
                            const canUpload = status === 'none' || status === 'rejected';
                            if (!canUpload) {
                              return (
                                <div className="text-center text-sm text-muted-foreground">
                                  {status === 'approved' ? 'Document accepted' : 'Document pending review'}
                                </div>
                              );
                            }
                            return (
                              <>
                                <input
                                  type="file"
                                  id="aadhar-back"
                                  className="hidden"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  onChange={(e) => handleFileChange('aadharBack', e)}
                                />
                                <label
                                  htmlFor="aadhar-back"
                                  className="cursor-pointer flex flex-col items-center"
                                >
                                  <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                                  <p className="text-sm text-center">
                                    {documentFiles.aadharBack ? documentFiles.aadharBack.name : 'Click to upload'}
                                  </p>
                                </label>
                                {documentFiles.aadharBack && (
                                  <Button
                                    size="sm"
                                    className="w-full mt-2"
                                    onClick={() => handleDocumentUpload('aadhar_back', documentFiles.aadharBack!)}
                                  >
                                    Upload
                                  </Button>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* PAN Card and Driving License */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>PAN Card</Label>
                          {(() => {
                            const doc = getLatestDoc('pan');
                            const status = doc?.status || 'none';
                            if (status === 'none') return null;
                            const StatusIcon = statusStyles[status as keyof typeof statusStyles]?.icon || Clock;
                            return (
                              <div className="flex flex-col items-end gap-1">
                                <Badge className={statusStyles[status as keyof typeof statusStyles]?.color || 'bg-muted'}>
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {status === 'approved' ? 'Accepted' : status.charAt(0).toUpperCase() + status.slice(1)}
                                </Badge>
                                {status === 'rejected' && doc?.rejectionReason && (
                                  <span className="text-[10px] text-destructive font-medium bg-destructive/5 px-1 rounded border border-destructive/10 max-w-[150px] truncate" title={doc.rejectionReason}>
                                    Reason: {doc.rejectionReason}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        <div className="border-2 border-dashed border-border rounded-xl p-4">
                          {(() => {
                            const status = getDocStatus('pan') as 'approved' | 'pending' | 'rejected' | 'none';
                            const canUpload = status === 'none' || status === 'rejected';
                            if (!canUpload) {
                              return (
                                <div className="text-center text-sm text-muted-foreground">
                                  {status === 'approved' ? 'Document accepted' : 'Document pending review'}
                                </div>
                              );
                            }
                            return (
                              <>
                                <input
                                  type="file"
                                  id="pan"
                                  className="hidden"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  onChange={(e) => handleFileChange('pan', e)}
                                />
                                <label
                                  htmlFor="pan"
                                  className="cursor-pointer flex flex-col items-center"
                                >
                                  <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                                  <p className="text-sm text-center">
                                    {documentFiles.pan ? documentFiles.pan.name : 'Click to upload'}
                                  </p>
                                </label>
                                {documentFiles.pan && (
                                  <Button
                                    size="sm"
                                    className="w-full mt-2"
                                    onClick={() => handleDocumentUpload('pan', documentFiles.pan!)}
                                  >
                                    Upload
                                  </Button>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Driving License</Label>
                          {(() => {
                            const doc = getLatestDoc('driving_license');
                            const status = doc?.status || 'none';
                            if (status === 'none') return null;
                            const StatusIcon = statusStyles[status as keyof typeof statusStyles]?.icon || Clock;
                            return (
                              <div className="flex flex-col items-end gap-1">
                                <Badge className={statusStyles[status as keyof typeof statusStyles]?.color || 'bg-muted'}>
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {status === 'approved' ? 'Accepted' : status.charAt(0).toUpperCase() + status.slice(1)}
                                </Badge>
                                {status === 'rejected' && doc?.rejectionReason && (
                                  <span className="text-[10px] text-destructive font-medium bg-destructive/5 px-1 rounded border border-destructive/10 max-w-[150px] truncate" title={doc.rejectionReason}>
                                    Reason: {doc.rejectionReason}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        <div className="border-2 border-dashed border-border rounded-xl p-4">
                          {(() => {
                            const status = getDocStatus('driving_license') as 'approved' | 'pending' | 'rejected' | 'none';
                            const canUpload = status === 'none' || status === 'rejected';
                            if (!canUpload) {
                              return (
                                <div className="text-center text-sm text-muted-foreground">
                                  {status === 'approved' ? 'Document accepted' : 'Document pending review'}
                                </div>
                              );
                            }
                            return (
                              <>
                                <input
                                  type="file"
                                  id="driving-license"
                                  className="hidden"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  onChange={(e) => handleFileChange('drivingLicense', e)}
                                />
                                <label
                                  htmlFor="driving-license"
                                  className="cursor-pointer flex flex-col items-center"
                                >
                                  <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                                  <p className="text-sm text-center">
                                    {documentFiles.drivingLicense ? documentFiles.drivingLicense.name : 'Click to upload'}
                                  </p>
                                </label>
                                {documentFiles.drivingLicense && (
                                  <Button
                                    size="sm"
                                    className="w-full mt-2"
                                    onClick={() => handleDocumentUpload('driving_license', documentFiles.drivingLicense!)}
                                  >
                                    Upload
                                  </Button>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-4">
                      Supported: PDF, JPG, PNG (Max 10MB per file)
                    </p>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Rental History */}
              {activeTab === 'history' && (
                <div className="bg-card rounded-2xl shadow-card p-6">
                  <h3 className="font-display font-semibold text-lg mb-4">Rental History</h3>
                  <div className="space-y-4">
                    {rentals.length > 0 ? (
                      rentals.map((rental) => {
                        const StatusIcon = rentalStatusStyles[rental.status as keyof typeof rentalStatusStyles]?.icon || Clock;
                        const bike = rental.bike && typeof rental.bike === 'object' ? rental.bike : null;
                        if (!bike) {
                           return (
                               <div key={rental._id || rental.id} className="p-4 bg-muted/50 rounded-xl">
                                  <p className="text-sm text-muted-foreground">Bike data not available</p>
                                    </div>
                                      );
                                    }
                        const bikeName = bike?.name || 'Unknown Bike';
                        const bikeImage = bike?.image || '';
                        const bookingId = rental.bookingId || (rental._id || rental.id)?.slice(0, 8);
                        
                        return (
                          <div key={rental._id || rental.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl bg-muted/50 gap-4">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                                {bikeImage ? (
                                  <img
                                    src={bikeImage}
                                    alt={`Rental bike: ${bikeName}`}
                                    className="w-10 h-10 rounded-lg object-cover"
                                  />
                                ) : (
                                  <Bike className="h-5 w-5 text-secondary-foreground" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium">{bikeName}</p>
                                <p className="text-xs text-muted-foreground font-mono">ID: {bookingId}</p>
                                <div className="text-sm text-muted-foreground mt-1">
                                  <p>Pickup: {new Date(rental.pickupTime || rental.startTime).toLocaleString()}</p>
                                  {(rental.dropoffTime || rental.endTime) && (
                                    <p>Dropoff: {new Date(rental.dropoffTime || rental.endTime).toLocaleString()}</p>
                                  )}
                                  {(bike?.brand || bike?.type) && (
                                    <p>
                                      {bike?.brand ? `${bike.brand} ` : ''}
                                      {bike?.type ? String(bike.type).toUpperCase() : ''}
                                    </p>
                                  )}
                                  {(bike?.pricePerHour || bike?.kmLimit) && (
                                    <p>
                                      {bike?.pricePerHour ? `₹${bike.pricePerHour}/hr` : ''}
                                      {bike?.pricePerHour && bike?.kmLimit ? ' • ' : ''}
                                      {bike?.kmLimit ? `${bike.kmLimit} km limit` : ''}
                                    </p>
                                  )}
                                  {bike?.location && (
                                    <p>Location: {formatLocationDisplay(bike.location)}</p>
                                  )}
                                </div>
                                {(() => {
                                  const bookingPrice = rental.totalAmount || 0;
                                  const totalCost = rental.totalCost || 0;
                                  const extras = totalCost > bookingPrice ? totalCost - bookingPrice : 0;
                                  
                                  // Calculation details
                                  let distancePrice = 0;
                                  let delayPrice = 0;
                                  let displayDelayHours = '0.0';
                                  const startKm = parseFloat(rental.startKm);
                                  const endKm = parseFloat(rental.endKm);
                                  
                                  if (!isNaN(startKm) && !isNaN(endKm) && bike && bike.excessKmCharge && bike.kmLimit) {
                                    const totalKm = Math.max(0, endKm - startKm);
                                    const kmLimit = Number(bike.kmLimit);
                                    const excessKm = Math.max(0, totalKm - kmLimit);
                                    distancePrice = excessKm * Number(bike.excessKmCharge);
                                  }
                                  
                                  // Delay stored in backend as minutes; convert to hours to match admin
                                  const hourlyRate = Number(bike?.weekdayRate || bike?.pricePerHour || 0);
                                  const delayMinutesRaw = parseFloat(rental.delay);
                                  if (!isNaN(delayMinutesRaw) && delayMinutesRaw > 0 && hourlyRate > 0) {
                                    const delayHours = delayMinutesRaw / 60;
                                    delayPrice = delayHours * hourlyRate;
                                    displayDelayHours = delayHours.toFixed(2);
                                  }

                                  return (
                                    <div className="mt-2 space-y-1">
                                      <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Booking Amount:</span>
                                        <span className="font-medium">₹{bookingPrice.toFixed(2)}</span>
                                      </div>
                                      
                                      {extras > 0 && (
                                        <>
                                          <div className="flex justify-between items-center text-sm text-primary">
                                            <span className="font-medium">Extras:</span>
                                            <span className="font-bold">₹{extras.toFixed(2)}</span>
                                          </div>
                                          <div className="bg-muted/50 rounded p-2 text-xs space-y-1 mt-1">
                                             {distancePrice > 0 && (
                                               <div className="flex justify-between">
                                                 <span className="text-muted-foreground">
                                                   Excess Distance ({Math.max(0, parseFloat(rental.endKm) - parseFloat(rental.startKm) - Number(bike?.kmLimit || 0)).toFixed(1)} km × ₹{bike?.excessKmCharge}/km):
                                                 </span>
                                                 <span>₹{distancePrice.toFixed(2)}</span>
                                               </div>
                                             )}
                                             {delayPrice > 0 && (
                                               <div className="flex justify-between">
                                                 <span className="text-muted-foreground">
                                                    Delay Charges ({displayDelayHours} hrs × ₹{hourlyRate}/hr):
                                                 </span>
                                                 <span>₹{delayPrice.toFixed(2)}</span>
                                               </div>
                                             )}
                                           </div>
                                        </>
                                      )}
                                      
                                      <div className="flex justify-between items-center text-sm font-bold mt-2 pt-2 border-t">
                                        <span>Total Paid:</span>
                                        <span>
                                          ₹{totalCost > 0 ? totalCost.toFixed(2) : bookingPrice.toFixed(2)}
                                          {rental.paymentStatus && (
                                            <span className="text-xs font-normal text-muted-foreground ml-2">
                                              ({String(rental.paymentStatus).toUpperCase()})
                                            </span>
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                            
                            <div className="flex flex-col items-end gap-2">
                              <Badge className={`${rentalStatusStyles[rental.status as keyof typeof rentalStatusStyles]?.color || 'bg-muted'} mb-2`}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {rental.status.charAt(0).toUpperCase() + rental.status.slice(1)}
                              </Badge>
                              
                              {['confirmed', 'ongoing', 'active'].includes(rental.status) && (
                                <Button size="sm" onClick={() => navigate('/active-ride')}>
                                  View Ride
                                </Button>
                              )}

                              {rental.status === 'confirmed' && (
                                <Button size="sm" variant="destructive" onClick={() => handleAction('cancel', rental.id)}>
                                  Cancel
                                </Button>
                              )}
                              
                              {rental.status === 'completed' && !rental.review && (
                                <Button size="sm" variant="outline" onClick={() => handleReview(rental.id)}>
                                  Leave Review
                                </Button>
                              )}
                              
                              {rental.status === 'completed' && (
                                <Button size="sm" variant="ghost" onClick={() => generateInvoice(rental, bike)}>
                                  <Download className="h-4 w-4 mr-2" />
                                  Invoice
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-muted-foreground text-center py-4">No rental history</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
