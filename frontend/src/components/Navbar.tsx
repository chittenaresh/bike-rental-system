import { memo, useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bike, User, Menu, X, LogOut, MapPin, Activity, Moon, Sun } from 'lucide-react';
import { getCurrentUser, authAPI, locationsAPI, rentalsAPI, usersAPI } from '@/lib/api';
import { Location } from '@/types';
import { safeAsync, isAuthError } from '@/lib/errorHandler';
import { useTheme } from 'next-themes';
import { useToast } from '@/hooks/use-toast';

// Helper function to format location name for display
const formatLocationDisplay = (loc: any): string => {
  if (!loc) return '';
  // Show only the location name as per requirement
  return loc.name || loc.city || '';
};

export const Navbar = memo(function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [activeRide, setActiveRide] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [mobileMenuOpen]);

  const loadActiveRide = useCallback(
    async (currentUser: any) => {
      // Silently handle errors - don't show errors for auth failures
      const rentals = await safeAsync(() => rentalsAPI.getAll(), [], 'loadActiveRide');

      if (!rentals || rentals.length === 0) {
        setActiveRide(null);
        return;
      }

      // Only show active ride button when ride is started (ongoing/active), not when just confirmed
      const active = rentals.find((r: any) => {
        const rentalUserId = r.userId || r.user?.id;
        return (
          String(rentalUserId || '') === String(currentUser?.id || '') &&
          (r.status === 'ongoing' || r.status === 'active')
        );
      });
      setActiveRide(active || null);

      // Check for ride ending warning (within 30 mins)
      if (active && active.endTime) {
        const endTime = new Date(active.endTime).getTime();
        const now = new Date().getTime();
        const diffMs = endTime - now;
        const diffMinutes = diffMs / (1000 * 60);

        // Alert if between 0 and 30 minutes remaining
        if (diffMinutes > 0 && diffMinutes <= 30) {
          // Create a unique key for this specific warning instance (includes endTime to handle extensions)
          const alertKey = `ride_warning_${active.id}_${active.endTime}`;
          const hasAlerted = localStorage.getItem(alertKey);

          if (!hasAlerted) {
            toast({
              title: 'Ride Ending Soon',
              description: `Your ride ends in ${Math.ceil(diffMinutes)} minutes. Please return the bike to avoid late charges.`,
              variant: 'destructive',
              duration: 10000,
            });
            localStorage.setItem(alertKey, 'true');
          }
        }
      }
    },
    [toast]
  );

  const loadLocations = useCallback(async () => {
    const data = await safeAsync(() => locationsAPI.getAll(), [], 'loadLocations');

    if (!data || data.length === 0) {
      return;
    }

    setLocations(data);

    const savedLocation = localStorage.getItem('selectedLocation') || '';
    let nextLocationId = '';
    const ids = new Set(data.map((l) => l.id));
    if (savedLocation && ids.has(savedLocation)) {
      nextLocationId = savedLocation;
    } else if (savedLocation) {
      const byName = data.find((l) => l.name === savedLocation);
      if (byName?.id) {
        nextLocationId = byName.id;
        localStorage.setItem('selectedLocation', byName.id);
      }
    }

    // Only check profile if we don't have a valid location from localStorage
    if (!nextLocationId && getCurrentUser()) {
      const profile = await safeAsync(() => authAPI.getCurrentUser(), null, 'loadUser');
      
      // For admin users, prioritize their assigned location
      const assignedLocId = profile?.role === 'admin' && profile?.locationId 
        ? (typeof profile.locationId === 'object' ? (profile.locationId.id || profile.locationId._id) : profile.locationId)
        : null;

      const userLocId = assignedLocId || (profile?.currentLocationId ? String(profile.currentLocationId) : '');
      
      if (userLocId && ids.has(userLocId)) {
        nextLocationId = userLocId;
        localStorage.setItem('selectedLocation', userLocId);
      }
    }

    if (!nextLocationId && data.length > 0) {
      nextLocationId = data[0].id;
      localStorage.setItem('selectedLocation', nextLocationId);
    }

    if (nextLocationId) setSelectedLocation(nextLocationId);
  }, []);

  const [user, setUser] = useState(() => getCurrentUser());

  useEffect(() => {
    // Sync user state with localStorage/auth status when route changes
    const currentUser = getCurrentUser();
    if (JSON.stringify(currentUser) !== JSON.stringify(user)) {
      setTimeout(() => {
        setUser(currentUser);
      }, 0);
    }

    // Load locations asynchronously to avoid synchronous state updates within effect
    setTimeout(() => {
      loadLocations();
    }, 0);

    // Load active ride if user is logged in
    if (currentUser && !['admin', 'superadmin'].includes(currentUser.role)) {
      setTimeout(() => {
        loadActiveRide(currentUser);
      }, 0);

      // Refresh active ride status every 30 seconds
      const interval = setInterval(() => {
        loadActiveRide(currentUser);
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [location, loadLocations, loadActiveRide, user]);

  const handleLocationChange = useCallback(
    async (locationId: string) => {
      setSelectedLocation(locationId);
      localStorage.setItem('selectedLocation', locationId);

      // If user is logged in, try to update their profile location on the backend
      if (user && user.id) {
        await safeAsync(
          () => usersAPI.update(user.id, { currentLocationId: locationId }),
          null,
          'updateUserLocation'
        );
      }

      window.dispatchEvent(new CustomEvent('rideflow:locationChanged', { detail: { locationId } }));
    },
    [user]
  );

  const handleLogout = useCallback(() => {
    if (window.confirm('Are you sure you want to logout?')) {
      authAPI.logout();
      setUser(null);
      navigate('/');
    }
  }, [navigate]);

  const isActive = useCallback((path: string) => location.pathname === path, [location.pathname]);

  const isSuperAdmin = user?.role === 'superadmin';

  const navLinks = useMemo(
    () =>
      isSuperAdmin
        ? [
            { path: '/', label: 'Home' },
            { path: '/ride-finder', label: 'Ride Finder' },
            { path: '/dashboard', label: 'Dashboard' },
          ]
        : [
            { path: '/', label: 'Home' },
            { path: '/garage', label: 'Garage' },
            { path: '/ride-finder', label: 'Ride Finder' },
            { path: '/about', label: 'About Us' },
            { path: '/contact', label: 'Contact Us' },
            { path: '/faq', label: 'FAQ' },
            { path: '/terms', label: 'Terms' },
          ],
    [isSuperAdmin]
  );

  const selectedLocationData = useMemo(
    () => locations.find((loc) => loc.id === selectedLocation),
    [locations, selectedLocation]
  );

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="p-2 rounded-xl gradient-hero group-hover:shadow-glow transition-all duration-300">
              <Bike className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-xl">RideFlow</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`font-medium transition-colors duration-200 ${
                  isActive(link.path)
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Location Selector & Auth Buttons */}
          <div className="hidden lg:flex items-center gap-3">
            {!isSuperAdmin && locations.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-48 justify-between">
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-2" />
                      <span className="truncate">
                        {selectedLocationData
                          ? formatLocationDisplay(selectedLocationData)
                          : 'Select location'}
                      </span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48">
                  <DropdownMenuRadioGroup
                    value={selectedLocation}
                    onValueChange={handleLocationChange}
                  >
                    {locations.map((loc) => (
                      <DropdownMenuRadioItem key={loc.id} value={loc.id}>
                        {formatLocationDisplay(loc)}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {user ? (
              <>
                {user.role === 'admin' && (
                  <Link to="/admin">
                    <Button variant="ghost" size="sm">
                      Admin
                    </Button>
                  </Link>
                )}
                {user.role === 'superadmin' && (
                  <Link to="/superadmin">
                    <Button variant="ghost" size="sm">
                      Super Admin
                    </Button>
                  </Link>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <span className="hidden sm:inline">{user.name}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/dashboard" className="flex items-center cursor-pointer">
                        <User className="h-4 w-4 mr-2" />
                        Dashboard
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    {/* Ongoing Ride */}
                    {user && activeRide && !['admin', 'superadmin'].includes(user.role) && (
                      <DropdownMenuItem asChild>
                        <Link
                          to="/active-ride"
                          className="flex items-center cursor-pointer w-full justify-between"
                        >
                          <div className="flex items-center">
                            <Activity className="h-4 w-4 mr-2 text-primary" />
                            Ongoing Ride
                          </div>
                          <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
                          </span>
                        </Link>
                      </DropdownMenuItem>
                    )}

                    {/* Dark Mode Toggle */}
                    {mounted && (
                      <DropdownMenuItem
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="cursor-pointer"
                      >
                        {theme === 'dark' ? (
                          <>
                            <Sun className="h-4 w-4 mr-2" />
                            Light Mode
                          </>
                        ) : (
                          <>
                            <Moon className="h-4 w-4 mr-2" />
                            Dark Mode
                          </>
                        )}
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />
                    {!isSuperAdmin && (
                      <DropdownMenuItem asChild>
                        <Link
                          to="/support"
                          className="flex items-center cursor-pointer text-red-500 focus:text-red-600 focus:bg-red-50"
                        >
                          <Activity className="h-4 w-4 mr-2" />
                          Help & Support
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="text-destructive cursor-pointer"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Link to="/auth">
                  <Button variant="ghost" size="sm">
                    <User className="h-4 w-4 mr-2" />
                    Login
                  </Button>
                </Link>
                <Link to="/auth?mode=signup">
                  <Button variant="default" size="sm">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button className="lg:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-4 border-t border-border animate-fade-in max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="flex flex-col gap-4">
              {/* Active Ride Button for Mobile */}
              {user && activeRide && !['admin', 'superadmin'].includes(user.role) && (
                <Link to="/active-ride" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="default" size="sm" className="w-full bg-primary relative">
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
                    </span>
                    <Activity className="h-4 w-4 mr-2" />
                    Ongoing Ride
                  </Button>
                </Link>
              )}

              {/* Support Button for Mobile */}
              {user && !isSuperAdmin && (
                <Link to="/support" onClick={() => setMobileMenuOpen(false)}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200 justify-start"
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    Help & Support
                  </Button>
                </Link>
              )}

              {/* Location Selector for Mobile */}
              {locations.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 mr-2" />
                        <span className="truncate">
                          {selectedLocationData
                            ? formatLocationDisplay(selectedLocationData)
                            : 'Select location'}
                        </span>
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[calc(100vw-2rem)]">
                    <DropdownMenuRadioGroup
                      value={selectedLocation}
                      onValueChange={handleLocationChange}
                    >
                      {locations.map((loc) => (
                        <DropdownMenuRadioItem key={loc.id} value={loc.id}>
                          {formatLocationDisplay(loc)}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`font-medium py-2 transition-colors ${
                    isActive(link.path) ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              {/* Dark Mode Toggle for Mobile */}
              {mounted && (
                <div className="flex items-center justify-between py-2 border-t border-border">
                  <span className="font-medium">Dark Mode</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="w-9 h-9 p-0"
                    aria-label="Toggle dark mode"
                  >
                    {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </Button>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-border">
                {user ? (
                  <>
                    {user.role === 'superadmin' && (
                      <Link to="/dashboard" className="flex-1">
                        <Button variant="outline" className="w-full">
                          <User className="h-4 w-4 mr-2" />
                          Dashboard
                        </Button>
                      </Link>
                    )}
                    <Button variant="outline" className="flex-1" onClick={handleLogout}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </Button>
                  </>
                ) : (
                  <>
                    <Link to="/auth" className="flex-1">
                      <Button variant="outline" className="w-full">
                        Login
                      </Button>
                    </Link>
                    <Link to="/auth?mode=signup" className="flex-1">
                      <Button className="w-full">Sign Up</Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
});
