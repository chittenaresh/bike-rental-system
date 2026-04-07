import { Link } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { SEO } from '@/components/SEO';
import { blogPosts } from '@/data/blogPosts';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, User, ArrowRight } from 'lucide-react';

export default function Blog() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="Blog - Bike Rental Tips, Guides & News"
        description="Stay updated with the latest in urban mobility. Read our guides on bike rentals, electric bikes, and the best riding routes in your city."
        keywords="bike rental blog, motorcycle rental guides, e-bike news, urban mobility blog, RideFlow articles"
        schema={{
          '@context': 'https://schema.org',
          '@type': 'Blog',
          name: 'RideFlow Blog',
          description: 'Guides and news about bike rentals and urban mobility.',
          publisher: {
            '@type': 'Organization',
            name: 'RideFlow',
          },
        }}
      />
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">RideFlow Blog</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Your source for biking tips, rental guides, and stories from the road.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogPosts.map((post) => (
              <Card
                key={post.id}
                className="flex flex-col h-full overflow-hidden hover:shadow-lg transition-shadow border-none shadow-card bg-card"
              >
                <div className="aspect-video relative overflow-hidden bg-muted">
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/20">
                    {/* Placeholder if image doesn't exist */}
                    <span className="text-xs uppercase font-bold tracking-widest">
                      {post.category}
                    </span>
                  </div>
                  {/* In a real app, we'd use post.image. For now, using a placeholder style */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10" />
                </div>
                <CardHeader>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(post.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {post.author}
                    </span>
                  </div>
                  <CardTitle className="line-clamp-2 hover:text-primary transition-colors">
                    <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <CardDescription className="line-clamp-3 text-sm">{post.excerpt}</CardDescription>
                </CardContent>
                <CardFooter>
                  <Link to={`/blog/${post.slug}`} className="w-full">
                    <Button variant="ghost" className="w-full justify-between group">
                      Read More
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
