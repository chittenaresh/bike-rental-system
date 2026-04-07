import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { SEO } from '@/components/SEO';

export default function Terms() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="Terms and Conditions"
        description="Read the terms and conditions for renting a bike with RideFlow. Understand our rental agreement, vehicle usage policies, and return conditions."
        keywords="bike rental terms, rental agreement, motorcycle rental policies, RideFlow terms"
        schema={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Home',
              item: window.location.origin,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Terms',
              item: window.location.origin + '/terms',
            },
          ],
        }}
      />
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-24">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-display font-bold mb-4">Terms and Conditions</h1>
            <p className="text-xl text-muted-foreground">
              Please read these terms carefully before using our services.
            </p>
          </div>

          <div className="prose prose-lg dark:prose-invert max-w-none space-y-8">
            <section>
              <h3 className="text-2xl font-semibold mb-4">1. Rental Agreement</h3>
              <p className="text-muted-foreground">
                By renting a vehicle from RideFlow, you agree to the terms and conditions outlined
                in this agreement. You must be at least 18 years old and possess a valid driving
                license to rent a vehicle.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-semibold mb-4">2. Vehicle Usage</h3>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>The vehicle must be used only for personal transportation.</li>
                <li>Commercial use, racing, or off-roading is strictly prohibited.</li>
                <li>
                  You are responsible for any traffic violations or fines incurred during the rental
                  period.
                </li>
                <li>The vehicle should not be driven under the influence of alcohol or drugs.</li>
              </ul>
            </section>

            <section>
              <h3 className="text-2xl font-semibold mb-4">3. Damages and Insurance</h3>
              <p className="text-muted-foreground">
                While our vehicles are insured, you are responsible for the first part of any damage
                claim (deductible). Any damage caused by negligence or violation of terms will be
                fully charged to the user.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-semibold mb-4">4. Return Policy</h3>
              <p className="text-muted-foreground">
                The vehicle must be returned to the designated location by the agreed end time. Late
                returns will be charged at the standard hourly rate plus any applicable penalty
                fees.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-semibold mb-4">5. Privacy Policy</h3>
              <p className="text-muted-foreground">
                We value your privacy. Your personal information and documents are stored securely
                and used only for verification and service delivery purposes. We do not share your
                data with third parties without consent.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
