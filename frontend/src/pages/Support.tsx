import { useState, useEffect, useRef } from 'react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supportAPI, rentalsAPI, bikesAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { SEO } from '@/components/SEO';
import {
  AlertTriangle,
  Bike,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  Send,
  X
} from 'lucide-react';

const safeFormat = (date: string | Date, fmt: string) => {
  try {
    return format(new Date(date), fmt);
  } catch {
    return 'N/A';
  }
};

interface Ticket {
  _id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  messages: Message[];
  rentalId?: {
    _id: string;
    bikeId: { name: string; brand: string; model: string; image: string };
    startDate: string;
    endDate: string;
    status: string;
  };
}

interface Message {
  _id: string;
  senderId: { _id: string; name: string; role: string } | string;
  senderRole: string;
  content: string;
  attachments: string[];
  createdAt: string;
}

export default function Support() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      const data = await supportAPI.getAll();
      setTickets(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load support tickets',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTicketCreated = () => {
    loadTickets();
    setIsCreateOpen(false);
  };

  const handleTicketUpdated = async () => {
    loadTickets();
    if (selectedTicket) {
      // Refresh selected ticket details
      try {
        const updated = await supportAPI.getById(selectedTicket._id);
        setSelectedTicket(updated);
      } catch (error) {
        console.error('Failed to refresh ticket', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO 
        title="Support Center"
        description="Need help with your bike rental? Our support team is here to assist you with bookings, technical issues, and any other queries."
        keywords="bike rental support, customer service, rental help center, RideFlow assistance"
        schema={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Home",
              "item": window.location.origin
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": "Support",
              "item": window.location.origin + "/support"
            }
          ]
        }}
      />
      <Navbar />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8 max-w-6xl mt-16">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold">Support & Help</h1>
            <p className="text-muted-foreground mt-2">
              Report issues, breakdowns, or accidents. We are here to help.
            </p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Ticket
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed">
            <div className="bg-primary/10 p-4 rounded-full w-fit mx-auto mb-4">
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No tickets yet</h3>
            <p className="text-muted-foreground mb-6">
              You haven't created any support tickets. If you need help, create one now.
            </p>
            <Button onClick={() => setIsCreateOpen(true)} variant="outline">
              Create Ticket
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tickets.map((ticket) => (
              <TicketCard 
                key={ticket._id} 
                ticket={ticket} 
                onClick={() => setSelectedTicket(ticket)} 
              />
            ))}
          </div>
        )}
        </div>
      </main>
      <Footer />

      <CreateTicketDialog 
        open={isCreateOpen} 
        onOpenChange={setIsCreateOpen} 
        onSuccess={handleTicketCreated} 
      />

      {selectedTicket && (
        <TicketDetailSheet 
          ticket={selectedTicket} 
          open={!!selectedTicket} 
          onOpenChange={(open) => !open && setSelectedTicket(null)}
          onUpdate={handleTicketUpdated}
        />
      )}
    </div>
  );
}

function TicketCard({ ticket, onClick }: { ticket: Ticket; onClick: () => void }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'resolved': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'closed': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityIcon = (priority: string) => {
    if (priority === 'critical' || priority === 'high') return <AlertTriangle className="h-3 w-3 mr-1 text-destructive" />;
    return null;
  };

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <Badge variant="outline" className={getStatusColor(ticket.status)}>
            {ticket.status.replace('_', ' ').toUpperCase()}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {safeFormat(ticket.createdAt, 'MMM d, yyyy')}
          </span>
        </div>
        <CardTitle className="text-lg mt-2 line-clamp-1">{ticket.subject}</CardTitle>
        <CardDescription className="flex items-center mt-1">
          {getPriorityIcon(ticket.priority)}
          <span className="capitalize">{ticket.category}</span>
          <span className="mx-2">•</span>
          <span className="capitalize">{ticket.priority} Priority</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {ticket.messages[0]?.content || 'No description'}
        </p>
      </CardContent>
      <CardFooter className="pt-2 text-xs text-muted-foreground border-t">
        <div className="flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          {ticket.messages.length} message{ticket.messages.length !== 1 ? 's' : ''}
        </div>
      </CardFooter>
    </Card>
  );
}

