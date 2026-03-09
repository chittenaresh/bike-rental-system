import { useState, useEffect, useRef } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle,
  SheetClose
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { supportAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { 
  Loader2, 
  Search, 
  Filter, 
  MessageSquare, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  XCircle,
  Send,
  Mail,
  Paperclip,
  X,
  MoreVertical
} from 'lucide-react';

interface Ticket {
  _id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  userId?: { _id: string; name: string; email: string; mobile: string };
  guestName?: string;
  guestEmail?: string;
  rentalId?: any;
  messages: Message[];
}

interface Message {
  _id: string;
  senderId?: { _id: string; name: string; role: string } | string;
  guestName?: string;
  guestEmail?: string;
  senderRole: string;
  content: string;
  attachments: string[];
  createdAt: string;
}

const safeFormat = (dateInput: string | Date | undefined | null, formatStr: string) => {
  if (!dateInput) return 'N/A';
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return 'N/A';
    return format(date, formatStr);
  } catch (e) {
    return 'N/A';
  }
};

export function SupportManager() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const { toast } = useToast();

  const loadTickets = async () => {
    setLoading(true);
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

  useEffect(() => {
    loadTickets();
  }, []);

  const handleTicketUpdated = async () => {
    // Reload list but keep selected ticket open and updated
    try {
      const data = await supportAPI.getAll();
      setTickets(data);
      if (selectedTicket) {
        const updated = data.find(t => t._id === selectedTicket._id);
        if (updated) setSelectedTicket(updated);
      }
    } catch (error) {
      console.error('Failed to refresh tickets', error);
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const userName = ticket.userId?.name || ticket.guestName || '';
    const userEmail = ticket.userId?.email || ticket.guestEmail || '';

    const matchesSearch = 
      ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket._id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      userEmail.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'replied': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'resolved': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'closed': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityBadge = (priority: string) => {
    if (priority === 'critical') return <Badge variant="destructive">Critical</Badge>;
    if (priority === 'high') return <Badge variant="destructive" className="bg-orange-500 hover:bg-orange-600">High</Badge>;
    if (priority === 'medium') return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20">Medium</Badge>;
    return <Badge variant="outline">Low</Badge>;
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Support Tickets</h2>
          <p className="text-muted-foreground">Manage user support requests and issues.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center bg-card p-4 rounded-lg border">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets by subject, ID, or user..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="replied">Replied</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-lg bg-card flex-1 overflow-hidden flex flex-col">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket ID</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <div className="flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredTickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No tickets found matching your criteria.
                </TableCell>
              </TableRow>
            ) : (
              filteredTickets.map((ticket) => (
                <TableRow key={ticket._id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedTicket(ticket)}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {ticket._id.substring(ticket._id.length - 8)}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{ticket.subject}</span>
                      <span className="text-xs text-muted-foreground capitalize">{ticket.category}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{ticket.userId?.name || ticket.guestName || 'Guest'}</span>
                      <span className="text-xs text-muted-foreground">{ticket.userId?.email || ticket.guestEmail}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusColor(ticket.status)}>
                      {ticket.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {getPriorityBadge(ticket.priority)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {safeFormat(ticket.updatedAt || ticket.createdAt, 'MMM d, HH:mm')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedTicket(ticket); }}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {selectedTicket && (
        <AdminTicketDetailSheet
          ticket={selectedTicket}
          open={!!selectedTicket}
          onOpenChange={(open) => !open && setSelectedTicket(null)}
          onUpdate={handleTicketUpdated}
        />
      )}
    </div>
  );
}

function AdminTicketDetailSheet({ ticket, open, onOpenChange, onUpdate }: { ticket: Ticket; open: boolean; onOpenChange: (open: boolean) => void; onUpdate: () => void }) {
  const [currentTicket, setCurrentTicket] = useState<Ticket>(ticket);
  const [newMessage, setNewMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [isEmailReply, setIsEmailReply] = useState(false);
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

  const handleSendEmailReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      const result = await supportAPI.sendEmailReply(ticket._id, {
        content: newMessage
      });

      toast({ title: 'Success', description: 'Email reply sent successfully' });
      setNewMessage('');
      setIsEmailReply(false);
      setCurrentTicket(result.ticket);
      onUpdate();
    } catch (error: any) {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to send email reply', 
        variant: 'destructive' 
      });
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEmailReply) {
      return handleSendEmailReply(e);
    }
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
      onUpdate();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      await supportAPI.updateStatus(ticket._id, { status: newStatus });
      toast({ title: 'Success', description: `Status updated to ${newStatus}` });
      const updated = await supportAPI.getById(ticket._id);
      setCurrentTicket(updated);
      onUpdate();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handlePriorityChange = async (newPriority: string) => {
    setUpdatingStatus(true);
    try {
      await supportAPI.updateStatus(ticket._id, { priority: newPriority });
      toast({ title: 'Success', description: `Priority updated to ${newPriority}` });
      const updated = await supportAPI.getById(ticket._id);
      setCurrentTicket(updated);
      onUpdate();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update priority', variant: 'destructive' });
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[600px] flex flex-col p-0 border-l">
        <SheetHeader className="p-6 border-b bg-muted/10">
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <SheetTitle className="text-xl">{currentTicket.subject}</SheetTitle>
                <SheetDescription>
                  Ticket #{currentTicket._id.substring(currentTicket._id.length - 8)}
                </SheetDescription>
              </div>
              <SheetClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </SheetClose>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <Select value={currentTicket.status} onValueChange={handleStatusChange} disabled={updatingStatus}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="replied">Replied</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Priority</label>
                <Select value={currentTicket.priority} onValueChange={handlePriorityChange} disabled={updatingStatus}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span>{currentTicket.userId?.name || currentTicket.guestName || 'Guest'}</span>
              </div>
              <div>•</div>
              <div>{currentTicket.userId?.email || currentTicket.guestEmail}</div>
              {currentTicket.userId?.mobile && (
                <>
                  <div>•</div>
                  <div>{currentTicket.userId.mobile}</div>
                </>
              )}
              <div>•</div>
              <div className="capitalize">{currentTicket.category}</div>
            </div>

            {currentTicket.rentalId && (
              <div className="mt-4 p-3 bg-muted/30 rounded-lg border text-sm">
                <h4 className="font-medium text-foreground mb-1 flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">R</span>
                  Related Rental
                </h4>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <span className="text-muted-foreground text-xs block">Bike</span>
                    <span className="font-medium">{currentTicket.rentalId.bikeId?.name || 'Unknown Bike'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Status</span>
                    <Badge variant="outline" className="h-5 text-[10px] px-1.5 py-0">{currentTicket.rentalId.status}</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Period</span>
                    <span className="text-xs">
                      {safeFormat(currentTicket.rentalId.startDate, 'MMM d')} - {safeFormat(currentTicket.rentalId.endDate, 'MMM d')}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Rental ID</span>
                    <span className="font-mono text-[10px]">{currentTicket.rentalId._id.substring(currentTicket.rentalId._id.length - 8)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </SheetHeader>
        
        <ScrollArea className="flex-1 p-6 bg-muted/5">
          <div className="space-y-6">
            {currentTicket.messages.map((msg, idx) => {
              const isAdmin = msg.senderRole === 'admin' || msg.senderRole === 'superadmin';
              const isEmailReplyMsg = msg.content.startsWith('[EMAIL REPLY SENT TO');
              
              return (
                <div key={idx} className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                  <div className={`flex items-end gap-2 max-w-[85%] ${isAdmin ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                      isAdmin 
                        ? (isEmailReplyMsg ? 'bg-orange-500 text-white' : 'bg-primary text-primary-foreground')
                        : 'bg-muted-foreground/20 text-muted-foreground'
                    }`}>
                      {isAdmin ? (isEmailReplyMsg ? <Mail className="h-4 w-4" /> : 'A') : (msg.guestName ? msg.guestName[0] : (typeof msg.senderId === 'object' ? msg.senderId.name[0] : 'U'))}
                    </div>
                    <div className={`rounded-2xl p-4 shadow-sm ${
                      isAdmin 
                        ? (isEmailReplyMsg 
                            ? 'bg-orange-50 text-orange-900 border border-orange-200 rounded-tr-sm' 
                            : 'bg-primary text-primary-foreground rounded-tr-sm')
                        : 'bg-background border rounded-tl-sm'
                    }`}>
                      {isEmailReplyMsg ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 pb-1 border-b border-orange-200/50 mb-1 text-[10px] font-semibold uppercase tracking-wider text-orange-600">
                            <Mail className="h-3 w-3" />
                            Email Sent
                          </div>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">
                            {msg.content.substring(msg.content.indexOf(']') + 1).trim()}
                          </p>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                      )}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {msg.attachments.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block group relative overflow-hidden rounded-md border bg-background">
                              <img src={url} alt="attachment" className="object-cover h-24 w-full transition-transform group-hover:scale-105" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1 mx-12">
                    {safeFormat(msg.createdAt, 'MMM d, p')}
                  </span>
                </div>
              );
            })}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-background">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={isEmailReply ? "default" : "outline"}
                size="sm"
                className={`h-7 text-[10px] gap-1 ${isEmailReply ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
                onClick={() => setIsEmailReply(!isEmailReply)}
                disabled={currentTicket.status === 'closed'}
              >
                <Mail className="h-3 w-3" />
                {isEmailReply ? "Email Mode" : "System Mode"}
              </Button>
            </div>
            {isEmailReply && (
              <span className="text-[10px] text-orange-600 font-medium animate-pulse">
                Replying to {currentTicket.userId?.email || currentTicket.guestEmail}
              </span>
            )}
          </div>
          <form onSubmit={handleSendMessage} className="space-y-3">
            {currentTicket.status === 'closed' && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-md text-sm text-muted-foreground justify-center">
                <AlertTriangle className="h-4 w-4" />
                This ticket is closed. Reopen to send messages.
              </div>
            )}
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 p-2 bg-muted rounded-md animate-in fade-in slide-in-from-bottom-2">
                {files.map((f, i) => (
                  <Badge key={i} variant="secondary" className="text-xs pl-2 pr-1 py-1 h-7">
                    <span className="truncate max-w-[100px]">{f.name}</span>
                    <button type="button" onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="ml-1 hover:text-destructive p-0.5 rounded-full transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <div className="relative flex-1 group">
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={
                    currentTicket.status === 'closed' 
                      ? "Ticket is closed" 
                      : (isEmailReply ? "Type your email reply..." : "Type your internal message...")
                  }
                  className={`pr-12 min-h-[44px] max-h-[120px] resize-none py-3 ${isEmailReply ? 'border-orange-200 focus-visible:ring-orange-500' : ''}`}
                  rows={1}
                  disabled={currentTicket.status === 'closed'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (newMessage.trim() || files.length > 0) handleSendMessage(e);
                    }
                  }}
                />
                <div className="absolute right-2 bottom-2">
                  {!isEmailReply && (
                    <Input 
                      type="file" 
                      id="admin-chat-file-upload" 
                      className="hidden" 
                      multiple 
                      accept="image/*"
                      disabled={currentTicket.status === 'closed'}
                      onChange={(e) => {
                        if (e.target.files) setFiles([...files, ...Array.from(e.target.files)]);
                      }} 
                    />
                  )}
                  {!isEmailReply && (
                    <label 
                      htmlFor="admin-chat-file-upload" 
                      className={`cursor-pointer text-muted-foreground hover:text-primary p-2 rounded-md hover:bg-muted transition-colors flex items-center justify-center ${currentTicket.status === 'closed' ? 'opacity-50 pointer-events-none' : ''}`}
                      title="Attach images"
                    >
                      <Paperclip className="h-4 w-4" />
                    </label>
                  )}
                </div>
              </div>
              <Button 
                type="submit" 
                size="icon" 
                className={`h-[44px] w-[44px] shrink-0 rounded-xl shadow-lg transition-all active:scale-95 ${
                  isEmailReply ? 'bg-orange-500 hover:bg-orange-600' : ''
                }`}
                disabled={sending || (!newMessage.trim() && files.length === 0) || currentTicket.status === 'closed'}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : (isEmailReply ? <Mail className="h-4 w-4" /> : <Send className="h-4 w-4" />)}
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
