import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Phone, MapPin, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { locationsAPI, supportAPI } from "@/lib/api";
import { Location } from "@/types";
import { SEO } from "@/components/SEO";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_CONTACT = {
  email: 'support@rideflow.com',
  phone: '+91 98765 43210',
  address: 'Select a location to see details'
};

export default function ContactUs() {
  const [contactInfo, setContactInfo] = useState(DEFAULT_CONTACT);
  const [locationName, setLocationName] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    message: ''
  });

  useEffect(() => {
    const loadContactInfo = async () => {
      try {
        const locations = await locationsAPI.getAll();
        if (!locations || locations.length === 0) return;

        let selectedId = localStorage.getItem('selectedLocation');
        let location = locations.find((l: Location) => l.id === selectedId);
        
        // Fallback to first location if none selected or found
        if (!location && locations.length > 0) {
          location = locations[0];
        }

        if (location) {
          setSelectedLocationId(location.id);
          const displayLocation = location.city || location.name;
          setLocationName(displayLocation);
          
          const emailPrefix = displayLocation.toLowerCase().replace(/\s+/g, '');
          const email = `${emailPrefix}@bikerental.com`;
          const address = displayLocation;
          
          setContactInfo({
            email,
            phone: '+91 98765 43210',
            address
          });
        }
      } catch (error) {
        console.error('Failed to load location info', error);
      }
    };
    
    loadContactInfo();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.email || !formData.message) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const ticket = await supportAPI.create({
        subject: `Contact Request from ${formData.firstName} ${formData.lastName}`,
        category: 'contact',
        description: formData.message,
        locationId: selectedLocationId,
        guestName: `${formData.firstName} ${formData.lastName}`.trim(),
        guestEmail: formData.email
      });

      const ticketIdStr = ticket._id.toString().slice(-8).toUpperCase();

      toast({
        title: "Message Sent",
        description: `Your request (Ticket ID: #${ticketIdStr}) has been received. Our team will contact you via email.`,
      });

      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        message: ''
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title={`Contact Us - ${locationName || '24/7 Support'} & Location Details`}
        description={`Get in touch with RideFlow ${locationName ? `in ${locationName}` : ''} for any queries, support, or feedback regarding our bike rental services.`}
        keywords={`contact RideFlow ${locationName || ''}, bike rental support, customer service`}
        schema={[
          {
            "@context": "https://schema.org",
            "@type": "ContactPage",
            "name": `Contact RideFlow ${locationName || ''}`,
            "description": `Customer support and contact information for RideFlow Bike Rentals ${locationName ? `in ${locationName}` : ''}.`,
            "mainEntity": {
              "@type": "Organization",
              "name": "RideFlow",
              "telephone": contactInfo.phone,
              "email": contactInfo.email,
              "address": {
                "@type": "PostalAddress",
                "streetAddress": locationName || "Our Office",
                "addressLocality": locationName || "India",
                "addressRegion": "Telangana",
                "postalCode": "500001",
                "addressCountry": "IN"
              }
            }
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": "https://rideflow.com"
              },
              {
                "@type": "ListItem",
                "position": 2,
                "name": "Contact Us",
                "item": "https://rideflow.com/contact"
              }
            ]
          }
        ]}
      />
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-display font-bold mb-4">Contact Us</h1>
            <p className="text-xl text-muted-foreground">
              We'd love to hear from you. Get in touch with us for any queries or support.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Contact Info */}
            <div className="space-y-8">
              <div className="space-y-6">
                <h3 className="text-2xl font-semibold">Get in Touch</h3>
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">Email</h4>
                    <p className="text-muted-foreground">{contactInfo.email}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Phone className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">Phone</h4>
                    <p className="text-muted-foreground">{contactInfo.phone}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <MapPin className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">Office</h4>
                    <p className="text-muted-foreground whitespace-pre-line">
                      {contactInfo.address}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="bg-card p-8 rounded-2xl shadow-sm border">
              <h3 className="text-2xl font-semibold mb-6">Send us a Message</h3>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">First Name</label>
                    <Input 
                      placeholder="John" 
                      value={formData.firstName}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (/^[a-zA-Z]*$/.test(value)) {
                          setFormData(prev => ({ ...prev, firstName: value.slice(0, 20) }));
                        }
                      }}
                      maxLength={20}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Last Name</label>
                    <Input 
                      placeholder="Doe" 
                      value={formData.lastName}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (/^[a-zA-Z]*$/.test(value)) {
                          setFormData(prev => ({ ...prev, lastName: value.slice(0, 20) }));
                        }
                      }}
                      maxLength={20}
                      disabled={loading}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input 
                    type="email" 
                    placeholder="john@example.com" 
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Message</label>
                  <Textarea 
                    placeholder="How can we help you?" 
                    className="min-h-[120px]" 
                    value={formData.message}
                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    disabled={loading}
                  />
                </div>
                <Button className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Message
                </Button>
              </form>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
