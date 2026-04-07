export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  date: string;
  image: string;
  category: string;
  keywords: string;
}

export const blogPosts: BlogPost[] = [
  {
    id: '1',
    slug: 'top-5-tips-for-bike-rentals',
    title: 'Top 5 Tips for a Smooth Bike Rental Experience',
    excerpt:
      'Renting a bike can be a breeze if you know what to look for. Here are our top 5 tips to ensure you have the best experience.',
    content: `
      <p>Renting a bike is one of the most convenient ways to explore a new city or commute without the hassle of ownership. However, for first-timers, it can feel a bit overwhelming. Here are our top tips to make your next rental seamless.</p>
      
      <h3>1. Check the Vehicle Thoroughly</h3>
      <p>Before you ride off, take a few minutes to inspect the bike. Check the tires, brakes, and lights. If you notice any existing scratches or issues, make sure to document them or inform the rental provider.</p>
      
      <h3>2. Understand the Pricing</h3>
      <p>Different providers have different pricing models—hourly, daily, or weekly. At RideFlow, we offer flexible plans starting at just ₹10/hour. Make sure you understand the fuel policy and any late return charges.</p>
      
      <h3>3. Carry Your Documents</h3>
      <p>Always have a valid driving license and a government-issued ID proof handy. Most digital platforms, including RideFlow, allow you to upload these for quick verification.</p>
      
      <h3>4. Safety First</h3>
      <p>Never compromise on safety. Always wear a helmet. We provide a complimentary helmet with every booking to ensure you're protected on the road.</p>
      
      <h3>5. Plan Your Route</h3>
      <p>While exploring is fun, having a rough idea of your destination and parking spots can save you a lot of time and battery/fuel.</p>
    `,
    author: 'RideFlow Team',
    date: '2026-02-10',
    image: '/blog/rental-tips.jpg',
    category: 'Guides',
    keywords: 'bike rental tips, rent a bike guide, motorcycle rental safety, RideFlow guides',
  },
  {
    id: '2',
    slug: 'benefits-of-electric-bikes',
    title: 'Why Electric Bikes are the Future of Urban Commuting',
    excerpt:
      'Discover how electric bikes are changing the way we move through cities, from reducing carbon footprints to saving on fuel costs.',
    content: `
      <p>Urban mobility is undergoing a massive transformation, and electric bikes (E-bikes) are leading the charge. Here's why you should consider an E-bike for your next city ride.</p>
      
      <h3>1. Eco-Friendly Transportation</h3>
      <p>E-bikes produce zero emissions, making them a sustainable alternative to petrol-powered vehicles. By choosing an electric rental, you're contributing to a cleaner, greener city.</p>
      
      <h3>2. Cost-Effective</h3>
      <p>With rising fuel prices, electric bikes are incredibly easy on the pocket. The cost per kilometer is a fraction of what you'd spend on a traditional motorcycle.</p>
      
      <h3>3. Beat the Traffic</h3>
      <p>The compact design of E-bikes allows you to navigate through congested city streets much faster than a car. Plus, finding parking is never an issue!</p>
      
      <h3>4. No License Required for Some Models</h3>
      <p>Many low-speed electric scooters don't even require a formal driving license, making them accessible to a wider range of riders.</p>
      
      <p>At RideFlow, we're expanding our fleet of electric bikes to provide you with the most modern and sustainable rental options available.</p>
    `,
    author: 'RideFlow Team',
    date: '2026-02-05',
    image: '/blog/electric-bikes.jpg',
    category: 'Innovation',
    keywords:
      'electric bike benefits, e-bike commuting, sustainable transport, electric scooter rental',
  },
  {
    id: '3',
    slug: 'exploring-bangalore-on-two-wheels',
    title: 'Exploring Bangalore: The Best Routes for a Weekend Ride',
    excerpt:
      'From the lush greenery of Cubbon Park to the outskirts of Nandi Hills, discover the best places to ride your rented bike in Bangalore.',
    content: `
      <p>Bangalore, the Garden City, is best explored on two wheels. Whether you're a local or a visitor, renting a bike gives you the freedom to discover hidden gems. Here are our favorite weekend routes.</p>
      
      <h3>1. The Heritage Trail</h3>
      <p>Start early morning at Vidhana Soudha, ride through the quiet lanes of Malleshwaram, and end with a delicious breakfast at CTR. The morning air and historic architecture are truly rejuvenating.</p>
      
      <h3>2. Nandi Hills Sunrise Ride</h3>
      <p>For those who love a bit of a distance, the ride to Nandi Hills (about 60km from the city) is a must. The winding roads and the sunrise view from the top make it the most popular biking route near Bangalore.</p>
      
      <h3>3. Greenery and Lakes</h3>
      <p>Explore the southern part of the city—Lalbagh Botanical Garden and the serene Agara Lake. These spots offer a peaceful escape from the city's hustle.</p>
      
      <p>Ready for your adventure? Rent a high-performance motorcycle from RideFlow and hit the road this weekend!</p>
    `,
    author: 'Local Explorer',
    date: '2026-01-28',
    image: '/blog/bangalore-ride.jpg',
    category: 'Travel',
    keywords:
      'Bangalore bike routes, weekend rides Bangalore, Nandi Hills bike trip, Bangalore travel guide',
  },
];