function CreateTicketDialog({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (open: boolean) => void; onSuccess: () => void }) {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('other');
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [rentals, setRentals] = useState<any[]>([]);
  const [selectedRentalId, setSelectedRentalId] = useState<string>('none');
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadRentals();
    }
  }, [open]);

  const loadRentals = async () => {
    try {
      const data = await rentalsAPI.getUserRentals();
      // Filter for active or recently completed rentals (e.g., within the last 7 days)
      const relevantRentals = data.filter(rental => {
        const isOngoing = rental.status === 'ongoing' || rental.status === 'active';
        const isRecent = rental.dropoffTime && new Date(rental.dropoffTime).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000;
        return isOngoing || isRecent;
      });

      // Fetch bike details for each relevant rental
      const rentalsWithBikeDetails = await Promise.all(relevantRentals.map(async rental => {
        if (rental.bikeId && typeof rental.bikeId === 'string') {
          try {
            const bikeDetails = await bikesAPI.getById(rental.bikeId);
            return { ...rental, bikeId: bikeDetails };
          } catch (bikeError) {
            console.error(`Failed to load bike details for ${rental.bikeId}:`, bikeError);
            return { ...rental, bikeId: { name: 'Unknown Bike' } }; // Fallback
          }
        }
        return rental;
      }));

      // Sort by date descending
      const sorted = rentalsWithBikeDetails.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRentals(sorted);
    } catch (error) {
      console.error('Failed to load rentals', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subject.length < 5 || subject.length > 100) {
      toast({ title: 'Validation Error', description: 'Subject must be between 5 and 100 characters', variant: 'destructive' });
      return;
    }
    if (description.length < 20 || description.length > 500) {
      toast({ title: 'Validation Error', description: 'Description must be between 20 and 500 characters', variant: 'destructive' });
      return;
    }

    if (category === 'other' && (!customCategory || customCategory.length < 3)) {
      toast({ title: 'Validation Error', description: 'Please provide a custom category name (min 3 characters)', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // Upload images first
      const imageUrls: string[] = [];
      for (const file of files) {
        const result = await supportAPI.upload(file);
        imageUrls.push(result.imageUrl);
      }

      await supportAPI.create({
        subject,
        category: category === 'other' ? customCategory : category,
        description,
        rentalId: selectedRentalId === 'none' ? undefined : selectedRentalId,
        images: imageUrls
      });

      toast({ title: 'Success', description: 'Ticket created successfully' });
      setSubject('');
      setCategory('other');
      setCustomCategory('');
      setDescription('');
      setSelectedRentalId('none');
      setFiles([]);
      onSuccess();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create ticket', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Support Ticket</DialogTitle>
          <DialogDescription>
            Describe your issue clearly. For breakdowns or accidents, please provide details and photos.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium">Subject</label>
              <span className={`text-[10px] ${subject.length < 5 || subject.length > 100 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {subject.length}/100 (min 5)
              </span>
            </div>
            <Input 
              value={subject} 
              onChange={(e) => setSubject(e.target.value)} 
              placeholder="Brief summary of the issue" 
              required 
              minLength={5}
              maxLength={100}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="breakdown">Bike Breakdown</SelectItem>
                  <SelectItem value="accident">Accident</SelectItem>
                  <SelectItem value="damage">Damage Report</SelectItem>
                  <SelectItem value="payment">Payment Issue</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Related Rental (Optional)</label>
              <Select value={selectedRentalId} onValueChange={setSelectedRentalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select rental" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {rentals.map(rental => {
                    let dateStr = '';
                    let bikeName = 'Unknown Bike';
                    if (rental.bikeId && typeof rental.bikeId !== 'string') {
                      bikeName = rental.bikeId.name || 'Unknown Bike';
                    }
                    try {
                      if (rental.startDate) {
                        const d = new Date(rental.startDate);
                        if (!isNaN(d.getTime())) {
                          dateStr = ` (${format(d, 'MMM d, yy')})`;
                        }
                      }
                    } catch (e) {
                      console.error('Date format error', e);
                    }
                    
                    return (
                      <SelectItem key={rental._id} value={rental._id}>
                        {bikeName}{dateStr}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          {category === 'other' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Custom Category Name</label>
              <Input 
                value={customCategory} 
                onChange={(e) => setCustomCategory(e.target.value)} 
                placeholder="e.g., Refund, Extension, Account Issue" 
                required 
                minLength={3}
                maxLength={50}
              />
            </div>
          )}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium">Description</label>
              <span className={`text-[10px] ${description.length < 20 || description.length > 500 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {description.length}/500 (min 20)
              </span>
            </div>
            <Textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="Detailed description..." 
              className="min-h-[100px]"
              required 
              minLength={20}
              maxLength={500}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Attachments (Images)</label>
            <Input 
              type="file" 
              accept="image/*" 
              multiple 
              onChange={handleFileChange} 
            />
            {files.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {files.length} file{files.length !== 1 ? 's' : ''} selected
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Ticket
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TicketDetailSheet({ ticket, open, onOpenChange, onUpdate }: { ticket: Ticket; open: boolean; onOpenChange: (open: boolean) => void; onUpdate: (updatedTicket?: any) => void }) {
  const [currentTicket, setCurrentTicket] = useState<Ticket>(ticket);
  const [newMessage, setNewMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setCurrentTicket(ticket);
  }, [ticket]);

  // Polling for new messages
  useEffect(() => {
    if (!open) return;

    const pollInterval = setInterval(async () => {
      try {
        const updated = await supportAPI.getById(ticket._id);
        // Only update if messages count changed or status changed to avoid unnecessary re-renders
        if (JSON.stringify(updated.messages) !== JSON.stringify(currentTicket.messages) || 
            updated.status !== currentTicket.status) {
          setCurrentTicket(updated);
        }
      } catch (error) {
        console.error('Polling failed', error);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [open, ticket._id, currentTicket]);

  useEffect(() => {
    if (open && scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [open, currentTicket.messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && files.length === 0) return;

    setSending(true);
    try {
      const imageUrls: string[] = [];
      for (const file of files) {
        const result = await supportAPI.upload(file);
        imageUrls.push(result.imageUrl);
      }

      const updatedTicket = await supportAPI.addMessage(ticket._id, {
        content: newMessage,
        attachments: imageUrls
      });

      setNewMessage('');
      setFiles([]);
      setCurrentTicket(updatedTicket);
      onUpdate(updatedTicket);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col p-0">
        <SheetHeader className="p-6 border-b">
          <div className="flex justify-between items-start">
            <SheetTitle>{currentTicket.subject}</SheetTitle>
            <Badge variant="outline">{currentTicket.status}</Badge>
          </div>
          <SheetDescription>
            ID: {currentTicket._id} • {format(new Date(currentTicket.createdAt), 'PPP')}
          </SheetDescription>
        </SheetHeader>
        
        <ScrollArea className="flex-1 p-6">
          <div className="space-y-6">
            {currentTicket.messages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.senderRole === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] rounded-lg p-3 ${
                  msg.senderRole === 'user' 
                    ? 'bg-primary text-primary-foreground rounded-tr-none' 
                    : 'bg-muted rounded-tl-none'
                }`}>
                  <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {msg.attachments.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
                          <img src={url} alt={`Support ticket attachment ${i + 1}`} className="rounded-md object-cover h-20 w-full" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground mt-1">
                  {msg.senderRole === 'user' ? 'You' : 'Support'} • {safeFormat(msg.createdAt, 'p')}
                </span>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-background">
          <form onSubmit={handleSendMessage} className="space-y-3">
            {currentTicket.status === 'closed' && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-md text-sm text-muted-foreground justify-center">
                <AlertTriangle className="h-4 w-4" />
                This ticket is closed. You cannot send further messages.
              </div>
            )}
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 p-2 bg-muted rounded-md">
                {files.map((f, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {f.name}
                    <button type="button" onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={currentTicket.status === 'closed' ? "Ticket is closed" : "Type your message..."}
                  className="pr-10"
                  disabled={currentTicket.status === 'closed'}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <Input 
                    type="file" 
                    id="chat-file-upload" 
                    className="hidden" 
                    multiple 
                    accept="image/*"
                    disabled={currentTicket.status === 'closed'}
                    onChange={(e) => {
                      if (e.target.files) setFiles([...files, ...Array.from(e.target.files)]);
                    }} 
                  />
                  <label htmlFor="chat-file-upload" className={`cursor-pointer text-muted-foreground hover:text-foreground ${currentTicket.status === 'closed' ? 'opacity-50 pointer-events-none' : ''}`}>
                    <Paperclip className="h-4 w-4" />
                  </label>
                </div>
              </div>
              <Button type="submit" size="icon" disabled={sending || (!newMessage.trim() && files.length === 0) || currentTicket.status === 'closed'}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
