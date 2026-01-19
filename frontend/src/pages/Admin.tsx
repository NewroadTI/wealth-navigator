import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  Edit,
  Trash2,
  Shield,
  Users,
  Key,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';

// Mock roles
const mockRoles = [
  { 
    id: 'R001', 
    name: 'Admin', 
    description: 'Full system access',
    usersCount: 2,
    permissions: ['all'] 
  },
  { 
    id: 'R002', 
    name: 'Advisor', 
    description: 'View and manage assigned portfolios',
    usersCount: 5,
    permissions: ['portfolio:view', 'portfolio:edit', 'transactions:view', 'positions:view', 'reports:view'] 
  },
  { 
    id: 'R003', 
    name: 'Investor', 
    description: 'View own portfolio data',
    usersCount: 15,
    permissions: ['portfolio:view', 'transactions:view', 'positions:view'] 
  },
  { 
    id: 'R004', 
    name: 'Compliance', 
    description: 'Audit and compliance oversight',
    usersCount: 3,
    permissions: ['audit:view', 'reports:view', 'portfolio:view', 'transactions:view'] 
  },
  { 
    id: 'R005', 
    name: 'Trader', 
    description: 'Execute trades and manage positions',
    usersCount: 4,
    permissions: ['trades:execute', 'positions:view', 'positions:edit', 'transactions:view', 'transactions:create'] 
  },
];

// Mock permissions organized by category
const permissionCategories = {
  'Dashboard': [
    { slug: 'dashboard:view', description: 'View dashboard' },
    { slug: 'dashboard:analytics', description: 'View analytics' },
  ],
  'Portfolios': [
    { slug: 'portfolio:view', description: 'View portfolios' },
    { slug: 'portfolio:create', description: 'Create portfolios' },
    { slug: 'portfolio:edit', description: 'Edit portfolios' },
    { slug: 'portfolio:delete', description: 'Delete portfolios' },
  ],
  'Positions': [
    { slug: 'positions:view', description: 'View positions' },
    { slug: 'positions:edit', description: 'Edit positions' },
  ],
  'Transactions': [
    { slug: 'transactions:view', description: 'View transactions' },
    { slug: 'transactions:create', description: 'Create transactions' },
    { slug: 'transactions:edit', description: 'Edit transactions' },
  ],
  'Assets': [
    { slug: 'assets:view', description: 'View assets' },
    { slug: 'assets:create', description: 'Create assets' },
    { slug: 'assets:edit', description: 'Edit assets' },
  ],
  'Trades': [
    { slug: 'trades:view', description: 'View trades' },
    { slug: 'trades:execute', description: 'Execute trades' },
  ],
  'Reports': [
    { slug: 'reports:view', description: 'View reports' },
    { slug: 'reports:export', description: 'Export reports' },
  ],
  'CRM': [
    { slug: 'crm:view', description: 'View CRM' },
    { slug: 'crm:edit', description: 'Edit CRM data' },
    { slug: 'crm:email', description: 'Send emails' },
  ],
  'Admin': [
    { slug: 'admin:view', description: 'View admin panel' },
    { slug: 'admin:users', description: 'Manage users' },
    { slug: 'admin:roles', description: 'Manage roles' },
    { slug: 'audit:view', description: 'View audit logs' },
  ],
};

// Mock users
const mockUsers = [
  { id: 'U001', username: 'admin', fullName: 'Newroad Admin', email: 'admin@newroad.com', role: 'Admin', isActive: true, lastLogin: '2024-01-12 10:45' },
  { id: 'U002', username: 'sarah.chen', fullName: 'Sarah Chen', email: 'sarah.chen@newroad.com', role: 'Advisor', isActive: true, lastLogin: '2024-01-12 09:30' },
  { id: 'U003', username: 'michael.torres', fullName: 'Michael Torres', email: 'michael.torres@newroad.com', role: 'Advisor', isActive: true, lastLogin: '2024-01-11 16:20' },
  { id: 'U004', username: 'james.morrison', fullName: 'James Morrison', email: 'james.morrison@email.com', role: 'Investor', isActive: true, lastLogin: '2024-01-10 14:15' },
  { id: 'U005', username: 'compliance.officer', fullName: 'John Smith', email: 'john.smith@newroad.com', role: 'Compliance', isActive: true, lastLogin: '2024-01-12 08:00' },
  { id: 'U006', username: 'trader1', fullName: 'Alex Johnson', email: 'alex.johnson@newroad.com', role: 'Trader', isActive: false, lastLogin: '2024-01-05 12:30' },
];

