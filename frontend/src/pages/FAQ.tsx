import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { SEO } from '@/components/SEO';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export default function FAQ() {
  const faqs = [
    {
      question: 'What documents do I need to rent a bike?',
      answer:
        'You need a valid Driving License, a government-issued ID proof (Aadhar/Passport), and a live selfie for verification.',
    },
    {
      question: 'Is fuel included in the rental price?',
      answer:
        'No, fuel is not included. The bike is provided with a minimum amount of fuel to reach the nearest petrol station, and should be returned with the same level.',
    },
    {
      question: 'Is there a security deposit?',
      answer:
        'No, we operate on a zero-deposit policy for verified users. However, in some cases or for premium bikes, a small refundable security deposit might be applicable.',
    },
    {
      question: 'What happens if I return the bike late?',
      answer:
        'Late returns are charged based on our hourly rates. If the delay exceeds a certain limit, additional penalties may apply as per our terms and conditions.',
    },
    {
      question: 'Are helmets provided?',
      answer:
        'Yes, one complimentary helmet is provided with every booking. A pillion helmet can be added for a small extra fee.',
    },
    {
      question: 'What is the cancellation policy?',
      answer:
        'You can cancel your booking for free up to 24 hours before the pickup time. Cancellations within 24 hours may attract a small cancellation fee.',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="Bike Rental FAQ - Frequently Asked Questions"
        description="Have questions about RideFlow bike rentals? Find answers to common queries about documents, fuel, deposits, and more to make your rental experience smooth."
        keywords="bike rental faq, rent a bike questions, motorcycle rental help, RideFlow support, bike rental documentation"
        schema={[
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map((faq) => ({
              '@type': 'Question',
              name: faq.question,
              acceptedAnswer: {
                '@type': 'Answer',
                text: faq.answer,
              },
            })),
          },
          {
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
                name: 'FAQ',
                item: 'https://rideflow.com/faq',
              },
            ],
          },
        ]}
      />
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-24">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-display font-bold mb-4">Frequently Asked Questions</h1>
            <p className="text-xl text-muted-foreground">
              Find answers to common questions about our bike rental services.
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left font-medium text-lg">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-base">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </main>
      <Footer />
    </div>
  );
}
