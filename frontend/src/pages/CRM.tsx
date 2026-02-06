import { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { DevelopmentBanner } from '@/components/common/DevelopmentBanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SaveFilterButton } from '@/components/common/SaveFilterButton';
import {
  Search,
  Mail,
  Phone,
  User,
  Send,
  FileText,
  Plus,
  Calendar,
  Clock,
  ExternalLink,
} from 'lucide-react';

// Mock contacts (users with investor role)
const mockContacts = [
  { 
    id: 'C001', 
    name: 'James Morrison', 
    email: 'james.morrison@email.com', 
    phone: '+1 (555) 123-4567',
    type: 'Individual',
    advisor: 'Sarah Chen',
    portfolios: ['Global Growth Portfolio'],
    lastContact: '2024-01-10',
    notes: 'Interested in tech stocks'
  },
  { 
    id: 'C002', 
    name: 'Meridian Holdings LLC', 
    email: 'treasury@meridian.com', 
    phone: '+1 (555) 234-5678',
    type: 'Company',
    advisor: 'Michael Torres',
    portfolios: ['Conservative Income Fund'],
    lastContact: '2024-01-08',
    notes: 'Annual review scheduled for February'
  },
  { 
    id: 'C003', 
    name: 'Elena Kowalski', 
    email: 'elena.kowalski@email.com', 
    phone: '+41 78 123 4567',
    type: 'Individual',
    advisor: 'Sarah Chen',
    portfolios: ['Tech Opportunities'],
    lastContact: '2024-01-12',
    notes: 'Aggressive growth strategy'
  },
  { 
    id: 'C004', 
    name: 'Hans & Maria Weber', 
    email: 'weber.family@email.de', 
    phone: '+49 30 123 4567',
    type: 'Individual',
    advisor: 'Michael Torres',
    portfolios: ['Fixed Income Strategy'],
    lastContact: '2024-01-05',
    notes: 'Conservative, retirement focus'
  },
];

// Mock email templates
const emailTemplates = [
  { id: 'T001', name: 'Monthly Report', subject: 'Your Monthly Portfolio Report - {month}', body: 'Dear {name},\n\nPlease find attached your monthly portfolio report...' },
  { id: 'T002', name: 'Quarterly Review Invitation', subject: 'Quarterly Review Meeting Invitation', body: 'Dear {name},\n\nWe would like to schedule your quarterly review meeting...' },
  { id: 'T003', name: 'Market Update', subject: 'Important Market Update', body: 'Dear {name},\n\nWe wanted to share some important market updates...' },
  { id: 'T004', name: 'KYC Update Request', subject: 'Action Required: KYC Document Update', body: 'Dear {name},\n\nAs part of our compliance requirements, we need to update your KYC documents...' },
];

// Mock Google Forms
const googleForms = [
  { id: 'F001', name: 'Risk Profile Questionnaire', url: 'https://forms.google.com/risk-profile', description: 'Assess client risk tolerance' },
  { id: 'F002', name: 'KYC Update Form', url: 'https://forms.google.com/kyc-update', description: 'Collect updated KYC information' },
  { id: 'F003', name: 'Investment Preferences', url: 'https://forms.google.com/investment-prefs', description: 'Gather investment preferences' },
  { id: 'F004', name: 'Client Feedback Survey', url: 'https://forms.google.com/feedback', description: 'Collect client satisfaction data' },
];

// Mock activity log
const recentActivities = [
  { id: 'A001', type: 'email', contact: 'James Morrison', action: 'Monthly Report sent', date: '2024-01-12 14:30' },
  { id: 'A002', type: 'form', contact: 'Elena Kowalski', action: 'Risk Profile Questionnaire sent', date: '2024-01-12 11:15' },
  { id: 'A003', type: 'email', contact: 'Meridian Holdings LLC', action: 'Quarterly Review Invitation sent', date: '2024-01-11 16:45' },
  { id: 'A004', type: 'note', contact: 'Hans & Maria Weber', action: 'Added note: Retirement planning discussion', date: '2024-01-10 10:00' },
];

const CRM = () => {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  // Filter contacts
  const filteredContacts = useMemo(() => {
    return mockContacts.filter(c => {
      if (selectedType !== 'all' && c.type !== selectedType) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return c.name.toLowerCase().includes(query) || 
               c.email.toLowerCase().includes(query);
      }
      return true;
    });
  }, [searchQuery, selectedType]);

  const toggleContactSelection = (id: string) => {
    setSelectedContacts(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const selectAllContacts = () => {
    if (selectedContacts.length === filteredContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(filteredContacts.map(c => c.id));
    }
  };

  // Build filter string for saving
  const currentFilters = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedType !== 'all') params.set('type', selectedType);
    if (searchQuery) params.set('q', searchQuery);
    return params.toString();
  }, [selectedType, searchQuery]);

  const filterTitle = useMemo(() => {
    const parts = ['CRM'];
    if (selectedType !== 'all') parts.push(selectedType);
    if (searchQuery) parts.push(`"${searchQuery}"`);
    return parts.join(' - ');
  }, [selectedType, searchQuery]);

  return (
    <AppLayout title="CRM" subtitle="Manage client relationships and communications">
      <DevelopmentBanner feature="Módulo CRM" className="mb-4 md:mb-6" />
      <Tabs defaultValue="contacts" className="space-y-4 md:space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="contacts" className="text-xs md:text-sm data-[state=active]:bg-card">
            <User className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
            Contacts
          </TabsTrigger>
          <TabsTrigger value="templates" className="text-xs md:text-sm data-[state=active]:bg-card">
            <Mail className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
            Email Templates
          </TabsTrigger>
          <TabsTrigger value="forms" className="text-xs md:text-sm data-[state=active]:bg-card">
            <FileText className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
            Forms
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-xs md:text-sm data-[state=active]:bg-card">
            <Clock className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
            Activity
          </TabsTrigger>
        </TabsList>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full sm:w-auto">
              <div className="relative flex-1 min-w-[180px] sm:w-56">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-muted/50 border-border text-xs md:text-sm h-8 md:h-9"
                />
              </div>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-32 md:w-40 bg-muted/50 border-border text-xs md:text-sm h-8 md:h-9">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Individual">Individual</SelectItem>
                  <SelectItem value="Company">Company</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              <SaveFilterButton
                currentPath={location.pathname}
                currentFilters={currentFilters}
                defaultTitle={filterTitle}
              />
              {selectedContacts.length > 0 && (
                <>
                  <Dialog open={isEmailOpen} onOpenChange={setIsEmailOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="text-xs md:text-sm h-8 md:h-9">
                        <Mail className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
                        Email ({selectedContacts.length})
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Send Email</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <div>
                          <Label className="text-sm">Recipients</Label>
                          <div className="flex flex-wrap gap-1 mt-1 p-2 bg-muted/30 rounded-lg">
                            {selectedContacts.map(id => {
                              const contact = mockContacts.find(c => c.id === id);
                              return contact && (
                                <Badge key={id} variant="secondary" className="text-xs">
                                  {contact.name}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="template" className="text-sm">Template (Optional)</Label>
                          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select template or write custom" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="custom">Custom Email</SelectItem>
                              {emailTemplates.map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="subject" className="text-sm">Subject</Label>
                          <Input id="subject" placeholder="Email subject" className="mt-1" />
                        </div>
                        <div>
                          <Label htmlFor="body" className="text-sm">Message</Label>
                          <Textarea 
                            id="body" 
                            placeholder="Write your message..." 
                            className="mt-1 min-h-[150px]"
                          />
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                          <Button variant="outline" onClick={() => setIsEmailOpen(false)}>Cancel</Button>
                          <Button className="bg-primary text-primary-foreground">
                            <Send className="h-4 w-4 mr-2" />
                            Send Email
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="text-xs md:text-sm h-8 md:h-9">
                        <FileText className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
                        Send Form
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Send Form to Contacts</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <div>
                          <Label className="text-sm">Selected Contacts ({selectedContacts.length})</Label>
                          <div className="flex flex-wrap gap-1 mt-1 p-2 bg-muted/30 rounded-lg">
                            {selectedContacts.map(id => {
                              const contact = mockContacts.find(c => c.id === id);
                              return contact && (
                                <Badge key={id} variant="secondary" className="text-xs">
                                  {contact.name}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="form" className="text-sm">Select Form</Label>
                          <Select>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Choose a form" />
                            </SelectTrigger>
                            <SelectContent>
                              {googleForms.map(f => (
                                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="formMessage" className="text-sm">Custom Message (Optional)</Label>
                          <Textarea 
                            id="formMessage" 
                            placeholder="Add a personal message..." 
                            className="mt-1"
                          />
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                          <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                          <Button className="bg-primary text-primary-foreground">
                            <Send className="h-4 w-4 mr-2" />
                            Send Form
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </div>
          </div>

          {/* Contacts Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-10">
                      <Checkbox 
                        checked={selectedContacts.length === filteredContacts.length && filteredContacts.length > 0}
                        onCheckedChange={selectAllContacts}
                      />
                    </th>
                    <th className="text-xs">Contact</th>
                    <th className="text-xs hidden md:table-cell">Email</th>
                    <th className="text-xs hidden lg:table-cell">Phone</th>
                    <th className="text-xs">Type</th>
                    <th className="text-xs hidden xl:table-cell">Advisor</th>
                    <th className="text-xs hidden lg:table-cell">Last Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.map((contact) => (
                    <tr key={contact.id}>
                      <td>
                        <Checkbox 
                          checked={selectedContacts.includes(contact.id)}
                          onCheckedChange={() => toggleContactSelection(contact.id)}
                        />
                      </td>
                      <td>
                        <div>
                          <p className="font-medium text-foreground text-xs md:text-sm">{contact.name}</p>
                          <p className="text-[10px] text-muted-foreground md:hidden">{contact.email}</p>
                        </div>
                      </td>
                      <td className="text-muted-foreground text-xs hidden md:table-cell">{contact.email}</td>
                      <td className="text-muted-foreground text-xs hidden lg:table-cell">{contact.phone}</td>
                      <td>
                        <Badge variant="outline" className="text-[10px]">{contact.type}</Badge>
                      </td>
                      <td className="text-muted-foreground text-xs hidden xl:table-cell">{contact.advisor}</td>
                      <td className="text-muted-foreground text-xs hidden lg:table-cell">{contact.lastContact}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Email Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm md:text-base font-semibold text-foreground">Email Templates</h3>
            <Button size="sm" className="bg-primary text-primary-foreground text-xs md:text-sm">
              <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
              New Template
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {emailTemplates.map((template) => (
              <div key={template.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-foreground text-sm">{template.name}</h4>
                  <Button variant="ghost" size="sm" className="h-7 text-xs">Edit</Button>
                </div>
                <p className="text-xs text-muted-foreground mb-2">Subject: {template.subject}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{template.body}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Forms Tab */}
        <TabsContent value="forms" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm md:text-base font-semibold text-foreground">Google Forms</h3>
            <Button size="sm" className="bg-primary text-primary-foreground text-xs md:text-sm">
              <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
              Add Form
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {googleForms.map((form) => (
              <div key={form.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <h4 className="font-medium text-foreground text-sm">{form.name}</h4>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" asChild>
                    <a href={form.url} target="_blank" rel="noopener noreferrer">
                      Open <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{form.description}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <h3 className="text-sm md:text-base font-semibold text-foreground">Recent Activity</h3>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="space-y-0 divide-y divide-border">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-center gap-3 p-4">
                  <div className={`p-2 rounded-lg ${
                    activity.type === 'email' ? 'bg-primary/20' :
                    activity.type === 'form' ? 'bg-accent/20' :
                    'bg-muted'
                  }`}>
                    {activity.type === 'email' && <Mail className="h-4 w-4 text-primary" />}
                    {activity.type === 'form' && <FileText className="h-4 w-4 text-accent-foreground" />}
                    {activity.type === 'note' && <FileText className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{activity.action}</p>
                    <p className="text-xs text-muted-foreground">{activity.contact}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{activity.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default CRM;
