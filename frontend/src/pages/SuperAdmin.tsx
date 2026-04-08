import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Bike,
  Users,
  FileText,
  Settings,
  Search,
  CheckCircle,
  XCircle,
  X,
  Clock,
  Eye,
  LogOut,
  Menu,
  LayoutDashboard,
  Plus,
  Edit,
  Trash2,
  MapPin,
  Shield,
  Calendar,
  Moon,
  Sun,
  Maximize2,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { HeroImageManager } from '@/components/HeroImageManager';
import { toast } from '@/hooks/use-toast';
import { SEO } from '@/components/SEO';
import {
  bikesAPI,
  usersAPI,
  documentsAPI,
  rentalsAPI,
  authAPI,
  getCurrentUser,
  locationsAPI,
  settingsAPI,
} from '@/lib/api';
import { Bike as BikeType } from '@/types';
import { useTheme } from 'next-themes';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';

const statusStyles = {
  verified: { color: 'bg-accent/10 text-accent', icon: CheckCircle },
  pending: { color: 'bg-primary/10 text-primary', icon: Clock },
  unverified: { color: 'bg-destructive/10 text-destructive', icon: XCircle },
  approved: { color: 'bg-accent/10 text-accent', icon: CheckCircle },
  rejected: { color: 'bg-destructive/10 text-destructive', icon: XCircle },
};

import { PREDEFINED_BIKE_SPECS, getBrandForModel, validateBrandModelMatch } from '@/lib/bikeSpecs';

const superAdminTabIds = [
  'dashboard',
  'models',
  'admins',
  'bookings',
  'users',
  'documents',
  'settings',
  'locations',
] as const;

const STATE_CITY_DATA: Record<string, string[]> = {
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Tirupati'],
  'Arunachal Pradesh': ['Itanagar', 'Tawang', 'Ziro', 'Pasighat'],
  'Assam': ['Guwahati', 'Dibrugarh', 'Silchar', 'Jorhat'],
  'Bihar': ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur'],
  'Chhattisgarh': ['Raipur', 'Bhilai', 'Bilaspur'],
  'Goa': ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa'],
  'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar'],
  'Haryana': ['Gurgaon', 'Faridabad', 'Panipat', 'Ambala'],
  'Himachal Pradesh': ['Shimla', 'Manali', 'Dharamshala'],
  'Jharkhand': ['Ranchi', 'Jamshedpur', 'Dhanbad'],
  'Karnataka': ['Bangalore', 'Mysore', 'Hubli', 'Mangalore', 'Belgaum'],
  'Kerala': ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur'],
  'Madhya Pradesh': ['Indore', 'Bhopal', 'Jabalpur', 'Gwalior'],
  'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Aurangabad'],
  'Manipur': ['Imphal'],
  'Meghalaya': ['Shillong'],
  'Mizoram': ['Aizawl'],
  'Nagaland': ['Kohima', 'Dimapur'],
  'Odisha': ['Bhubaneswar', 'Cuttack', 'Rourkela'],
  'Punjab': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala'],
  'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer'],
  'Sikkim': ['Gangtok'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem'],
  'Telangana': ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar'],
  'Tripura': ['Agartala'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Ghaziabad', 'Agra', 'Varanasi', 'Meerut'],
  'Uttarakhand': ['Dehradun', 'Haridwar', 'Roorkee'],
  'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri'],
  'Delhi': ['New Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi'],
  'Puducherry': ['Puducherry'],
};

const LAST_ADMIN_CITY_STORAGE_KEY = 'superadmin.lastAdminCity';

// Helper function to format location name for display
const formatLocationDisplay = (loc: any): string => {
  if (!loc) return '';
  // Prioritize actual location name over city
  return loc.name || loc.city || '';
};

