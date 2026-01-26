import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Mail, Phone, ChevronDown, ChevronRight, Briefcase } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

// Types
type UserApi = {
  user_id: number;
  username: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  tax_id: string | null;
  entity_type: string | null;
  is_active: boolean;
  role_id: number;
  role?: {
    role_id: number;
    name: string;
    description: string | null;
  };
};

type RoleApi = {
  role_id: number;
  name: string;
  description: string | null;
};

const Advisors = () => {
  const [expandedAdvisors, setExpandedAdvisors] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

  // State
  const [advisors, setAdvisors] = useState<UserApi[]>([]);
  const [advisorsLoading, setAdvisorsLoading] = useState(true);
  const [roles, setRoles] = useState<RoleApi[]>([]);

  // New Advisor Dialog state
  const [isNewAdvisorOpen, setIsNewAdvisorOpen] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    email: '',
    phone: '',
    tax_id: '',
    password: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const toggleAdvisor = (advisorId: number) => {
    setExpandedAdvisors((prev) =>
      prev.includes(advisorId)
        ? prev.filter((id) => id !== advisorId)
        : [...prev, advisorId]
    );
  };

  // Load advisors
  useEffect(() => {
    const loadAdvisors = async () => {
      try {
        setAdvisorsLoading(true);
        const response = await fetch(`${apiBaseUrl}/api/v1/users/advisors`);
        if (!response.ok) throw new Error('Failed to load advisors');
        const data = await response.json();
        setAdvisors(data);
      } catch (error) {
        console.error('Error loading advisors:', error);
      } finally {
        setAdvisorsLoading(false);
      }
    };
    loadAdvisors();
  }, [apiBaseUrl]);

  // Load roles (to get ADVISOR role_id)
  useEffect(() => {
    const loadRoles = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/roles/`);
        if (!response.ok) throw new Error('Failed to load roles');
        const data = await response.json();
        setRoles(data);
      } catch (error) {
        console.error('Error loading roles:', error);
      }
    };
    loadRoles();
  }, [apiBaseUrl]);

  // Get ADVISOR role_id
  const advisorRoleId = roles.find(r => r.name === 'ADVISOR')?.role_id || 0;

  // Filter advisors by search
  const filteredAdvisors = advisors.filter(advisor => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      advisor.full_name?.toLowerCase().includes(query) ||
      advisor.email?.toLowerCase().includes(query) ||
      advisor.username.toLowerCase().includes(query)
    );
  });

  // Create advisor handler
  const handleCreateAdvisor = async () => {
    if (!formData.email.trim() || !formData.username.trim() || !formData.full_name.trim() || !formData.password.trim()) {
      setFormError('Email, username, full name, and password are required.');
      return;
    }

    if (!advisorRoleId) {
      setFormError('ADVISOR role not found. Please create it first in Admin.');
      return;
    }

    try {
      setFormLoading(true);
      setFormError(null);

      const response = await fetch(`${apiBaseUrl}/api/v1/users/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email.trim(),
          username: formData.username.trim(),
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim() || null,
          tax_id: formData.tax_id.trim() || null,
          entity_type: 'INDIVIDUAL',
          role_id: advisorRoleId,
          password: formData.password,
          is_active: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const newAdvisor = await response.json();
      setAdvisors(prev => [...prev, newAdvisor]);
      setIsNewAdvisorOpen(false);
      setFormData({
        username: '',
        full_name: '',
        email: '',
        phone: '',
        tax_id: '',
        password: '',
      });

      toast({
        title: 'Advisor created',
        description: `Advisor "${newAdvisor.full_name}" has been created successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      setFormError(error.message || 'Could not create advisor.');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <AppLayout title="Advisors" subtitle="Manage financial advisors and assignments">
      {/* Actions Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search advisors..."
            className="pl-9 bg-muted/50 border-border"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Dialog open={isNewAdvisorOpen} onOpenChange={(open) => {
          setIsNewAdvisorOpen(open);
          if (!open) {
            setFormError(null);
            setFormData({
              username: '',
              full_name: '',
              email: '',
              phone: '',
              tax_id: '',
              password: '',
            });
          }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Add Advisor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Advisor</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {formError && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="username" className="text-sm">Username *</Label>
                  <Input
                    id="username"
                    placeholder="sarah.chen"
                    className="mt-1"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="fullName" className="text-sm">Full Name *</Label>
                  <Input
                    id="fullName"
                    placeholder="Sarah Chen"
                    className="mt-1"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email" className="text-sm">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="sarah.chen@example.com"
                    className="mt-1"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="phone" className="text-sm">Phone</Label>
                  <Input
                    id="phone"
                    placeholder="+1234567890"
                    className="mt-1"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tax_id" className="text-sm">Tax ID</Label>
                  <Input
                    id="tax_id"
                    placeholder="TAX-ADV-001"
                    className="mt-1"
                    value={formData.tax_id}
                    onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="entity_type" className="text-sm">Entity Type</Label>
                  <Select value="INDIVIDUAL" disabled>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Individual" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="role" className="text-sm">Role</Label>
                  <Select value="ADVISOR" disabled>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Advisor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADVISOR">Advisor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="password" className="text-sm">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Password"
                    className="mt-1"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button variant="outline" onClick={() => setIsNewAdvisorOpen(false)}>Cancel</Button>
                <Button
                  className="bg-primary text-primary-foreground"
                  onClick={handleCreateAdvisor}
                  disabled={formLoading}
                >
                  {formLoading ? 'Creating...' : 'Create Advisor'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Loading state */}
      {advisorsLoading && (
        <div className="text-center py-12 text-muted-foreground">Loading advisors...</div>
      )}

      {/* Empty state */}
      {!advisorsLoading && filteredAdvisors.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          {searchQuery ? 'No advisors match your search.' : 'No advisors found. Create your first advisor!'}
        </div>
      )}

      {/* Advisors List */}
      {!advisorsLoading && filteredAdvisors.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-muted/30 border-b border-border text-sm font-medium text-muted-foreground">
            <div className="col-span-1"></div>
            <div className="col-span-3">Advisor</div>
            <div className="col-span-4">Contact</div>
            <div className="col-span-2">Portfolios</div>
            <div className="col-span-2"></div>
          </div>

          {/* Advisor Rows */}
          {filteredAdvisors.map((advisor) => {
            const isExpanded = expandedAdvisors.includes(advisor.user_id);
            // Mockup: Random portfolio count
            const portfolioCount = Math.floor(Math.random() * 5) + 1;

            return (
              <Collapsible
                key={advisor.user_id}
                open={isExpanded}
                onOpenChange={() => toggleAdvisor(advisor.user_id)}
              >
                <CollapsibleTrigger asChild>
                  <div className="grid grid-cols-12 gap-4 px-5 py-4 items-center border-b border-border hover:bg-muted/20 cursor-pointer transition-colors">
                    <div className="col-span-1">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="col-span-3 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-semibold text-primary">
                          {advisor.full_name?.split(' ').map((n) => n[0]).join('') || '?'}
                        </span>
                      </div>
                      <span className="font-medium text-foreground">{advisor.full_name || advisor.username}</span>
                    </div>
                    <div className="col-span-4 space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate">{advisor.email || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        <span>{advisor.phone || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-foreground">{portfolioCount}</span>
                    </div>
                    <div className="col-span-2"></div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="bg-muted/10 border-b border-border">
                    <div className="px-10 py-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-muted-foreground">
                          Managed Portfolios
                        </h4>
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          <Plus className="h-3 w-3 mr-1" />
                          Assign Portfolio
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground py-2">
                        Portfolio assignments coming soon.
                      </p>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
};

export default Advisors;
