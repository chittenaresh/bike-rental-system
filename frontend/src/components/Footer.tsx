import { memo, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bike, Mail, Phone, MapPin } from 'lucide-react';
import { locationsAPI } from '@/lib/api';
import { Location } from '@/types';
import { safeAsync } from '@/lib/errorHandler';

export const Footer = memo(function Footer() {
  const [locationName, setLocationName] = useState<string>('');

  useEffect(() => {
    const loadLocation = async () => {
      const selectedId = localStorage.getItem('selectedLocation');
      if (selectedId) {
        const locations = await safeAsync(() => locationsAPI.getAll(), [], 'footerLoadLocations');
        const loc = locations.find((l: Location) => l.id === selectedId);
        if (loc) {
          setLocationName(loc.city || loc.name || '');
        }
      }
    };
    loadLocation();
  }, []);

  return (
    <footer className="bg-secondary text-secondary-foreground">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl gradient-hero">
                <Bike className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-xl">RideFlow</span>
            </div>
            <p className="text-muted-foreground text-sm">
              Your premium bike rental destination. Explore the city on two wheels.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-display font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/garage" className="hover:text-primary transition-colors">Browse Bikes</Link></li>
              <li><Link to="/tariff" className="hover:text-primary transition-colors">Tariffs</Link></li>
              <li><Link to="/faq" className="hover:text-primary transition-colors">FAQ</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-display font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/about" className="hover:text-primary transition-colors">About Us</Link></li>
              <li><Link to="/contact" className="hover:text-primary transition-colors">Contact Us</Link></li>
              <li><Link to="/terms" className="hover:text-primary transition-colors">Terms & Conditions</Link></li>
              <li><Link to="/support" className="hover:text-primary transition-colors">Customer Support</Link></li>
            </ul>
          </div>

          {/* Contact & Hours */}
          <div className="md:col-span-1 space-y-6">
            <div>
              <h4 className="font-display font-semibold mb-4">Contact</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  {locationName ? `${locationName.toLowerCase().replace(/\s+/g, '')}@bikerental.com` : 'hello@rideflow.com'}
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  +91 98765 43210
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  {locationName || 'Main Garage, Bangalore'}
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border-t border-border/20 mt-8 pt-8 text-center text-sm text-muted-foreground">
          <p>© 2026 RideFlow. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
});
