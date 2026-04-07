import { useParams, Link, useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { SEO } from '@/components/SEO';
import { blogPosts } from '@/data/blogPosts';
import { Button } from '@/components/ui/button';
import { Calendar, User, ArrowLeft, Share2 } from 'lucide-react';
import { useEffect } from 'react';

export default function BlogPost() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const post = blogPosts.find((p) => p.slug === slug);

  useEffect(() => {
    if (!post) {
      navigate('/blog');
    }
  }, [post, navigate]);

  if (!post) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title={post.title}
        description={post.excerpt}
        keywords={post.keywords}
        ogType="article"
        schema={{
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.excerpt,
          author: {
            '@type': 'Person',
            name: post.author,
          },
          datePublished: post.date,
          publisher: {
            '@type': 'Organization',
            name: 'RideFlow',
          },
        }}
      />
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-24">
        <article className="max-w-3xl mx-auto">
          <Link to="/blog">
            <Button variant="ghost" size="sm" className="mb-8 group">
              <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              Back to Blog
            </Button>
          </Link>

          <header className="mb-12">
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">
                {post.category}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(post.date).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {post.author}
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-display font-bold leading-tight mb-6">
              {post.title}
            </h1>
            <p className="text-xl text-muted-foreground italic border-l-4 border-primary/20 pl-4">
              {post.excerpt}
            </p>
          </header>

          <div className="aspect-video relative overflow-hidden rounded-3xl bg-muted mb-12 shadow-card">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 flex items-center justify-center text-muted-foreground/10 font-display text-6xl font-bold uppercase tracking-tighter">
              {post.category}
            </div>
          </div>

          <div
            className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-display prose-headings:font-bold prose-a:text-primary hover:prose-a:underline"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          <footer className="mt-16 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-muted-foreground">Share this article:</span>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" className="rounded-full h-10 w-10">
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Link to="/ride-finder">
              <Button variant="hero" className="rounded-xl">
                Rent a Bike Now
              </Button>
            </Link>
          </footer>
        </article>
      </main>

      <Footer />
    </div>
  );
}