export default function SuperAdmin() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTabParam = new URLSearchParams(window.location.search).get('tab') || '';
  const [activeTab, setActiveTab] = useState(
    superAdminTabIds.includes(initialTabParam as any) ? initialTabParam : 'dashboard'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [bookingSearchQuery, setBookingSearchQuery] = useState('');
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const [documentsSearchQuery, setDocumentsSearchQuery] = useState('');
  const [bikes, setBikes] = useState<BikeType[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [rentals, setRentals] = useState<any[]>([]);
  const [allVehiclesSearchQuery, setAllVehiclesSearchQuery] = useState('');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>('all');
  const [selectedDocumentUser, setSelectedDocumentUser] = useState<any>(null);
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [createAdminOpen, setCreateAdminOpen] = useState(false);
  const [newAdminForm, setNewAdminForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    locationId: '',
  });
  const [newAdminCity, setNewAdminCity] = useState<string>('');
  const [newAdminOtherCity, setNewAdminOtherCity] = useState<string>('');
  const [editAdminOpen, setEditAdminOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<any | null>(null);
  const [editAdminForm, setEditAdminForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    locationId: '',
  });
  const [editAdminOtherCity, setEditAdminOtherCity] = useState<string>('');
  const [bikeDialogOpen, setBikeDialogOpen] = useState(false);
  const [editingBike, setEditingBike] = useState<any | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [docToReject, setDocToReject] = useState<string | null>(null);
  const [bikeSpecs, setBikeSpecs] = useState<any[]>(PREDEFINED_BIKE_SPECS);
  const [bikeForm, setBikeForm] = useState<any>({
    name: '',
    brand: '',
    year: '',
    type: 'fuel',
    category: 'midrange',
    pricePerHour: '',
    kmLimit: '',
    locationId: '',
    image: '',
    images: ['', '', ''],
    weekdayRate: '',
    weekendRate: '',
    excessKmCharge: '',
    kmLimitPerHour: '',
    minBookingHours: '',
    gstPercentage: '18',
  });
  const [bikeFormErrors, setBikeFormErrors] = useState<Record<string, string>>({});

  const BikeImagePreview = ({ url, label }: { url: string; label: string }) => {
    const [hasError, setHasError] = useState(false);
    useEffect(() => {
      setHasError(false);
    }, [url]);

    if (!url) return null;

    return (
      <div
        className="relative group cursor-pointer w-24 h-24 flex-shrink-0"
        onClick={() => {
          setPreviewImageUrl(url);
          setIsPreviewModalOpen(true);
        }}
      >
        <img
          src={url}
          alt={label}
          className={`w-full h-full object-contain rounded-lg border bg-muted/30 transition-all group-hover:brightness-90 ${hasError ? 'opacity-50' : ''}`}
          onError={() => setHasError(true)}
        />
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-lg">
            <span className="text-[10px] text-destructive font-medium text-center px-1">
              Failed to load
            </span>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-black/40 text-white p-1 rounded-full backdrop-blur-sm">
            <Maximize2 className="h-4 w-4" />
          </div>
        </div>
      </div>
    );
  };
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<any | null>(null);
  const [locationForm, setLocationForm] = useState<any>({
    name: '',
    city: '',
    state: '',
    country: '',
  });
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string>('all');
  const [documentsSort, setDocumentsSort] = useState<'newest' | 'oldest'>('newest');
  const [mounted, setMounted] = useState(false);
  const [numericErrors, setNumericErrors] = useState<Record<string, string>>({});

  // Numeric input validation helper
  const handleNumericChange = (field: string, value: string) => {
    if (value === '') {
      setBikeForm({ ...bikeForm, [field]: '' });
      setNumericErrors((prev) => ({ ...prev, [field]: '' }));
      return;
    }

    const constraints: Record<string, { maxLen: number; maxVal: number }> = {
      weekdayRate: { maxLen: 5, maxVal: 99999 },
      weekendRate: { maxLen: 5, maxVal: 99999 },
      kmLimitPerHour: { maxLen: 3, maxVal: 999 },
      kmLimit: { maxLen: 3, maxVal: 999 },
      excessKmCharge: { maxLen: 4, maxVal: 9999 },
      minBookingHours: { maxLen: 2, maxVal: 24 },
      gstPercentage: { maxLen: 3, maxVal: 100 },
    };

    const config = constraints[field];
    const regex = /^\d*\.?\d*$/;

    if (!regex.test(value)) {
      setNumericErrors((prev) => ({ ...prev, [field]: 'Only numbers are allowed' }));
      return;
    }

    if (config) {
      const digitOnly = value.split('.')[0];
      if (digitOnly.length > config.maxLen) {
        setNumericErrors((prev) => ({ ...prev, [field]: 'Maximum limit exceeded' }));
        return;
      }
      const num = parseFloat(value);
      if (num > config.maxVal) {
        setNumericErrors((prev) => ({ ...prev, [field]: `Max value is ${config.maxVal}` }));
        return;
      }
    }

    setBikeForm({ ...bikeForm, [field]: value });
    setNumericErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleNumericKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Block e, +, -, and other non-numeric keys except control keys
    const blockedKeys = ['e', 'E', '+', '-'];
    if (blockedKeys.includes(e.key)) {
      e.preventDefault();
    }
  };

  const handleScroll = (source: 'top' | 'bottom') => {
    const top = topScrollRef.current;
    const bottom = bottomScrollRef.current;
    if (!top || !bottom) return;

    if (source === 'top') {
      bottom.scrollLeft = top.scrollLeft;
    } else {
      top.scrollLeft = bottom.scrollLeft;
    }
  };
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-refresh users/documents while on Documents tab to reflect latest profile updates
  useEffect(() => {
    if (activeTab !== 'documents') return;
    const interval = setInterval(async () => {
      try {
        const [usersData, docsData] = await Promise.all([usersAPI.getAll(), documentsAPI.getAll()]);
        setUsers(usersData);
        setDocuments(docsData);
      } catch {
        // Silent fail to avoid toast spam
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const setTab = (tabId: string) => {
    setActiveTab(tabId);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tabId);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && superAdminTabIds.includes(tabParam as any) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!createAdminOpen) return;
    if (locations.length === 0) return;
    const cityOptions = Array.from(new Set(locations.map((l) => l.city).filter(Boolean)));
    const savedCityRaw = localStorage.getItem(LAST_ADMIN_CITY_STORAGE_KEY) || '';
    const savedCity = savedCityRaw.trim();
    const matchedSavedCity = savedCity
      ? cityOptions.find((c) => String(c).toLowerCase() === savedCity.toLowerCase())
      : null;
    const goaLoc =
      locations.find((l) => String(l.city || '').toLowerCase() === 'goa') ||
      locations.find((l) =>
        String(l.name || '')
          .toLowerCase()
          .includes('goa')
      ) ||
      null;
    const goaCity = goaLoc?.city || (goaLoc?.name ? 'Goa' : '') || 'Goa';
    setNewAdminCity((prev) => prev || matchedSavedCity || goaCity);
    setNewAdminOtherCity('');
  }, [createAdminOpen, locations]);

  useEffect(() => {
    if (!createAdminOpen) return;
    if (!newAdminCity) return;
    if (newAdminCity === '__other__') {
      setNewAdminForm((prev) => ({ ...prev, locationId: '' }));
      return;
    }
    const locationsForCity = locations.filter(
      (l) => String(l.city || '').toLowerCase() === String(newAdminCity || '').toLowerCase()
    );
    if (locationsForCity.length > 0) {
      setNewAdminForm((prev) => ({
        ...prev,
        locationId: prev.locationId || locationsForCity[0].id,
      }));
    }
  }, [createAdminOpen, newAdminCity, locations]);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      navigate('/auth');
      return;
    }
    if (user.role !== 'superadmin') {
      toast({
        title: 'Access Denied',
        description: 'Super Admin access required',
        variant: 'destructive',
      });
      navigate('/dashboard');
      return;
    }
    setCurrentUser(user);
    loadData();
  }, []);

  useEffect(() => {
    if (mounted) {
      loadData();
    }
  }, [selectedLocationFilter]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [bikesData, usersData, docsData, locationsData, rentalsData, settingsData, specsData] =
        await Promise.all([
          bikesAPI.getAll(),
          usersAPI.getAll(),
          documentsAPI.getAll(),
          locationsAPI.getAll(true),
          rentalsAPI.getAll(),
          settingsAPI.getHomeHero(),
          bikesAPI.getSpecs().catch(() => []),
        ]);

      if (specsData) {
        // Merge predefined specs with database specs, but only if they don't contradict
        const mergedSpecs = [...PREDEFINED_BIKE_SPECS.map(s => ({ ...s, models: [...s.models] }))];
        specsData.forEach((dbSpec: any) => {
          const dbBrand = dbSpec.brand;
          dbSpec.models.forEach((m: string) => {
            const correctBrand = getBrandForModel(m);
            // Only add model if it's either:
            // 1. Not in our predefined list (new/custom model)
            // 2. In our list and associated with the correct brand
            if (!correctBrand || correctBrand.toLowerCase() === dbBrand.toLowerCase()) {
              const existing = mergedSpecs.find(
                (s) => s.brand.toLowerCase() === dbBrand.toLowerCase()
              );
              if (existing) {
                if (!existing.models.some((em) => em.toLowerCase() === m.toLowerCase())) {
                  existing.models.push(m);
                }
              } else {
                mergedSpecs.push({ brand: dbBrand, models: [m] });
              }
            }
          });
        });
        setBikeSpecs(mergedSpecs);
      }

      const normalizeUserLocationId = (user: any) => {
        if (typeof user?.locationId === 'object') {
          return user.locationId?.id || user.locationId?._id || user.locationId?.toString?.();
        }
        return user?.locationId;
      };

      const goaLoc =
        locationsData.find((l: any) => String(l.city || '').toLowerCase() === 'goa') ||
        locationsData.find((l: any) =>
          String(l.name || '')
            .toLowerCase()
            .includes('goa')
        ) ||
        null;

      if (goaLoc) {
        const adminsMissingLocation = usersData.filter(
          (u: any) => u.role === 'admin' && !normalizeUserLocationId(u)
        );
        if (adminsMissingLocation.length > 0) {
          await Promise.allSettled(
            adminsMissingLocation.map((u: any) => usersAPI.update(u.id, { locationId: goaLoc.id }))
          );
        }
      }

      const finalUsers = goaLoc ? await usersAPI.getAll() : usersData;
      setBikes(bikesData);
      setUsers(finalUsers);
      setDocuments(docsData);
      setLocations(locationsData);
      setRentals(rentalsData);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load admin data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const validateEmail = (email: string) => {
    if (!email) return 'Email is required';
    if (email.length > 100) return 'Email must not exceed 100 characters';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Please enter a valid email address';
    return null;
  };

  const validateName = (name: string) => {
    if (!name.trim()) return 'Full name is required';
    if (name.length > 50) return 'Full name must not exceed 50 characters';
    if (!/^[a-zA-Z\s]+$/.test(name)) return 'Full name must contain only alphabets and spaces';
    return null;
  };

  const validatePassword = (password: string) => {
    if (!password) return 'Password is required';
    if (password.length < 8) return 'Password must be at least 8 characters long';
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
      return 'Password must include uppercase, lowercase, number, and special characters';
    }
    return null;
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      authAPI.logout();
      navigate('/');
    }
  };

  const tabs = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'models', label: 'Vehicles', icon: Bike },
    { key: 'admins', label: 'Admins', icon: Shield },
    { key: 'bookings', label: 'Bookings', icon: Calendar },
    { key: 'users', label: 'Users', icon: Users },
    { key: 'documents', label: 'Documents', icon: FileText },
    { key: 'settings', label: 'Settings', icon: Settings },
    { key: 'locations', label: 'Locations', icon: MapPin },
  ];

  // Filter data based on selected location
  const getBikeLocationId = (bike: any) => {
    if (typeof bike.locationId === 'object') {
      return bike.locationId?.id || bike.locationId?._id || bike.locationId?.toString?.();
    }
    return bike.locationId;
  };

  const getUserLocationId = (user: any) => {
    if (typeof user.locationId === 'object') {
      return user.locationId?.id || user.locationId?._id || user.locationId?.toString?.();
    }
    return user.locationId;
  };

  const filteredBikes =
    selectedLocationFilter === 'all'
      ? bikes
      : bikes.filter((b) => getBikeLocationId(b) === selectedLocationFilter);

  const filteredRentals =
    selectedLocationFilter === 'all'
      ? rentals
      : rentals.filter((r) => {
          const bike = bikes.find((b) => b.id === r.bikeId);
          return bike && getBikeLocationId(bike) === selectedLocationFilter;
        });

  // Users are global - show only regular users
  const filteredUsers = users
    .filter((u) => u.role === 'user')
    .filter((u) => {
      // Filter by location if selected
      if (selectedLocationFilter !== 'all') {
        return getUserLocationId(u) === selectedLocationFilter;
      }
      return true;
    })
    .filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      // Match name and email
      const nameMatch = String(u.name || '').toLowerCase().includes(q);
      const emailMatch = String(u.email || '').toLowerCase().includes(q);
      if (nameMatch || emailMatch) return true;

      // Match Joined Date (createdAt)
      if (u.createdAt) {
        const date = new Date(u.createdAt);
        if (!isNaN(date.getTime())) {
          const yyyy = date.getFullYear().toString();
          const mm = (date.getMonth() + 1).toString().padStart(2, '0');
          const dd = date.getDate().toString().padStart(2, '0');

          // Possible formats
           const standard = `${yyyy}-${mm}-${dd}`;
           const display = `${dd}/${mm}/${yyyy}`;
           const monthYear = `${mm}/${yyyy}`;
           const m = (date.getMonth() + 1).toString();
           const d = date.getDate().toString();

           const normalize = (s: string) => s.replace(/[-/.]/g, '/');
           const qNormalized = normalize(q);

           const possibleDates = [
             normalize(standard),
             normalize(display),
             normalize(monthYear),
             yyyy,
             normalize(`${d}/${m}/${yyyy}`),
             normalize(`${m}/${d}/${yyyy}`),
             normalize(`${m}/${yyyy}`),
           ];

           return possibleDates.some((dateStr) => dateStr.includes(qNormalized));
         }
       }

      return false;
    })
    .sort((a, b) => {
      const ta = new Date(a.createdAt as any).getTime();
      const tb = new Date(b.createdAt as any).getTime();
      return tb - ta;
    });

  // Documents are global - not filtered by location
  const filteredDocuments = documents;

  const adminsForLocation =
    selectedLocationFilter === 'all'
      ? users.filter((u) => u.role === 'admin')
      : users.filter((u) => u.role === 'admin' && getUserLocationId(u) === selectedLocationFilter);

  const adminCitySet = new Set(
    users
      .filter((u) => u.role === 'admin')
      .map((u) => {
        const userLocationId = getUserLocationId(u);
        const loc = locations.find((l) => l.id === userLocationId);
        return String(loc?.city || '').toLowerCase();
      })
      .filter(Boolean)
  );

  const cityOptions = Array.from(new Set(locations.map((l) => l.city).filter(Boolean))).sort(
    (a, b) => String(a).localeCompare(String(b))
  );

  const handleDocumentAction = async (docId: string, action: 'approve' | 'reject') => {
    if (action === 'reject') {
      setDocToReject(docId);
      setRejectionReason('');
      setIsRejectionModalOpen(true);
      return;
    }

    try {
      await documentsAPI.updateStatus(docId, 'approved');
      toast({ title: 'Updated', description: `Document approved` });
      loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || `Failed to approve document`,
        variant: 'destructive',
      });
    }
  };

  const confirmRejection = async () => {
    if (!docToReject) return;
    if (!rejectionReason.trim()) {
      toast({
        title: 'Reason Required',
        description: 'Please enter a reason for rejection',
        variant: 'destructive',
      });
      return;
    }

    try {
      await documentsAPI.updateStatus(docToReject, 'rejected', rejectionReason);
      toast({
        title: 'Document Rejected',
        description: 'Document status updated successfully.',
      });
      setIsRejectionModalOpen(false);
      setDocToReject(null);
      setRejectionReason('');
      loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject document',
        variant: 'destructive',
      });
    }
  };

  const handleViewUserDocuments = async (userId: string) => {
    try {
      const freshUser = await usersAPI.getById(userId);
      const userDocs = documents.filter((d) => d.userId === userId);
      const userRentals = rentals
        .filter((r) => r.userId === userId)
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      setSelectedDocumentUser({ ...freshUser, documents: userDocs, rentals: userRentals });
      setIsDocumentDialogOpen(true);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load user',
        variant: 'destructive',
      });
    }
  };

  const handleVerifyUser = async (userId: string, status: boolean = true) => {
    await usersAPI.update(userId, { isVerified: status });
    toast({
      title: status ? 'User Verified' : 'User Unverified',
      description: `User has been marked as ${status ? 'verified' : 'unverified'}`,
    });
    loadData();
  };

  const rentalsActive = filteredRentals.filter(
    (r) => r.status === 'active' || r.status === 'ongoing'
  );
  const uniqueModelNames = Array.from(new Set(filteredBikes.map((b) => b.name)));

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground animate-pulse">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <SEO
        title="Super Admin Dashboard"
        description="Global management of the RideFlow platform."
        noindex={true}
      />
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 bg-card border-r border-border p-4 flex-col md:sticky md:top-0 md:h-screen overflow-y-auto">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8 px-2">
          <div className="p-2 rounded-xl gradient-hero">
            <Bike className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <span className="font-display font-bold">RideFlow</span>
            <Badge variant="secondary" className="ml-2 text-xs">
              Super Admin
            </Badge>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 ${
                activeTab === tab.key ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* User Info & Actions */}
        <div className="space-y-2 pt-4 border-t border-border">
          <div className="px-4 py-2 text-sm">
            <p className="font-medium">{currentUser?.name}</p>
            <p className="text-xs text-muted-foreground">{currentUser?.email}</p>
          </div>
          {mounted && (
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="h-5 w-5" />
                  Light Mode
                </>
              ) : (
                <>
                  <Moon className="h-5 w-5" />
                  Dark Mode
                </>
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-h-0 p-4 md:p-6 overflow-y-auto">
        <div className="md:hidden mb-4 flex items-center justify-between gap-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 w-9 p-0">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl gradient-hero">
                    <Bike className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <span className="font-display font-bold">RideFlow</span>
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Super Admin
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="p-2">
                <nav className="space-y-1">
                  {tabs.map((tab) => (
                    <SheetClose asChild key={tab.key}>
                      <button
                        onClick={() => setTab(tab.key)}
                        className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 ${
                          activeTab === tab.key ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'
                        }`}
                      >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                      </button>
                    </SheetClose>
                  ))}
                </nav>
              </div>

              <div className="mt-auto space-y-2 pt-4 border-t border-border">
                <div className="px-4 py-2 text-sm">
                  <p className="font-medium">{currentUser?.name}</p>
                  <p className="text-xs text-muted-foreground">{currentUser?.email}</p>
                </div>
                {mounted && (
                  <SheetClose asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 text-muted-foreground"
                      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    >
                      {theme === 'dark' ? (
                        <>
                          <Sun className="h-5 w-5" />
                          Light Mode
                        </>
                      ) : (
                        <>
                          <Moon className="h-5 w-5" />
                          Dark Mode
                        </>
                      )}
                    </Button>
                  </SheetClose>
                )}
                <SheetClose asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 text-muted-foreground"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-5 w-5" />
                    Logout
                  </Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>

          <div className="min-w-0">
            <p className="font-display font-semibold truncate">Super Admin</p>
            <p className="text-xs text-muted-foreground truncate">
              {tabs.find((t) => t.key === activeTab)?.label}
            </p>
          </div>
        </div>

        {/* Location Filter - Global for all tabs except documents and users */}
        {activeTab !== 'documents' && activeTab !== 'users' && (
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground shrink-0" />
                <Select value={selectedLocationFilter} onValueChange={setSelectedLocationFilter}>
                  <SelectTrigger className="w-full md:w-64">
                    <SelectValue placeholder="Filter by Location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {formatLocationDisplay(loc)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedLocationFilter !== 'all' &&
                locations.find((loc) => loc.id === selectedLocationFilter) && (
                  <Badge variant="secondary" className="md:ml-2 w-fit">
                    {formatLocationDisplay(
                      locations.find((loc) => loc.id === selectedLocationFilter)
                    )}
                  </Badge>
                )}
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-display font-bold mb-2">Super Admin Dashboard</h1>
              <p className="text-muted-foreground">
                {selectedLocationFilter === 'all'
                  ? 'Global view across all cities and garages.'
                  : `View for ${formatLocationDisplay(locations.find((loc) => loc.id === selectedLocationFilter)) || 'selected location'}.`}
              </p>
            </div>

            {/* Stats */}
            <div className="grid md:grid-cols-4 gap-4">
              {[
                {
                  label: 'Cities',
                  value: selectedLocationFilter === 'all' ? locations.length : 1,
                  icon: MapPin,
                  color: 'bg-accent',
                  tab: 'locations',
                },
                {
                  label: 'Bike Models',
                  value: uniqueModelNames.length,
                  icon: Bike,
                  color: 'bg-secondary',
                  tab: 'models',
                },
                {
                  label: 'Fleet Inventory',
                  value: filteredBikes.length,
                  icon: Bike,
                  color: 'gradient-hero',
                  tab: 'models',
                },
                {
                  label: 'Active Bookings',
                  value: rentalsActive.length,
                  icon: Calendar,
                  color: 'bg-primary',
                  tab: 'bookings',
                },
                {
                  label: 'Registered Users',
                  value: filteredUsers.length,
                  icon: Users,
                  color: 'bg-secondary',
                  tab: 'users',
                },
              ].map((stat) => (
                <button
                  key={stat.label}
                  onClick={() => setTab(stat.tab as any)}
                  className="bg-card rounded-2xl shadow-card p-6 text-left transition-all hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-xl ${stat.color} flex items-center justify-center shrink-0`}
                    >
                      <stat.icon className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground truncate">{stat.label}</p>
                      <p className="text-2xl font-display font-bold">{stat.value}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'models' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-display font-bold mb-2">Vehicles</h1>
                <p className="text-muted-foreground">
                  Add, edit, or remove vehicles from{' '}
                  {selectedLocationFilter !== 'all' &&
                  locations.find((loc) => loc.id === selectedLocationFilter)
                    ? formatLocationDisplay(
                        locations.find((loc) => loc.id === selectedLocationFilter)
                      )
                    : 'all locations'}
                  .
                </p>
              </div>
              <Button
                className="w-full sm:w-auto"
                onClick={() => {
                  setEditingBike(null);
                  setBikeFormErrors({});
                  setBikeForm({
                    name: '',
                    brand: '',
                    year: '',
                    type: 'fuel',
                    category: 'midrange',
                    pricePerHour: '',
                    kmLimit: '',
                    locationId: '',
                    image: '',
                    images: ['', '', ''],
                    weekdayRate: '',
                    weekendRate: '',
                    excessKmCharge: '',
                    kmLimitPerHour: '',
                    minBookingHours: '',
                    gstPercentage: '18',
                  });
                  setBikeDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Vehicle
              </Button>
            </div>
            <div className="bg-card rounded-2xl shadow-card overflow-hidden">
              <div className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="w-full flex items-center gap-2 sm:flex-1">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search vehicles..."
                      value={allVehiclesSearchQuery}
                      onChange={(e) => setAllVehiclesSearchQuery(e.target.value)}
                    />
                  </div>
                  <Select value={selectedBrandFilter} onValueChange={setSelectedBrandFilter}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Filter by Brand" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Brands</SelectItem>
                      {Array.from(
                        new Set(filteredBikes.map((b) => (b.brand || '').trim() || 'Unbranded'))
                      )
                        .sort()
                        .map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 p-3 sm:p-4">
                {filteredBikes
                  .filter((bike) => {
                    const matchesSearch =
                      allVehiclesSearchQuery === '' ||
                      bike.name.toLowerCase().includes(allVehiclesSearchQuery.toLowerCase()) ||
                      (bike.brand &&
                        bike.brand.toLowerCase().includes(allVehiclesSearchQuery.toLowerCase())) ||
                      (bike.year &&
                        String(bike.year)
                          .toLowerCase()
                          .includes(allVehiclesSearchQuery.toLowerCase()));
                    const matchesBrand =
                      selectedBrandFilter === 'all' ||
                      ((bike.brand || '').trim() || 'Unbranded') === selectedBrandFilter;
                    return matchesSearch && matchesBrand;
                  })
                  .map((bike) => (
                    <div
                      key={bike.id}
                      className="border rounded-lg p-2 sm:p-3 flex flex-col bg-card h-full min-w-0"
                    >
                      {bike.image && (
                        <div className="relative mb-2 h-32 sm:h-40 md:h-48 bg-muted rounded-md overflow-hidden flex items-center justify-center flex-shrink-0">
                          <img
                            src={bike.image}
                            alt={bike.name}
                            className="max-w-full max-h-full object-contain rounded-md"
                            style={{ imageRendering: 'auto' as const }}
                          />
                          <Badge variant="secondary" className="absolute top-2 right-2 text-xs">
                            {bike.type}
                          </Badge>
                        </div>
                      )}
                      {!bike.image && (
                        <div className="relative mb-2 bg-muted rounded-md h-32 sm:h-40 md:h-48 flex items-center justify-center flex-shrink-0">
                          <Badge variant="secondary" className="absolute top-2 right-2 text-xs">
                            {bike.type}
                          </Badge>
                          <Bike className="h-12 w-12 text-muted-foreground/50" />
                        </div>
                      )}
                      <div className="flex-1 flex flex-col min-w-0">
                        <p className="font-medium mb-1 whitespace-normal">{bike.name}</p>
                        {(bike.brand || bike.year) && (
                          <p className="text-xs text-muted-foreground mb-2 truncate">
                            {[
                              bike.brand ? `Brand: ${bike.brand}` : '',
                              bike.year ? `Year: ${bike.year}` : '',
                            ]
                              .filter(Boolean)
                              .join(' • ')}
                          </p>
                        )}
                        <div className="mt-auto flex items-center justify-between pt-2 gap-2">
                          <p className="text-sm font-semibold text-foreground whitespace-nowrap">
                            ₹
                            {bike.weekdayRate ||
                              bike.pricePerHour ||
                              Math.round((bike.price12Hours || 0) / 12)}
                            /hr
                          </p>
                          <div className="flex gap-1 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => {
                                setEditingBike(bike);
                                setBikeFormErrors({});
                                setBikeForm({
                                  name: bike.name,
                                  brand: bike.brand || '',
                                  year: bike.year ? String(bike.year) : '',
                                  type: bike.type,
                                  category: bike.category || 'midrange',
                                  pricePerHour: String(bike.pricePerHour),
                                  kmLimit: String(bike.kmLimit),
                                  locationId: bike.locationId,
                                  image: bike.image || '',
                                  images:
                                    bike.images && bike.images.length > 0
                                      ? [...bike.images, '', '', ''].slice(0, 3)
                                      : ['', '', ''],
                                  weekdayRate: bike.weekdayRate ? String(bike.weekdayRate) : '',
                                  weekendRate: bike.weekendRate ? String(bike.weekendRate) : '',
                                  excessKmCharge: bike.excessKmCharge
                                    ? String(bike.excessKmCharge)
                                    : '',
                                  kmLimitPerHour: bike.kmLimitPerHour
                                    ? String(bike.kmLimitPerHour)
                                    : '',
                                  minBookingHours: bike.minBookingHours
                                    ? String(bike.minBookingHours)
                                    : '',
                                  gstPercentage:
                                    bike.gstPercentage !== undefined && bike.gstPercentage !== null
                                      ? String(bike.gstPercentage)
                                      : '18',
                                });
                                setBikeDialogOpen(true);
                              }}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 px-2 text-xs"
                              onClick={async () => {
                                try {
                                  await bikesAPI.delete(bike.id);
                                  toast({ title: 'Vehicle deleted' });
                                  loadData();
                                } catch (e: any) {
                                  toast({
                                    title: 'Error',
                                    description: e.message || 'Failed to delete vehicle',
                                    variant: 'destructive',
                                  });
                                }
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="bg-card rounded-2xl shadow-card p-6">
              <h2 className="font-display font-semibold text-lg mb-4">Hero Carousel Images</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Manage images for the home page slider. These images will take precedence over the
                static background image above.
              </p>
              <HeroImageManager />
            </div>
          </div>
        )}

        {activeTab === 'admins' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-display font-bold mb-2">Admins</h1>
                <p className="text-muted-foreground">Create and manage admin accounts.</p>
              </div>
              <Button
                className="w-full sm:w-auto"
                onClick={() => {
                  setNewAdminForm({
                    name: '',
                    email: '',
                    password: '',
                    confirmPassword: '',
                    locationId: '',
                  });
                  setNewAdminCity('');
                  setNewAdminOtherCity('');
                  setCreateAdminOpen(true);
                }}
              >
                Create Admin
              </Button>
            </div>
            <div className="bg-card rounded-2xl shadow-card overflow-hidden">
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-6 py-4 font-medium whitespace-nowrap">Name</th>
                      <th className="text-left px-6 py-4 font-medium whitespace-nowrap">Email</th>
                      <th className="text-left px-6 py-4 font-medium whitespace-nowrap">City</th>
                      <th className="text-left px-6 py-4 font-medium whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {adminsForLocation.map((u) => {
                      const userLocationId = getUserLocationId(u);
                      const loc = locations.find((l) => l.id === userLocationId);
                      return (
                        <tr key={u.id}>
                          <td className="px-6 py-4 whitespace-nowrap">{u.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{u.email}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {loc ? formatLocationDisplay(loc) : '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingAdmin(u);
                                  setEditAdminForm({
                                    name: u.name || '',
                                    email: u.email || '',
                                    password: '',
                                    confirmPassword: '',
                                    locationId: userLocationId || '',
                                  });
                                  setEditAdminOtherCity('');
                                  setEditAdminOpen(true);
                                }}
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={async () => {
                                  const ok = window.confirm(
                                    'Delete this admin? This cannot be undone.'
                                  );
                                  if (!ok) return;
                                  try {
                                    await usersAPI.delete(u.id);
                                    toast({ title: 'Admin deleted' });
                                    loadData();
                                  } catch (e: any) {
                                    toast({
                                      title: 'Error',
                                      description: e.message || 'Failed to delete admin',
                                      variant: 'destructive',
                                    });
                                  }
                                }}
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <Dialog open={createAdminOpen} onOpenChange={setCreateAdminOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Admin</DialogTitle>
                  <DialogDescription>Provision a new admin account.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <Input
                    placeholder="Full Name"
                    value={newAdminForm.name}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^[a-zA-Z\s]*$/.test(value) && value.length <= 50) {
                        setNewAdminForm({ ...newAdminForm, name: value });
                      }
                    }}
                    maxLength={50}
                  />
                  <Input
                    placeholder="Email"
                    value={newAdminForm.email}
                    onChange={(e) =>
                      setNewAdminForm({
                        ...newAdminForm,
                        email: e.target.value.toLowerCase().trim(),
                      })
                    }
                    maxLength={100}
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={newAdminForm.password}
                    onChange={(e) => setNewAdminForm({ ...newAdminForm, password: e.target.value })}
                  />
                  <Input
                    type="password"
                    placeholder="Confirm Password"
                    value={newAdminForm.confirmPassword}
                    onChange={(e) =>
                      setNewAdminForm({ ...newAdminForm, confirmPassword: e.target.value })
                    }
                  />
                  <Select
                    value={newAdminCity}
                    onValueChange={(v) => {
                      setNewAdminCity(v);
                      setNewAdminOtherCity('');
                      setNewAdminForm((prev) => ({ ...prev, locationId: '' }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="City" />
                    </SelectTrigger>
                    <SelectContent>
                      {cityOptions.map((city) => (
                        <SelectItem
                          key={city as string}
                          value={city as string}
                          disabled={adminCitySet.has(String(city).toLowerCase())}
                        >
                          {city as string}
                        </SelectItem>
                      ))}
                      <SelectItem value="__other__">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {newAdminCity === '__other__' ? (
                    <Input
                      placeholder="New City"
                      value={newAdminOtherCity}
                      onChange={(e) => setNewAdminOtherCity(e.target.value)}
                    />
                  ) : (
                    <Select
                      value={newAdminForm.locationId}
                      onValueChange={(v) => setNewAdminForm({ ...newAdminForm, locationId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Garage" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations
                          .filter(
                            (loc) =>
                              String(loc.city || '').toLowerCase() ===
                              String(newAdminCity || '').toLowerCase()
                          )
                          .map((loc) => (
                            <SelectItem key={loc.id} value={loc.id}>
                              {formatLocationDisplay(loc)}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                  <div className="flex gap-2">
                    <Button
                      onClick={async () => {
                        try {
                          const missingFields = [];
                          if (!newAdminForm.name) missingFields.push('name');
                          if (!newAdminForm.email) missingFields.push('email');
                          if (!newAdminForm.password) missingFields.push('password');

                          if (missingFields.length > 0) {
                            const message =
                              missingFields
                                .map((f) => f.charAt(0).toUpperCase() + f.slice(1))
                                .join(', ') +
                              (missingFields.length > 1 ? ' are required' : ' is required');
                            toast({ title: 'Error', description: message, variant: 'destructive' });
                            return;
                          }

                          // If all filled, validate format/strength
                          const nameError = validateName(newAdminForm.name);
                          if (nameError) {
                            toast({
                              title: 'Validation Error',
                              description: nameError,
                              variant: 'destructive',
                            });
                            return;
                          }

                          const emailError = validateEmail(newAdminForm.email);
                          if (emailError) {
                            toast({
                              title: 'Validation Error',
                              description: emailError,
                              variant: 'destructive',
                            });
                            return;
                          }

                          const passwordError = validatePassword(newAdminForm.password);
                          if (passwordError) {
                            toast({
                              title: 'Validation Error',
                              description: passwordError,
                              variant: 'destructive',
                            });
                            return;
                          }

                          if (newAdminForm.password !== newAdminForm.confirmPassword) {
                            toast({
                              title: 'Validation Error',
                              description: 'Passwords do not match',
                              variant: 'destructive',
                            });
                            return;
                          }
                          const targetCityRaw =
                            newAdminCity === '__other__'
                              ? newAdminOtherCity.trim()
                              : String(newAdminCity || '').trim();
                          if (!targetCityRaw) throw new Error('City is required');
                          const targetCity = targetCityRaw.toLowerCase();
                          if (adminCitySet.has(targetCity)) {
                            throw new Error('An admin already exists for this city');
                          }
                          let locationId = newAdminForm.locationId;
                          if (newAdminCity === '__other__') {
                            const city = newAdminOtherCity.trim();
                            const existingCityLocation = locations.find(
                              (l) => String(l.city || '').toLowerCase() === city.toLowerCase()
                            );
                            if (existingCityLocation?.id) {
                              locationId = existingCityLocation.id;
                            } else {
                              const locationName = city;
                              const createdLocation = await locationsAPI.create({
                                name: locationName,
                                city,
                                state: city,
                                country: 'India',
                              });
                              locationId = createdLocation?.id;
                            }
                            if (!locationId) throw new Error('Failed to create city');
                          }
                          if (!locationId) throw new Error('City/Garage is required');
                          await usersAPI.createAdmin({
                            name: newAdminForm.name,
                            email: newAdminForm.email,
                            password: newAdminForm.password,
                            locationId,
                          });
                          localStorage.setItem(LAST_ADMIN_CITY_STORAGE_KEY, targetCityRaw);
                          toast({
                            title: 'Admin Created',
                            description: 'New admin has been created',
                          });
                          setCreateAdminOpen(false);
                          setNewAdminCity('');
                          setNewAdminOtherCity('');
                          loadData();
                        } catch (e: any) {
                          toast({
                            title: 'Error',
                            description: e.message || 'Failed to create admin',
                            variant: 'destructive',
                          });
                        }
                      }}
                    >
                      Create
                    </Button>
                    <Button variant="outline" onClick={() => setCreateAdminOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog
              open={editAdminOpen}
              onOpenChange={(open) => {
                setEditAdminOpen(open);
                if (!open) {
                  setEditingAdmin(null);
                  // Reset form when dialog closes
                  setEditAdminForm({
                    name: '',
                    email: '',
                    password: '',
                    confirmPassword: '',
                    locationId: '',
                  });
                }
              }}
            >
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Edit Admin</DialogTitle>
                  <DialogDescription>Update admin account details.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <Input
                    placeholder="Full Name"
                    value={editAdminForm.name}
                    onChange={(e) => setEditAdminForm({ ...editAdminForm, name: e.target.value })}
                  />
                  <Input
                    placeholder="Email"
                    value={editAdminForm.email}
                    onChange={(e) =>
                      setEditAdminForm({
                        ...editAdminForm,
                        email: e.target.value.toLowerCase().trim(),
                      })
                    }
                    maxLength={100}
                  />
                  <Input
                    type="password"
                    placeholder="New Password"
                    value={editAdminForm.password}
                    onChange={(e) =>
                      setEditAdminForm({ ...editAdminForm, password: e.target.value })
                    }
                  />
                  {editAdminForm.password && (
                    <Input
                      type="password"
                      placeholder="Confirm Password"
                      value={editAdminForm.confirmPassword}
                      onChange={(e) =>
                        setEditAdminForm({ ...editAdminForm, confirmPassword: e.target.value })
                      }
                    />
                  )}
                  <Select
                    value={editAdminForm.locationId}
                    onValueChange={(v) => {
                      setEditAdminForm({ ...editAdminForm, locationId: v });
                      if (v !== '__other__') {
                        setEditAdminOtherCity('');
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Assign City/Garage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__other__">Other (Add new location)</SelectItem>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {formatLocationDisplay(loc)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editAdminForm.locationId === '__other__' && (
                    <Input
                      placeholder="New City / Location"
                      value={editAdminOtherCity}
                      onChange={(e) => setEditAdminOtherCity(e.target.value)}
                    />
                  )}
                  <div className="flex gap-2">
                    <Button
                      onClick={async () => {
                        if (!editingAdmin) return;
                        try {
                          const missingFields = [];
                          if (!editAdminForm.name) missingFields.push('name');
                          if (!editAdminForm.email) missingFields.push('email');

                          if (missingFields.length > 0) {
                            const message =
                              missingFields
                                .map((f) => f.charAt(0).toUpperCase() + f.slice(1))
                                .join(', ') +
                              (missingFields.length > 1 ? ' are required' : ' is required');
                            toast({ title: 'Error', description: message, variant: 'destructive' });
                            return;
                          }

                          const nameError = validateName(editAdminForm.name);
                          if (nameError) {
                            toast({
                              title: 'Validation Error',
                              description: nameError,
                              variant: 'destructive',
                            });
                            return;
                          }

                          const emailError = validateEmail(editAdminForm.email);
                          if (emailError) {
                            toast({
                              title: 'Validation Error',
                              description: emailError,
                              variant: 'destructive',
                            });
                            return;
                          }
                          let locationId = editAdminForm.locationId;

                          // Handle new location creation when "Other" is selected
                          if (locationId === '__other__') {
                            const cityRaw = editAdminOtherCity.trim();
                            if (!cityRaw) {
                              toast({
                                title: 'Error',
                                description: 'Please enter a city/location name',
                                variant: 'destructive',
                              });
                              return;
                            }
                            const cityLower = cityRaw.toLowerCase();
                            const existingLocation =
                              locations.find(
                                (l) => String(l.city || '').toLowerCase() === cityLower
                              ) ||
                              locations.find(
                                (l) => String(l.name || '').toLowerCase() === cityLower
                              );

                            if (existingLocation?.id) {
                              locationId = existingLocation.id;
                            } else {
                              const createdLocation = await locationsAPI.create({
                                name: cityRaw,
                                city: cityRaw,
                                state: cityRaw,
                                country: 'India',
                              });
                              locationId = createdLocation?.id;
                            }

                            if (!locationId) {
                              toast({
                                title: 'Error',
                                description: 'Failed to create location',
                                variant: 'destructive',
                              });
                              return;
                            }
                          }

                          if (!locationId) {
                            toast({
                              title: 'Error',
                              description: 'City/Garage is required',
                              variant: 'destructive',
                            });
                            return;
                          }

                          const payload: any = {
                            name: editAdminForm.name,
                            email: editAdminForm.email,
                            locationId,
                          };

                          // If password is provided, validate it
                          if (editAdminForm.password && editAdminForm.password.trim()) {
                            const passwordError = validatePassword(editAdminForm.password);
                            if (passwordError) {
                              toast({
                                title: 'Validation Error',
                                description: passwordError,
                                variant: 'destructive',
                              });
                              return;
                            }
                            if (editAdminForm.password !== editAdminForm.confirmPassword) {
                              toast({
                                title: 'Validation Error',
                                description: 'Passwords do not match',
                                variant: 'destructive',
                              });
                              return;
                            }
                            payload.password = editAdminForm.password.trim();
                          }

                          await usersAPI.update(editingAdmin.id, payload);
                          toast({
                            title: 'Admin updated',
                            description: payload.password
                              ? 'Password has been updated successfully'
                              : 'Admin details updated successfully',
                          });
                          setEditAdminOpen(false);
                          setEditingAdmin(null);
                          // Reset form after successful update
                          setEditAdminForm({
                            name: '',
                            email: '',
                            password: '',
                            confirmPassword: '',
                            locationId: '',
                          });
                          setEditAdminOtherCity('');
                          loadData();
                        } catch (e: any) {
                          toast({
                            title: 'Error',
                            description: e.message || 'Failed to update admin',
                            variant: 'destructive',
                          });
                        }
                      }}
                    >
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditAdminOpen(false);
                        setEditingAdmin(null);
                        // Reset form when canceling
                        setEditAdminForm({
                          name: '',
                          email: '',
                          password: '',
                          confirmPassword: '',
                          locationId: '',
                        });
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {activeTab === 'bookings' &&
          (() => {
            const filteredRentalsList =
              bookingSearchQuery.trim() === ''
                ? filteredRentals
                : filteredRentals.filter((r) => {
                    const bike =
                      filteredBikes.find((b) => b.id === r.bikeId) ||
                      bikes.find((b) => b.id === r.bikeId);
                    const user =
                      filteredUsers.find((u) => u.id === r.userId) ||
                      users.find((u) => u.id === r.userId);
                    const searchLower = bookingSearchQuery.toLowerCase();
                    const searchId = searchLower.startsWith('#')
                      ? searchLower.slice(1)
                      : searchLower;

                    return (
                      r.id.toLowerCase().includes(searchId) ||
                      (bike?.name || '').toLowerCase().includes(searchLower) ||
                      (user?.name || '').toLowerCase().includes(searchLower) ||
                      (user?.email || '').toLowerCase().includes(searchLower) ||
                      r.status.toLowerCase().includes(searchLower)
                    );
                  });

            return (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-display font-bold mb-2">All Bookings</h1>
                  <p className="text-muted-foreground">Oversight across all cities.</p>
                </div>

                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder="Search bookings..."
                    className="pl-10"
                    value={bookingSearchQuery}
                    onChange={(e) => setBookingSearchQuery(e.target.value)}
                  />
                </div>

                <div className="bg-card rounded-2xl shadow-card border border-border">
                  {/* Top scrollbar synced with bottom */}
                  <div
                    ref={topScrollRef}
                    className="w-full overflow-x-auto h-5 bg-muted/30 border-b border-border"
                    onScroll={() => handleScroll('top')}
                  >
                    <div className="min-w-[1200px] h-1" />
                  </div>

                  <div
                    ref={bottomScrollRef}
                    className="w-full overflow-x-auto max-h-[70vh] overflow-y-auto"
                    onScroll={() => handleScroll('bottom')}
                  >
                    <table className="w-full min-w-[1200px] border-separate border-spacing-0">
                      <thead className="bg-muted sticky top-0 z-20">
                        <tr>
                          <th className="text-left px-6 py-4 font-medium whitespace-nowrap border-b border-border">
                            Booking
                          </th>
                          <th className="text-left px-6 py-4 font-medium whitespace-nowrap border-b border-border">
                            Bike
                          </th>
                          <th className="text-left px-6 py-4 font-medium whitespace-nowrap border-b border-border">
                            User
                          </th>
                          <th className="text-left px-6 py-4 font-medium whitespace-nowrap border-b border-border">
                            Start
                          </th>
                          <th className="text-left px-6 py-4 font-medium whitespace-nowrap border-b border-border">End</th>
                          <th className="text-left px-6 py-4 font-medium whitespace-nowrap border-b border-border">
                            Status
                          </th>
                          <th className="text-left px-6 py-4 font-medium whitespace-nowrap border-b border-border">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredRentalsList.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-12 text-center">
                              <div className="flex flex-col items-center justify-center">
                                <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
                                <p className="text-lg font-medium text-muted-foreground mb-2">
                                  {bookingSearchQuery.trim()
                                    ? 'No bookings match your search'
                                    : 'No bookings found'}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {bookingSearchQuery.trim()
                                    ? 'Try adjusting your search terms.'
                                    : selectedLocationFilter === 'all'
                                      ? 'There are no bookings yet.'
                                      : `There are no bookings for ${formatLocationDisplay(locations.find((loc) => loc.id === selectedLocationFilter)) || 'this location'} yet.`}
                                </p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredRentalsList.map((r) => {
                            const bike =
                              filteredBikes.find((b) => b.id === r.bikeId) ||
                              bikes.find((b) => b.id === r.bikeId);
                            const user =
                              filteredUsers.find((u) => u.id === r.userId) ||
                              users.find((u) => u.id === r.userId);
                            return (
                              <tr key={r.id} className="hover:bg-muted/30">
                                <td className="px-6 py-4 whitespace-nowrap border-b border-border">#{r.id.slice(0, 8)}</td>
                                <td className="px-6 py-4 whitespace-nowrap border-b border-border">
                                  {bike?.name || r.bikeId}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap border-b border-border">
                                  {user?.name || r.userId}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap border-b border-border">
                                  {new Date(r.startTime).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap border-b border-border">
                                  {r.endTime ? new Date(r.endTime).toLocaleString() : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap border-b border-border">
                                  <Badge
                                    className={
                                      statusStyles[r.status as keyof typeof statusStyles]?.color ||
                                      'bg-muted'
                                    }
                                  >
                                    {r.status}
                                  </Badge>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap border-b border-border">
                                  <div className="flex gap-2">
                                    {r.status === 'active' && (
                                      <Button
                                        size="sm"
                                        onClick={async () => {
                                          try {
                                            await rentalsAPI.end(r.id);
                                            toast({ title: 'Ride Closed' });
                                            loadData();
                                          } catch (e: any) {
                                            toast({
                                              title: 'Error',
                                              description: e.message,
                                              variant: 'destructive',
                                            });
                                          }
                                        }}
                                      >
                                        Force Close
                                      </Button>
                                    )}
                                    {r.status !== 'completed' && r.status !== 'cancelled' && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={async () => {
                                          try {
                                            await rentalsAPI.cancel(r.id);
                                            toast({ title: 'Booking Cancelled' });
                                            loadData();
                                          } catch (e: any) {
                                            toast({
                                              title: 'Error',
                                              description: e.message,
                                              variant: 'destructive',
                                            });
                                          }
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

        {/* Reuse Admin tabs for bikes/users/documents/locations */}

        {activeTab === 'users' && (
          <div className="bg-card rounded-2xl shadow-card overflow-hidden">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
              <table className="w-full border-separate border-spacing-0">
                <thead className="bg-muted sticky top-0 z-20">
                  <tr>
                    <th className="text-left px-6 py-4 font-medium border-b border-border">User</th>
                    <th className="text-left px-6 py-4 font-medium border-b border-border">Role</th>
                    <th className="text-left px-6 py-4 font-medium border-b border-border">Joined</th>
                    <th className="text-left px-6 py-4 font-medium border-b border-border">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-muted/30">
                      <td className="px-6 py-4 border-b border-border">
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 border-b border-border">
                        <Badge
                          variant={
                            user.role === 'admin'
                              ? 'default'
                              : user.role === 'superadmin'
                                ? 'destructive'
                                : 'secondary'
                          }
                        >
                          {user.role}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground border-b border-border">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 border-b border-border">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewUserDocuments(user.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  {users.length === 0
                    ? 'No users found in the system.'
                    : 'No users match your search.'}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-display font-bold mb-2">All Documents</h1>
              <p className="text-muted-foreground">
                Review and approve user-submitted documents grouped by user.
              </p>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
              <div className="relative max-w-md w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search users or document type..."
                  className="pl-10 w-full"
                  value={documentsSearchQuery}
                  onChange={(e) => setDocumentsSearchQuery(e.target.value)}
                />
              </div>
              <Select value={documentsSort} onValueChange={(v: any) => setDocumentsSort(v)}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Sort by Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4">
              {(() => {
                // Get unique users who have documents
                const userIdsWithDocs = new Set(filteredDocuments.map((d) => d.userId));
                const usersWithDocs = users.filter((u) => userIdsWithDocs.has(u.id));

                const docsByUserId = new Map<string, any[]>();
                for (const doc of filteredDocuments) {
                  const userId = doc?.userId;
                  if (!userId) continue;
                  const list = docsByUserId.get(userId) || [];
                  list.push(doc);
                  docsByUserId.set(userId, list);
                }

                const query = documentsSearchQuery.trim().toLowerCase();
                const filteredUsersWithDocs = query
                  ? usersWithDocs.filter((u) => {
                      const userMatch =
                        String(u?.name || '')
                          .toLowerCase()
                          .includes(query) ||
                        String(u?.email || '')
                          .toLowerCase()
                          .includes(query) ||
                        String(u?.mobile || '')
                          .toLowerCase()
                          .includes(query);

                      if (userMatch) return true;

                      const userDocs = docsByUserId.get(u.id) || [];
                      return userDocs.some((d) => {
                        return (
                          String(d?.type || '')
                            .toLowerCase()
                            .includes(query) ||
                          String(d?.name || '')
                            .toLowerCase()
                            .includes(query)
                        );
                      });
                    })
                  : usersWithDocs;

                const latestDocTime = (userId: string) => {
                  const userDocs = docsByUserId.get(userId) || [];
                  let latest = 0;
                  for (const d of userDocs) {
                    const raw = d?.uploadedAt || d?.createdAt;
                    const t = raw ? new Date(raw).getTime() : 0;
                    if (t > latest) latest = t;
                  }
                  return latest;
                };

                const sortedUsersWithDocs = [...filteredUsersWithDocs].sort((a, b) => {
                  const timeA = latestDocTime(a.id);
                  const timeB = latestDocTime(b.id);
                  return documentsSort === 'newest' ? timeB - timeA : timeA - timeB;
                });

                if (sortedUsersWithDocs.length === 0) {
                  return (
                    <div className="col-span-full text-center py-12">
                      <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                      <p className="text-lg font-medium text-muted-foreground mb-2">
                        No users with documents found
                      </p>
                      <p className="text-sm text-muted-foreground">There are no documents yet.</p>
                    </div>
                  );
                }

                return sortedUsersWithDocs
                  .map((user) => {
                    const userDocs = docsByUserId.get(user.id) || [];
                    if (userDocs.length === 0) return null;

                    const pendingCount = userDocs.filter((d) => d.status === 'pending').length;
                    const approvedCount = userDocs.filter((d) => d.status === 'approved').length;
                    const rejectedCount = userDocs.filter((d) => d.status === 'rejected').length;

                    return (
                      <div key={user.id} className="bg-card rounded-2xl shadow-card p-4 md:p-6">
                        <div className="flex flex-col sm:flex-row items-start justify-between mb-4 gap-4">
                          <div className="flex items-center gap-4 w-full">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Users className="h-6 w-6 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-lg truncate">{user.name}</p>
                              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                              <p className="text-sm text-muted-foreground">{user.mobile || '-'}</p>
                              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                                <p className="text-sm">
                                  <span className="text-muted-foreground">Emergency Contact: </span>
                                  <span className="text-foreground">
                                    {user.emergencyContact || '-'}
                                  </span>
                                </p>
                                <p className="text-sm">
                                  <span className="text-muted-foreground">Family Contact: </span>
                                  <span className="text-foreground">
                                    {user.familyContact || '-'}
                                  </span>
                                </p>
                                <p className="text-sm md:col-span-2">
                                  <span className="text-muted-foreground">Permanent Address: </span>
                                  <span className="text-foreground">
                                    {user.permanentAddress || '-'}
                                  </span>
                                </p>
                                <p className="text-sm">
                                  <span className="text-muted-foreground">Current Location: </span>
                                  <span className="text-foreground">
                                    {user.currentAddress || '-'}
                                  </span>
                                </p>
                                <p className="text-sm">
                                  <span className="text-muted-foreground">Hotel Stay: </span>
                                  <span className="text-foreground">{user.hotelStay || '-'}</span>
                                </p>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full sm:w-auto shrink-0"
                            onClick={() => handleViewUserDocuments(user.id)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Documents
                          </Button>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-4">
                          <Badge variant="outline" className="bg-primary/10">
                            Total: {userDocs.length}
                          </Badge>
                          {pendingCount > 0 && (
                            <Badge className="bg-primary/10 text-primary">
                              Pending: {pendingCount}
                            </Badge>
                          )}
                          {approvedCount > 0 && (
                            <Badge className="bg-accent/10 text-accent">
                              Approved: {approvedCount}
                            </Badge>
                          )}
                          {rejectedCount > 0 && (
                            <Badge className="bg-destructive/10 text-destructive">
                              Rejected: {rejectedCount}
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {userDocs.map((doc) => {
                            const StatusIcon =
                              statusStyles[doc.status as keyof typeof statusStyles].icon;
                            return (
                              <div
                                key={doc.id}
                                className="border rounded-lg p-2 sm:p-3 bg-muted/30"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                  <Badge
                                    className={
                                      statusStyles[doc.status as keyof typeof statusStyles].color
                                    }
                                    variant="outline"
                                  >
                                    <StatusIcon className="h-3 w-3 mr-1" />
                                    {doc.status}
                                  </Badge>
                                </div>
                                <p className="text-xs font-medium mb-1 truncate">
                                  {doc.type.replace('_', ' ')}
                                </p>
                                <p className="text-xs text-muted-foreground mb-2 truncate">
                                  {doc.name}
                                </p>
                                {doc.status === 'rejected' && doc.rejectionReason && (
                                  <div
                                    className="mb-2 px-1 py-0.5 bg-destructive/5 border border-destructive/10 rounded text-[9px] text-destructive italic truncate"
                                    title={doc.rejectionReason}
                                  >
                                    Reason: {doc.rejectionReason}
                                  </div>
                                )}
                                {/* Document Preview */}
                                <div
                                  className="mb-2 border rounded overflow-hidden bg-background cursor-pointer hover:bg-muted/50 transition-colors"
                                  onClick={() => {
                                    if (doc.url) {
                                      setPreviewImageUrl(doc.url);
                                      setIsPreviewModalOpen(true);
                                    }
                                  }}
                                >
                                  <img
                                    src={doc.url}
                                    alt={doc.name}
                                    className="w-full h-24 sm:h-32 object-contain"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                </div>
                                <div className="flex gap-2 justify-center mt-2">
                                  {doc.status !== 'rejected' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-[10px] text-destructive hover:text-destructive flex-1"
                                      onClick={() =>
                                        handleDocumentAction(doc.id || doc._id, 'reject')
                                      }
                                    >
                                      <XCircle className="h-3 w-3 mr-1" />
                                      Reject
                                    </Button>
                                  )}
                                  {doc.status !== 'approved' && (
                                    <Button
                                      size="sm"
                                      className="h-7 px-2 text-[10px] bg-accent hover:bg-accent/90 flex-1"
                                      onClick={() =>
                                        handleDocumentAction(doc.id || doc._id, 'approve')
                                      }
                                    >
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Approve
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                  .filter(Boolean);
              })()}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-display font-bold mb-2">Settings</h1>
              <p className="text-muted-foreground">Manage application settings and preferences.</p>
            </div>

            <div className="bg-card rounded-2xl shadow-card p-6">
              <h2 className="font-display font-semibold text-lg mb-4">Background Images</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Manage images for the home page background. If multiple images are active, they will
                display as a slider. If only one image is active, it will be a static background.
              </p>
              <HeroImageManager />
            </div>
          </div>
        )}

        {activeTab === 'locations' && (
          <div className="bg-card rounded-2xl shadow-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-semibold text-lg">Locations</h2>
              <Button
                onClick={() => {
                  setEditingLocation(null);
                  setLocationForm({ name: '', city: '', state: '', country: 'India' });
                  setLocationDialogOpen(true);
                }}
                className="w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Location
              </Button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {locations.map((loc) => (
                <div key={loc.id} className="border rounded-lg p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-display font-semibold text-lg">{loc.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {loc.city}, {loc.state}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => {
                          setEditingLocation(loc);
                          setLocationForm({
                            name: loc.name,
                            city: loc.city,
                            state: loc.state,
                            country: loc.country || 'India',
                          });
                          setLocationDialogOpen(true);
                        }}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="w-full sm:w-auto"
                        onClick={async () => {
                          if (
                            window.confirm(
                              `Are you sure you want to delete "${formatLocationDisplay(loc)}"?`
                            )
                          ) {
                            try {
                              await locationsAPI.delete(loc.id);
                              toast({ title: 'Location deleted' });
                              loadData();
                            } catch (e: any) {
                              toast({
                                title: 'Error',
                                description: e.message || 'Failed to delete location',
                                variant: 'destructive',
                              });
                            }
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingLocation ? 'Edit Location' : 'Add Location'}</DialogTitle>
                  <DialogDescription>
                    {editingLocation ? 'Update location details' : 'Enter new location details'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Location Name (e.g. Ameerpet)</Label>
                    <Input
                      placeholder="Location Name"
                      value={locationForm.name}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || /^[a-zA-Z\s]*$/.test(value)) {
                          setLocationForm({ ...locationForm, name: value });
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">State</Label>
                    <Select
                      value={locationForm.state}
                      onValueChange={(v) => {
                        setLocationForm({ ...locationForm, state: v, city: '' });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select State" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(STATE_CITY_DATA)
                          .sort()
                          .map((state) => (
                            <SelectItem key={state} value={state}>
                              {state}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">City</Label>
                    <Select
                      value={locationForm.city}
                      onValueChange={(v) => setLocationForm({ ...locationForm, city: v })}
                      disabled={!locationForm.state}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select City" />
                      </SelectTrigger>
                      <SelectContent>
                        {(STATE_CITY_DATA[locationForm.state] || []).map((city) => (
                          <SelectItem key={city} value={city}>
                            {city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button
                      className="flex-1"
                      onClick={async () => {
                        if (!locationForm.name.trim() || !locationForm.city.trim() || !locationForm.state.trim()) {
                          toast({
                            title: 'Error',
                            description: 'All fields (Name, City, State) are required',
                            variant: 'destructive',
                          });
                          return;
                        }

                        const finalForm = {
                          ...locationForm,
                          name: locationForm.name.trim(),
                          city: locationForm.city.trim(),
                          state: locationForm.state.trim(),
                        };

                        try {
                          if (editingLocation) {
                            // Check for duplicates when editing (excluding current)
                            const exists = locations.some(
                              (l) =>
                                l.id !== editingLocation.id &&
                                l.name.toLowerCase() === finalForm.name.toLowerCase() &&
                                l.city.toLowerCase() === finalForm.city.toLowerCase() &&
                                l.state.toLowerCase() === finalForm.state.toLowerCase()
                            );
                            if (exists) {
                              toast({
                                title: 'Error',
                                description: 'A location with this name, city, and state already exists',
                                variant: 'destructive',
                              });
                              return;
                            }
                            await locationsAPI.update(editingLocation.id, finalForm);
                            toast({ title: 'Location updated successfully' });
                          } else {
                            // Frontend check for duplicates
                            const exists = locations.some(
                              (l) =>
                                l.name.toLowerCase() === finalForm.name.toLowerCase() &&
                                l.city.toLowerCase() === finalForm.city.toLowerCase() &&
                                l.state.toLowerCase() === finalForm.state.toLowerCase()
                            );
                            if (exists) {
                              toast({
                                title: 'Error',
                                description: 'A location with this name, city, and state already exists',
                                variant: 'destructive',
                              });
                              return;
                            }
                            await locationsAPI.create(finalForm);
                            toast({ title: 'Location created successfully' });
                          }
                          setLocationDialogOpen(false);
                          setEditingLocation(null);
                          loadData();
                        } catch (e: any) {
                          toast({
                            title: 'Error',
                            description: e.message || 'Failed to save location',
                            variant: 'destructive',
                          });
                        }
                      }}
                    >
                      {editingLocation ? 'Save Changes' : 'Add Location'}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setLocationDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </main>
      <Dialog open={bikeDialogOpen} onOpenChange={setBikeDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBike ? 'Edit Bike' : 'Add Bike'}</DialogTitle>
            <DialogDescription>Enter bike details</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className={bikeFormErrors.brand ? 'text-destructive' : ''}>Brand</Label>
                <Select
                  value={bikeForm.brand}
                  onValueChange={(v) => {
                    const modelsForBrand = bikeSpecs.find((s) => s.brand === v)?.models || [];
                    const isModelValid = modelsForBrand.includes(bikeForm.name);
                    setBikeForm({
                      ...bikeForm,
                      brand: v,
                      name: isModelValid ? bikeForm.name : '',
                    });
                    setBikeFormErrors((prev) => {
                      const { brand: _, name: __, ...rest } = prev;
                      return rest;
                    });
                  }}
                >
                  <SelectTrigger className={bikeFormErrors.brand ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select Brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {bikeSpecs.map((spec) => (
                      <SelectItem key={spec.brand} value={spec.brand}>
                        {spec.brand}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {bikeFormErrors.brand && (
                  <p className="text-[10px] text-destructive">{bikeFormErrors.brand}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className={bikeFormErrors.name ? 'text-destructive' : ''}>
                  Vehicle Name
                </Label>
                <Select
                  value={bikeForm.name}
                  onValueChange={(v) => {
                    const correctBrand = getBrandForModel(v);
                    if (correctBrand) {
                      setBikeForm({ ...bikeForm, name: v, brand: correctBrand });
                    } else {
                      setBikeForm({ ...bikeForm, name: v });
                    }
                    setBikeFormErrors((prev) => {
                      const { name: _, brand: __, ...rest } = prev;
                      return rest;
                    });
                  }}
                >
                  <SelectTrigger className={bikeFormErrors.name ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select Vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {bikeForm.brand
                      ? (bikeSpecs.find((s) => s.brand === bikeForm.brand)?.models || []).map(
                          (model: string) => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          )
                        )
                      : bikeSpecs
                          .flatMap((s) => s.models)
                          .filter((value, index, self) => self.indexOf(value) === index) // Unique models
                          .sort()
                          .map((model: string) => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          ))}
                  </SelectContent>
                </Select>
                {bikeFormErrors.name && (
                  <p className="text-[10px] text-destructive">{bikeFormErrors.name}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Select
                value={bikeForm.year}
                onValueChange={(v) => setBikeForm({ ...bikeForm, year: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: new Date().getFullYear() - 2000 + 1 }, (_, i) => 2000 + i)
                    .reverse()
                    .map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className={bikeFormErrors.type ? 'text-destructive' : ''}>Type</Label>
              <Select
                value={bikeForm.type}
                onValueChange={(v) => {
                    setBikeForm({ ...bikeForm, type: v });
                    setBikeFormErrors((prev) => {
                      const { type: _, ...rest } = prev;
                      return rest;
                    });
                  }}
              >
                <SelectTrigger className={bikeFormErrors.type ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fuel">Fuel</SelectItem>
                  <SelectItem value="electric">Electric</SelectItem>
                  <SelectItem value="scooter">Scooter</SelectItem>
                </SelectContent>
              </Select>
              {bikeFormErrors.type && (
                <p className="text-[10px] text-destructive">{bikeFormErrors.type}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={bikeForm.category || 'midrange'}
                onValueChange={(v) => setBikeForm({ ...bikeForm, category: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="budget">Budget</SelectItem>
                  <SelectItem value="midrange">Mid Range</SelectItem>
                  <SelectItem value="topend">Top End</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 border-t pt-4 mt-4">
              <Label className="text-sm font-medium">Tariff Configuration (Admin Only)</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Weekday Rate (₹/hr)</Label>
                  <Input
                    type="text"
                    placeholder="Weekday Rate"
                    value={bikeForm.weekdayRate}
                    onChange={(e) => handleNumericChange('weekdayRate', e.target.value)}
                    onKeyDown={handleNumericKeyDown}
                    className={numericErrors.weekdayRate ? 'border-destructive' : ''}
                  />
                  {numericErrors.weekdayRate && (
                    <p className="text-[10px] text-destructive">{numericErrors.weekdayRate}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Weekend Rate (₹/hr)</Label>
                  <Input
                    type="text"
                    placeholder="Weekend Rate"
                    value={bikeForm.weekendRate}
                    onChange={(e) => handleNumericChange('weekendRate', e.target.value)}
                    onKeyDown={handleNumericKeyDown}
                    className={numericErrors.weekendRate ? 'border-destructive' : ''}
                  />
                  {numericErrors.weekendRate && (
                    <p className="text-[10px] text-destructive">{numericErrors.weekendRate}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Excess KM Charge (₹/km)</Label>
                  <Input
                    type="text"
                    placeholder="Excess Charge"
                    value={bikeForm.excessKmCharge}
                    onChange={(e) => handleNumericChange('excessKmCharge', e.target.value)}
                    onKeyDown={handleNumericKeyDown}
                    className={numericErrors.excessKmCharge ? 'border-destructive' : ''}
                  />
                  {numericErrors.excessKmCharge && (
                    <p className="text-[10px] text-destructive">{numericErrors.excessKmCharge}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">KM Limit Per Hour</Label>
                  <Input
                    type="text"
                    placeholder="KM Limit/Hr"
                    value={bikeForm.kmLimitPerHour}
                    onChange={(e) => handleNumericChange('kmLimitPerHour', e.target.value)}
                    onKeyDown={handleNumericKeyDown}
                    className={numericErrors.kmLimitPerHour ? 'border-destructive' : ''}
                  />
                  {numericErrors.kmLimitPerHour && (
                    <p className="text-[10px] text-destructive">{numericErrors.kmLimitPerHour}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">KM Limit</Label>
                  <Input
                    type="text"
                    placeholder="KM Limit"
                    value={bikeForm.kmLimit}
                    onChange={(e) => handleNumericChange('kmLimit', e.target.value)}
                    onKeyDown={handleNumericKeyDown}
                    className={numericErrors.kmLimit ? 'border-destructive' : ''}
                  />
                  {numericErrors.kmLimit && (
                    <p className="text-[10px] text-destructive">{numericErrors.kmLimit}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Min Booking Hours</Label>
                  <Input
                    type="text"
                    placeholder="Min Hours"
                    value={bikeForm.minBookingHours}
                    onChange={(e) => handleNumericChange('minBookingHours', e.target.value)}
                    onKeyDown={handleNumericKeyDown}
                    className={numericErrors.minBookingHours ? 'border-destructive' : ''}
                  />
                  {numericErrors.minBookingHours && (
                    <p className="text-[10px] text-destructive">{numericErrors.minBookingHours}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">GST Percentage (%)</Label>
                  <Input
                    type="text"
                    placeholder="GST %"
                    value={bikeForm.gstPercentage}
                    onChange={(e) => handleNumericChange('gstPercentage', e.target.value)}
                    onKeyDown={handleNumericKeyDown}
                    className={numericErrors.gstPercentage ? 'border-destructive' : ''}
                  />
                  {numericErrors.gstPercentage && (
                    <p className="text-[10px] text-destructive">{numericErrors.gstPercentage}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className={bikeFormErrors.locationId ? 'text-destructive' : ''}>
                Location
              </Label>
              <Select
                value={bikeForm.locationId}
                onValueChange={(v) => {
                  setBikeForm({ ...bikeForm, locationId: v });
                  setBikeFormErrors((prev) => {
                    const { locationId: _, ...rest } = prev;
                    return rest;
                  });
                }}
              >
                <SelectTrigger className={bikeFormErrors.locationId ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {formatLocationDisplay(loc)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {bikeFormErrors.locationId && (
                <p className="text-[10px] text-destructive">{bikeFormErrors.locationId}</p>
              )}
            </div>
            <div className="space-y-3 border-t pt-4">
              <Label
                className={`text-sm font-medium ${bikeFormErrors.image ? 'text-destructive' : ''}`}
              >
                Main Vehicle Image
              </Label>
              <div className="flex gap-4 items-start">
                <BikeImagePreview url={bikeForm.image} label="Main vehicle preview" />
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder="Enter Image URL"
                    value={bikeForm.image}
                    onChange={(e) => {
                      setBikeForm({ ...bikeForm, image: e.target.value });
                      setBikeFormErrors((prev) => {
                        const { image: _, ...rest } = prev;
                        return rest;
                      });
                    }}
                    className={bikeFormErrors.image ? 'border-destructive' : ''}
                  />
                  <div className="relative">
                    <Input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className={`cursor-pointer ${bikeFormErrors.image ? 'border-destructive' : ''}`}
                      disabled={isUploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        // Validation: Formats
                        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
                        if (!validTypes.includes(file.type)) {
                          toast({
                            title: 'Invalid file type',
                            description: 'Please upload a JPG, PNG, or WEBP image.',
                            variant: 'destructive',
                          });
                          e.target.value = '';
                          return;
                        }

                        // Validation: Size (2MB)
                        const maxSize = 2 * 1024 * 1024;
                        if (file.size > maxSize) {
                          toast({
                            title: 'File too large',
                            description: 'Image size should be less than 2MB.',
                            variant: 'destructive',
                          });
                          e.target.value = '';
                          return;
                        }

                        setIsUploading(true);
                        try {
                          const res = await documentsAPI.uploadFile(file, file.name, 'bike_image');
                          if (res?.fileUrl) {
                              setBikeForm({ ...bikeForm, image: res.fileUrl });
                              setBikeFormErrors((prev) => {
                                const { image: _, ...rest } = prev;
                                return rest;
                              });
                              toast({
                                title: 'Image uploaded',
                                description: 'Bike image has been uploaded',
                              });
                            } else {
                            toast({
                              title: 'Upload failed',
                              description: 'No file URL returned',
                              variant: 'destructive',
                            });
                          }
                        } catch (err: any) {
                          toast({
                            title: 'Upload error',
                            description: err.message || 'Failed to upload image',
                            variant: 'destructive',
                          });
                        } finally {
                          setIsUploading(false);
                        }
                      }}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                      {isUploading ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                  {bikeFormErrors.image && (
                    <p className="text-[10px] text-destructive">{bikeFormErrors.image}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    Tip: Click image to see larger preview
                  </p>
                </div>
              </div>
            </div>

            {/* Additional Images */}
            <div className="space-y-4 border-t pt-4">
              <Label className="text-sm font-medium">Additional Images (Optional)</Label>
              {bikeForm.images &&
                bikeForm.images.map((img: string, index: number) => (
                  <div key={index} className="space-y-3 p-3 border rounded-xl bg-muted/20 relative">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Image Slot {index + 1}</Label>
                      {img && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            const newImages = [...bikeForm.images];
                            newImages[index] = '';
                            setBikeForm({ ...bikeForm, images: newImages });
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-4 items-start">
                      <BikeImagePreview url={img} label={`Additional preview ${index + 1}`} />
                      <div className="flex-1 space-y-2">
                        <Input
                          placeholder={`Image URL ${index + 1}`}
                          value={img}
                          onChange={(e) => {
                            const newImages = [...bikeForm.images];
                            newImages[index] = e.target.value;
                            setBikeForm({ ...bikeForm, images: newImages });
                          }}
                        />
                        <div className="relative">
                          <Input
                            type="file"
                            accept="image/*"
                            className="cursor-pointer h-9 text-xs"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                const res = await documentsAPI.uploadFile(
                                  file,
                                  file.name,
                                  'bike_image'
                                );
                                if (res?.fileUrl) {
                                  const newImages = [...bikeForm.images];
                                  newImages[index] = res.fileUrl;
                                  setBikeForm({ ...bikeForm, images: newImages });
                                  toast({
                                    title: 'Image uploaded',
                                    description: `Image ${index + 1} has been uploaded`,
                                  });
                                }
                              } catch (err: any) {
                                toast({
                                  title: 'Upload error',
                                  description: err.message || 'Failed to upload image',
                                  variant: 'destructive',
                                });
                              }
                            }}
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                            <Download className="h-3.5 w-3.5" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            <div className="flex gap-2">
              <Button
                disabled={isUploading}
                onClick={async () => {
                  try {
                    // Form validation
                    const errors: Record<string, string> = {};
                    if (!bikeForm.brand) errors.brand = 'Brand is required';
                    if (!bikeForm.name) errors.name = 'Vehicle name is required';
                    if (!bikeForm.type) errors.type = 'Type is required';
                    if (!bikeForm.locationId) errors.locationId = 'Location is required';
                    if (!bikeForm.image) errors.image = 'Vehicle image is required';

                    if (Object.keys(errors).length > 0) {
                      setBikeFormErrors(errors);
                      const firstError = Object.values(errors)[0];
                      toast({
                        title: 'Validation Error',
                        description: firstError,
                        variant: 'destructive',
                      });
                      return;
                    }

                    // Reset errors if validation passes
                    setBikeFormErrors({});

                    if (isUploading) {
                      toast({
                        title: 'Please wait',
                        description: 'Wait for image upload to complete.',
                        variant: 'destructive',
                      });
                      return;
                    }

                    const payload: any = {
                      name: bikeForm.name,
                      brand: (bikeForm.brand || '').trim(),
                      year: bikeForm.year ? parseInt(bikeForm.year) : null,
                      type: bikeForm.type,
                      locationId: bikeForm.locationId,
                      image: bikeForm.image,
                      images: bikeForm.images,
                    };

                    // Client-side brand-model validation
                    if (!validateBrandModelMatch(payload.brand, payload.name)) {
                      toast({
                        title: 'Brand-Model Mismatch',
                        description: `${payload.name} belongs to ${getBrandForModel(payload.name)}.`,
                        variant: 'destructive',
                      });
                      return;
                    }

                    payload.kmLimit = bikeForm.kmLimit ? parseFloat(bikeForm.kmLimit) : null;

                    // Always include category if it exists in the form
                    if (bikeForm.category) {
                      payload.category = bikeForm.category;
                    } else {
                      payload.category = 'midrange'; // Default if not set
                    }

                    // Add tariff fields
                    payload.weekdayRate = bikeForm.weekdayRate
                      ? parseFloat(bikeForm.weekdayRate)
                      : null;
                    payload.weekendRate = bikeForm.weekendRate
                      ? parseFloat(bikeForm.weekendRate)
                      : null;
                    payload.excessKmCharge = bikeForm.excessKmCharge
                      ? parseFloat(bikeForm.excessKmCharge)
                      : null;
                    payload.kmLimitPerHour = bikeForm.kmLimitPerHour
                      ? parseFloat(bikeForm.kmLimitPerHour)
                      : null;
                    payload.minBookingHours = bikeForm.minBookingHours
                      ? parseFloat(bikeForm.minBookingHours)
                      : null;
                    // Handle GST percentage - allow 0 as a valid value
                    if (
                      bikeForm.gstPercentage !== undefined &&
                      bikeForm.gstPercentage !== null &&
                      bikeForm.gstPercentage !== ''
                    ) {
                      const gstValue = parseFloat(bikeForm.gstPercentage);
                      payload.gstPercentage = isNaN(gstValue) ? 18.0 : gstValue;
                    } else {
                      payload.gstPercentage = 18.0;
                    }

                    // Add pricing fields
                    payload.price12Hours = bikeForm.price12Hours
                      ? parseFloat(bikeForm.price12Hours)
                      : null;
                    payload.pricePerWeek = bikeForm.pricePerWeek
                      ? parseFloat(bikeForm.pricePerWeek)
                      : null;

                    // Add individual hourly rates for hours 13-24
                    for (let hour = 13; hour <= 24; hour++) {
                      const fieldName = `pricePerHour${hour}`;
                      if (bikeForm[fieldName]) {
                        payload[fieldName] = parseFloat(bikeForm[fieldName]);
                      }
                    }

                    // Keep pricePerHour for backward compatibility
                    if (!bikeForm.pricePerHour && (bikeForm.weekdayRate || bikeForm.weekendRate)) {
                      const baseRate = bikeForm.weekdayRate || bikeForm.weekendRate;
                      payload.pricePerHour = parseFloat(baseRate);
                    } else if (bikeForm.pricePerHour) {
                      payload.pricePerHour = parseFloat(bikeForm.pricePerHour);
                    }
                    if (editingBike) {
                      const updatedBike = await bikesAPI.update(editingBike.id, payload);
                      // Update the bike in the bikes array immediately
                      setBikes((prevBikes) =>
                        prevBikes.map((b) => (b.id === editingBike.id ? updatedBike : b))
                      );
                      toast({ title: 'Bike updated' });
                      setBikeDialogOpen(false);
                      setEditingBike(null);
                      // Reload data to ensure everything is in sync
                      await loadData();
                    } else {
                      await bikesAPI.create(payload);
                      toast({ title: 'Bike created' });
                      setBikeDialogOpen(false);
                      setEditingBike(null);
                      await loadData();
                    }
                  } catch (e: any) {
                    toast({
                      title: 'Error',
                      description: e.message || 'Failed to save bike',
                      variant: 'destructive',
                    });
                  }
                }}
              >
                {editingBike ? 'Save' : 'Create'}
              </Button>
              <Button variant="outline" onClick={() => setBikeDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* User Documents Dialog */}
      <Dialog open={isDocumentDialogOpen} onOpenChange={setIsDocumentDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Details & History</DialogTitle>
            <DialogDescription>
              Review documents and history for {selectedDocumentUser?.name}
            </DialogDescription>
          </DialogHeader>

          {selectedDocumentUser && (
            <div className="space-y-6">
              {/* User Info */}
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{selectedDocumentUser.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium break-all">{selectedDocumentUser.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Mobile</p>
                    <p className="font-medium">{selectedDocumentUser.mobile || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    {selectedDocumentUser.isVerified ? (
                      <Badge className="bg-accent/10 text-accent">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge className="bg-destructive/10 text-destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        Unverified
                      </Badge>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Wallet Balance</p>
                    <p className="font-medium">
                      ₹{selectedDocumentUser.walletBalance?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Emergency Contact</p>
                    <p className="font-medium">{selectedDocumentUser.emergencyContact || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Family Contact</p>
                    <p className="font-medium">{selectedDocumentUser.familyContact || '-'}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-sm text-muted-foreground">Permanent Address</p>
                    <p className="font-medium">{selectedDocumentUser.permanentAddress || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Current Location</p>
                    <p className="font-medium">{selectedDocumentUser.currentAddress || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Hotel Stay</p>
                    <p className="font-medium">{selectedDocumentUser.hotelStay || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Documents Grid */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {selectedDocumentUser.documents && selectedDocumentUser.documents.length > 0 ? (
                  selectedDocumentUser.documents.map((doc: any) => {
                    const StatusIcon = statusStyles[doc.status as keyof typeof statusStyles].icon;
                    return (
                      <div key={doc.id || doc._id} className="border rounded-lg p-3 sm:p-4 bg-card">
                        <div className="flex items-center justify-between mb-2 sm:mb-3">
                          <div className="min-w-0 flex-1 mr-2">
                            <p className="font-semibold text-sm truncate">
                              {doc.type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{doc.name}</p>
                          </div>
                          <Badge
                            className={`${statusStyles[doc.status as keyof typeof statusStyles].color} shrink-0`}
                          >
                            <StatusIcon className="h-3 w-3 mr-1" />
                            <span className="hidden sm:inline">{doc.status}</span>
                          </Badge>
                        </div>

                        {doc.status === 'rejected' && doc.rejectionReason && (
                          <div className="mb-2 px-2 py-1 bg-destructive/5 border border-destructive/10 rounded text-[10px] text-destructive">
                            <span className="font-semibold">Reason:</span> {doc.rejectionReason}
                          </div>
                        )}

                        {/* Document Preview */}
                        <div
                          className="mb-2 sm:mb-3 border rounded-lg overflow-hidden bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => {
                            if (doc.url) {
                              setPreviewImageUrl(doc.url);
                              setIsPreviewModalOpen(true);
                            }
                          }}
                        >
                          {doc.url && (
                            <img
                              src={doc.url}
                              alt={doc.name}
                              className="w-full h-24 sm:h-32 object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/documents/placeholder.pdf';
                              }}
                            />
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            {new Date(doc.uploadedAt).toLocaleDateString()}
                          </p>
                          <div className="flex gap-2">
                            {doc.status !== 'rejected' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[10px] text-destructive hover:text-destructive"
                                onClick={() => handleDocumentAction(doc.id || doc._id, 'reject')}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Reject
                              </Button>
                            )}
                            {doc.status !== 'approved' && (
                              <Button
                                size="sm"
                                className="h-7 px-2 text-[10px] bg-accent hover:bg-accent/90"
                                onClick={() => handleDocumentAction(doc.id || doc._id, 'approve')}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Approve
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-muted-foreground text-center py-8 col-span-2">
                    No documents uploaded
                  </p>
                )}
              </div>

              {/* Ride History */}
              <div className="mt-6">
                <h3 className="font-semibold text-lg mb-4">Ride History</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-sm">Bike</th>
                        <th className="text-left px-4 py-3 font-medium text-sm">Start</th>
                        <th className="text-left px-4 py-3 font-medium text-sm">End</th>
                        <th className="text-left px-4 py-3 font-medium text-sm">Status</th>
                        <th className="text-right px-4 py-3 font-medium text-sm">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {selectedDocumentUser.rentals && selectedDocumentUser.rentals.length > 0 ? (
                        selectedDocumentUser.rentals.map((rental: any) => {
                          const bike = bikes.find((b) => b.id === rental.bikeId);
                          return (
                            <tr key={rental.id}>
                              <td className="px-4 py-3 text-sm">{bike?.name || rental.bikeId}</td>
                              <td className="px-4 py-3 text-sm">
                                {new Date(rental.startTime).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {rental.endTime ? new Date(rental.endTime).toLocaleString() : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <Badge
                                  variant="outline"
                                  className={
                                    statusStyles[rental.status as keyof typeof statusStyles]
                                      ?.color || 'bg-muted'
                                  }
                                >
                                  {rental.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-sm text-right">
                                {rental.totalCost || rental.totalAmount
                                  ? `₹${rental.totalCost || rental.totalAmount}`
                                  : '-'}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-8 text-center text-muted-foreground text-sm"
                          >
                            No ride history found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsDocumentDialogOpen(false)}>
                  Close
                </Button>
                {!selectedDocumentUser.isVerified ? (
                  <Button
                    className="bg-accent hover:bg-accent/90"
                    onClick={() => {
                      handleVerifyUser(selectedDocumentUser.id, true);
                      setIsDocumentDialogOpen(false);
                    }}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Verify User
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      handleVerifyUser(selectedDocumentUser.id, false);
                      setIsDocumentDialogOpen(false);
                    }}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Unverify User
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rejection Reason Dialog */}
      <Dialog open={isRejectionModalOpen} onOpenChange={setIsRejectionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejection Reason</DialogTitle>
            <DialogDescription>
              Please provide a reason why this document is being rejected. This will be visible to
              the user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                placeholder="e.g. Image is blurry, Document is expired, etc."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsRejectionModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmRejection}>
              Confirm Rejection
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isPreviewModalOpen}
        onOpenChange={(open) => {
          setIsPreviewModalOpen(open);
          if (!open) setZoomScale(1);
        }}
      >
        <DialogContent className="max-w-5xl w-[95vw] h-[85vh] p-0 overflow-hidden bg-black/95 border-none shadow-2xl flex flex-col">
          <div className="relative flex-1 w-full h-full overflow-auto custom-scrollbar flex items-center justify-center p-4 sm:p-8">
            {previewImageUrl && (
              <div
                className="relative transition-all duration-300 ease-in-out flex items-center justify-center min-w-full min-h-full"
                style={{
                  transform: `scale(${zoomScale})`,
                  transformOrigin: 'center center',
                }}
              >
                <img
                  src={previewImageUrl}
                  alt="Large Preview"
                  className="max-w-full max-h-full object-contain shadow-2xl animate-in fade-in zoom-in duration-300"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://placehold.co/600x400?text=Image+Load+Error';
                  }}
                />
              </div>
            )}

            {/* Floating Zoom Controls - Bottom Center */}
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1.5 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-white hover:bg-white/20 rounded-xl"
                onClick={() => setZoomScale((prev) => Math.max(prev - 0.25, 0.5))}
                title="Zoom Out"
              >
                <ZoomOut className="h-5 w-5" />
              </Button>
              <div className="px-3 min-w-[60px] text-center border-x border-white/10">
                <span className="text-xs font-bold text-white tracking-tight">
                  {Math.round(zoomScale * 100)}%
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-white hover:bg-white/20 rounded-xl"
                onClick={() => setZoomScale((prev) => Math.min(prev + 0.25, 4))}
                title="Zoom In"
              >
                <ZoomIn className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="ml-1 h-9 w-9 text-white/60 hover:text-white hover:bg-white/20 rounded-xl"
                onClick={() => setZoomScale(1)}
                title="Reset Zoom"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md z-50 h-10 w-10 border border-white/10"
              onClick={() => setIsPreviewModalOpen(false)}
            >
              <X className="h-6 w-6" />
            </Button>
          </div>

          {previewImageUrl && (
            <div className="p-4 bg-black/40 backdrop-blur-md border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 z-50">
              <div className="flex flex-col max-w-full sm:max-w-[70%]">
                <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">
                  Image Source
                </p>
                <p className="text-xs font-medium truncate text-white/70">{previewImageUrl}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white/5 text-white border-white/10 hover:bg-white/10 h-9 px-4 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95"
                  onClick={() => window.open(previewImageUrl, '_blank')}
                >
                  <Maximize2 className="h-3.5 w-3.5 mr-2" />
                  Open Original
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
