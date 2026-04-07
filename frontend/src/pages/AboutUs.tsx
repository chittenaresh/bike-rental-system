import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { SEO } from '@/components/SEO';

export default function AboutUs() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="About Us - Our Mission & Vision"
        description="Discover the story behind RideFlow. Learn about our mission to provide sustainable, affordable, and convenient bike rental solutions for urban commuters."
        keywords="about RideFlow, bike rental mission, urban mobility solutions, eco-friendly bike rental, RideFlow story"
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
              name: 'About Us',
              item: 'https://rideflow.com/about',
            },
          ],
        }}
      />
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-24">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-display font-bold">About Us</h1>
            <p className="text-xl text-muted-foreground">
              Empowering your journey with the perfect ride.
            </p>
          </div>

          <div className="prose prose-lg dark:prose-invert max-w-none">
            <p>
              Welcome to RideFlow, your premier destination for bike rentals. We believe that
              mobility should be seamless, affordable, and accessible to everyone. Whether you're
              commuting to work, exploring the city, or embarking on a weekend adventure, we have
              the perfect two-wheeler for you.
            </p>

            <h3>Our Mission</h3>
            <p>
              To revolutionize urban mobility by providing a reliable, eco-friendly, and convenient
              bike rental service that connects people to places and experiences.
            </p>

            <h3>Why Choose Us?</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Wide Selection:</strong> From efficient scooters to powerful motorcycles.
              </li>
              <li>
                <strong>Flexible Plans:</strong> Hourly, daily, and weekly rentals to suit your
                schedule.
              </li>
              <li>
                <strong>Safety First:</strong> All our vehicles are regularly maintained and
                insured.
              </li>
              <li>
                <strong>24/7 Support:</strong> We're here to help you whenever you need us.
              </li>
            </ul>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