// Page visibility based on roles
const pagePermissions = [
  { page: 'Dashboard', path: '/', permissions: ['dashboard:view'] },
  { page: 'Portfolios', path: '/portfolios', permissions: ['portfolio:view'] },
  { page: 'Portfolio Performance', path: '/portfolios/:id/performance', permissions: ['portfolio:view'] },
  { page: 'Positions', path: '/positions', permissions: ['positions:view'] },
  { page: 'Transactions', path: '/transactions', permissions: ['transactions:view'] },
  { page: 'Assets', path: '/assets', permissions: ['assets:view'] },
  { page: 'Advisors', path: '/advisors', permissions: ['portfolio:view'] },
  { page: 'CRM', path: '/crm', permissions: ['crm:view'] },
  { page: 'Reports', path: '/reports', permissions: ['reports:view'] },
  { page: 'Basic Data', path: '/basic-data', permissions: ['admin:view'] },
  { page: 'Admin', path: '/admin', permissions: ['admin:view'] },
  { page: 'Settings', path: '/settings', permissions: ['dashboard:view'] },
];

const Admin = () => {
  const [isNewRoleOpen, setIsNewRoleOpen] = useState(false);
  const [isNewUserOpen, setIsNewUserOpen] = useState(false);
  const [selectedRolePermissions, setSelectedRolePermissions] = useState<string[]>([]);

  const togglePermission = (slug: string) => {
    setSelectedRolePermissions(prev => 
      prev.includes(slug) 
        ? prev.filter(p => p !== slug)
        : [...prev, slug]
    );
  };

  const toggleCategory = (category: string) => {
    const categoryPerms = permissionCategories[category as keyof typeof permissionCategories].map(p => p.slug);
    const allSelected = categoryPerms.every(p => selectedRolePermissions.includes(p));
    
    if (allSelected) {
      setSelectedRolePermissions(prev => prev.filter(p => !categoryPerms.includes(p)));
    } else {
      setSelectedRolePermissions(prev => [...new Set([...prev, ...categoryPerms])]);
    }
  };

  return (
    <AppLayout title="Administration" subtitle="Manage roles, permissions, and users">
      <Tabs defaultValue="roles" className="space-y-4 md:space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="roles" className="text-xs md:text-sm data-[state=active]:bg-card">
            <Shield className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="users" className="text-xs md:text-sm data-[state=active]:bg-card">
            <Users className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
            Users
          </TabsTrigger>
          <TabsTrigger value="pages" className="text-xs md:text-sm data-[state=active]:bg-card">
            <Eye className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
            Page Access
          </TabsTrigger>
        </TabsList>

        {/* Roles Tab */}
        <TabsContent value="roles" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm md:text-base font-semibold text-foreground">Role Management</h3>
            <Dialog open={isNewRoleOpen} onOpenChange={setIsNewRoleOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-primary text-primary-foreground text-xs md:text-sm">
                  <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
                  New Role
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Role</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="roleName" className="text-sm">Role Name</Label>
                      <Input id="roleName" placeholder="Analyst" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="roleDesc" className="text-sm">Description</Label>
                      <Input id="roleDesc" placeholder="View and analyze data" className="mt-1" />
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm mb-3 block">Permissions</Label>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto border border-border rounded-lg p-4">
                      {Object.entries(permissionCategories).map(([category, perms]) => {
                        const categoryPerms = perms.map(p => p.slug);
                        const allSelected = categoryPerms.every(p => selectedRolePermissions.includes(p));
                        const someSelected = categoryPerms.some(p => selectedRolePermissions.includes(p));
                        
                        return (
                          <div key={category} className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Checkbox 
                                checked={allSelected}
                                onCheckedChange={() => toggleCategory(category)}
                                className={someSelected && !allSelected ? 'opacity-50' : ''}
                              />
                              <span className="text-sm font-medium text-foreground">{category}</span>
                            </div>
                            <div className="ml-6 grid grid-cols-2 gap-2">
                              {perms.map(perm => (
                                <div key={perm.slug} className="flex items-center gap-2">
                                  <Checkbox 
                                    checked={selectedRolePermissions.includes(perm.slug)}
                                    onCheckedChange={() => togglePermission(perm.slug)}
                                  />
                                  <span className="text-xs text-muted-foreground">{perm.description}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" onClick={() => setIsNewRoleOpen(false)}>Cancel</Button>
                    <Button className="bg-primary text-primary-foreground">Create Role</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="text-xs">Role</th>
                    <th className="text-xs">Description</th>
                    <th className="text-xs text-center">Users</th>
                    <th className="text-xs hidden md:table-cell">Permissions</th>
                    <th className="text-xs text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mockRoles.map((role) => (
                    <tr key={role.id}>
                      <td className="font-medium text-foreground text-xs md:text-sm">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-primary" />
                          {role.name}
                        </div>
                      </td>
                      <td className="text-muted-foreground text-xs">{role.description}</td>
                      <td className="text-center">
                        <Badge variant="outline" className="text-xs">{role.usersCount}</Badge>
                      </td>
                      <td className="hidden md:table-cell">
                        <div className="flex flex-wrap gap-1 max-w-[300px]">
                          {role.permissions.slice(0, 3).map(p => (
                            <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>
                          ))}
                          {role.permissions.length > 3 && (
                            <Badge variant="outline" className="text-[10px]">+{role.permissions.length - 3}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm md:text-base font-semibold text-foreground">User Management</h3>
            <Dialog open={isNewUserOpen} onOpenChange={setIsNewUserOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-primary text-primary-foreground text-xs md:text-sm">
                  <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
                  New User
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="username" className="text-sm">Username</Label>
                      <Input id="username" placeholder="john.doe" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="fullName" className="text-sm">Full Name</Label>
                      <Input id="fullName" placeholder="John Doe" className="mt-1" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email" className="text-sm">Email</Label>
                      <Input id="email" type="email" placeholder="john.doe@email.com" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="userRole" className="text-sm">Role</Label>
                      <Select>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {mockRoles.map(role => (
                            <SelectItem key={role.id} value={role.name}>{role.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="password" className="text-sm">Initial Password</Label>
                    <Input id="password" type="password" placeholder="••••••••" className="mt-1" />
                    <p className="text-xs text-muted-foreground mt-1">User will be required to change on first login</p>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" onClick={() => setIsNewUserOpen(false)}>Cancel</Button>
                    <Button className="bg-primary text-primary-foreground">Create User</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="text-xs">User</th>
                    <th className="text-xs hidden md:table-cell">Email</th>
                    <th className="text-xs">Role</th>
                    <th className="text-xs text-center">Status</th>
                    <th className="text-xs hidden lg:table-cell">Last Login</th>
                    <th className="text-xs text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mockUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div>
                          <p className="font-medium text-foreground text-xs md:text-sm">{user.fullName}</p>
                          <p className="text-[10px] text-muted-foreground">@{user.username}</p>
                        </div>
                      </td>
                      <td className="text-muted-foreground text-xs hidden md:table-cell">{user.email}</td>
                      <td>
                        <Badge variant="outline" className="text-xs">{user.role}</Badge>
                      </td>
                      <td className="text-center">
                        {user.isActive ? (
                          <Badge className="text-[10px] bg-gain/20 text-gain border-gain/30">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-muted/50">Inactive</Badge>
                        )}
                      </td>
                      <td className="text-muted-foreground text-xs hidden lg:table-cell">{user.lastLogin}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <Key className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            {user.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Page Access Tab */}
        <TabsContent value="pages" className="space-y-4">
          <div>
            <h3 className="text-sm md:text-base font-semibold text-foreground mb-2">Page Access Matrix</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Shows which roles can access each page based on their permissions
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="text-xs">Page</th>
                    <th className="text-xs hidden md:table-cell">Path</th>
                    <th className="text-xs">Required Permission</th>
                    <th className="text-xs hidden lg:table-cell">Accessible By</th>
                  </tr>
                </thead>
                <tbody>
                  {pagePermissions.map((page) => {
                    const accessibleRoles = mockRoles.filter(role => 
                      role.permissions.includes('all') || 
                      page.permissions.some(p => role.permissions.includes(p))
                    );
                    
                    return (
                      <tr key={page.path}>
                        <td className="font-medium text-foreground text-xs md:text-sm">{page.page}</td>
                        <td className="text-muted-foreground text-xs mono hidden md:table-cell">{page.path}</td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {page.permissions.map(p => (
                              <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="hidden lg:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {accessibleRoles.map(role => (
                              <Badge key={role.id} variant="outline" className="text-[10px]">{role.name}</Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default Admin;
