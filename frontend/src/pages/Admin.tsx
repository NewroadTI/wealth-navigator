import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Edit,
  Trash2,
  Shield,
  Users,
  Eye,
} from 'lucide-react';

// API Types
interface RoleApi {
  role_id: number;
  name: string;
  description: string | null;
}

interface UserApi {
  user_id: number;
  email: string;
  username: string;
  full_name: string;
  phone: string | null;
  tax_id: string | null;
  entity_type: string | null;
  is_active: boolean;
  created_at: string;
  role_id: number;
  role: RoleApi | null;
}

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
  const { toast } = useToast();
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

  // --- ROLES STATE ---
  const [roles, setRoles] = useState<RoleApi[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [isNewRoleOpen, setIsNewRoleOpen] = useState(false);
  const [isEditRoleOpen, setIsEditRoleOpen] = useState(false);
  const [roleDraft, setRoleDraft] = useState({ name: '', description: '' });
  const [editingRole, setEditingRole] = useState<RoleApi | null>(null);
  const [roleActionLoading, setRoleActionLoading] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<RoleApi | null>(null);

  // --- USERS STATE ---
  const [users, setUsers] = useState<UserApi[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [isNewUserOpen, setIsNewUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [userDraft, setUserDraft] = useState({
    email: '',
    username: '',
    full_name: '',
    phone: '',
    tax_id: '',
    entity_type: 'INDIVIDUAL',
    role_id: 0,
    password: '',
  });
  const [editingUser, setEditingUser] = useState<UserApi | null>(null);
  const [userActionLoading, setUserActionLoading] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserApi | null>(null);

  // --- Computed: count users per role ---
  const usersCountByRole = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const user of users) {
      counts[user.role_id] = (counts[user.role_id] || 0) + 1;
    }
    return counts;
  }, [users]);

  // --- FETCH ROLES ---
  const fetchRoles = async () => {
    try {
      setRolesLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/v1/roles/`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setRoles(data);
    } catch (error) {
      console.error('Error loading roles:', error);
      setRoles([]);
    } finally {
      setRolesLoading(false);
    }
  };

  // --- FETCH USERS ---
  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/v1/users/`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
    fetchUsers();
  }, [apiBaseUrl]);

  // --- ROLE CRUD ---
  const handleCreateRole = async () => {
    if (!roleDraft.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Role name is required.',
        variant: 'destructive',
      });
      return;
    }
    try {
      setRoleActionLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/v1/roles/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: roleDraft.name.trim(),
          description: roleDraft.description.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      await fetchRoles();
      setRoleDraft({ name: '', description: '' });
      setIsNewRoleOpen(false);

      toast({
        title: 'Role created',
        description: `Role "${roleDraft.name}" has been created successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: 'Error creating role',
        description: error.message || 'Could not create the role.',
        variant: 'destructive',
      });
    } finally {
      setRoleActionLoading(false);
    }
  };

  const handleEditRole = (role: RoleApi) => {
    setEditingRole(role);
    setRoleDraft({
      name: role.name,
      description: role.description || '',
    });
    setIsEditRoleOpen(true);
  };

  const handleUpdateRole = async () => {
    if (!editingRole) return;
    if (!roleDraft.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Role name is required.',
        variant: 'destructive',
      });
      return;
    }
    try {
      setRoleActionLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/v1/roles/${editingRole.role_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: roleDraft.name.trim(),
          description: roleDraft.description.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      await fetchRoles();
      setIsEditRoleOpen(false);
      setEditingRole(null);

      toast({
        title: 'Role updated',
        description: `Role "${roleDraft.name}" has been updated successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: 'Error updating role',
        description: error.message || 'Could not update the role.',
        variant: 'destructive',
      });
    } finally {
      setRoleActionLoading(false);
    }
  };

  const handleDeleteRole = async (role: RoleApi) => {
    try {
      setRoleActionLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/v1/roles/${role.role_id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      await fetchRoles();
      setRoleToDelete(null);

      toast({
        title: 'Role deleted',
        description: `Role "${role.name}" has been deleted successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: 'Error deleting role',
        description: error.message || 'Could not delete the role.',
        variant: 'destructive',
      });
    } finally {
      setRoleActionLoading(false);
    }
  };

  // --- USER CRUD ---
  const handleCreateUser = async () => {
    if (!userDraft.email.trim() || !userDraft.username.trim() || !userDraft.full_name.trim() || !userDraft.role_id || !userDraft.password.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Email, username, full name, role, and password are required.',
        variant: 'destructive',
      });
      return;
    }
    try {
      setUserActionLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/v1/users/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userDraft.email.trim(),
          username: userDraft.username.trim(),
          full_name: userDraft.full_name.trim(),
          phone: userDraft.phone.trim() || null,
          tax_id: userDraft.tax_id.trim() || null,
          entity_type: userDraft.entity_type,
          role_id: userDraft.role_id,
          password: userDraft.password,
          is_active: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      await fetchUsers();
      setUserDraft({ email: '', username: '', full_name: '', phone: '', tax_id: '', entity_type: 'INDIVIDUAL', role_id: 0, password: '' });
      setIsNewUserOpen(false);

      toast({
        title: 'User created',
        description: `User "${userDraft.full_name}" has been created successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: 'Error creating user',
        description: error.message || 'Could not create the user.',
        variant: 'destructive',
      });
    } finally {
      setUserActionLoading(false);
    }
  };

  const handleEditUser = (user: UserApi) => {
    setEditingUser(user);
    setUserDraft({
      email: user.email,
      username: user.username,
      full_name: user.full_name,
      phone: user.phone || '',
      tax_id: user.tax_id || '',
      entity_type: user.entity_type || 'INDIVIDUAL',
      role_id: user.role_id,
      password: '',
    });
    setIsEditUserOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    if (!userDraft.email.trim() || !userDraft.username.trim() || !userDraft.full_name.trim() || !userDraft.role_id) {
      toast({
        title: 'Validation Error',
        description: 'Email, username, full name, and role are required.',
        variant: 'destructive',
      });
      return;
    }
    try {
      setUserActionLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/v1/users/${editingUser.user_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userDraft.email.trim(),
          username: userDraft.username.trim(),
          full_name: userDraft.full_name.trim(),
          phone: userDraft.phone.trim() || null,
          tax_id: userDraft.tax_id.trim() || null,
          entity_type: userDraft.entity_type,
          role_id: userDraft.role_id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      await fetchUsers();
      setIsEditUserOpen(false);
      setEditingUser(null);

      toast({
        title: 'User updated',
        description: `User "${userDraft.full_name}" has been updated successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: 'Error updating user',
        description: error.message || 'Could not update the user.',
        variant: 'destructive',
      });
    } finally {
      setUserActionLoading(false);
    }
  };

  const handleDeleteUser = async (user: UserApi) => {
    try {
      setUserActionLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/v1/users/${user.user_id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      await fetchUsers();
      setUserToDelete(null);

      toast({
        title: 'User deactivated',
        description: `User "${user.full_name}" has been deactivated successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: 'Error deactivating user',
        description: error.message || 'Could not deactivate the user.',
        variant: 'destructive',
      });
    } finally {
      setUserActionLoading(false);
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
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New Role</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="roleName" className="text-sm">Role Name *</Label>
                    <Input
                      id="roleName"
                      placeholder="Analyst"
                      className="mt-1"
                      value={roleDraft.name}
                      onChange={(e) => setRoleDraft({ ...roleDraft, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="roleDesc" className="text-sm">Description</Label>
                    <Input
                      id="roleDesc"
                      placeholder="View and analyze data"
                      className="mt-1"
                      value={roleDraft.description}
                      onChange={(e) => setRoleDraft({ ...roleDraft, description: e.target.value })}
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" onClick={() => setIsNewRoleOpen(false)}>Cancel</Button>
                    <Button
                      className="bg-primary text-primary-foreground"
                      onClick={handleCreateRole}
                      disabled={roleActionLoading}
                    >
                      {roleActionLoading ? 'Creating...' : 'Create Role'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Edit Role Dialog */}
          <Dialog open={isEditRoleOpen} onOpenChange={setIsEditRoleOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Role</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="editRoleName" className="text-sm">Role Name *</Label>
                  <Input
                    id="editRoleName"
                    placeholder="Analyst"
                    className="mt-1"
                    value={roleDraft.name}
                    onChange={(e) => setRoleDraft({ ...roleDraft, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="editRoleDesc" className="text-sm">Description</Label>
                  <Input
                    id="editRoleDesc"
                    placeholder="View and analyze data"
                    className="mt-1"
                    value={roleDraft.description}
                    onChange={(e) => setRoleDraft({ ...roleDraft, description: e.target.value })}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setIsEditRoleOpen(false)}>Cancel</Button>
                  <Button
                    className="bg-primary text-primary-foreground"
                    onClick={handleUpdateRole}
                    disabled={roleActionLoading}
                  >
                    {roleActionLoading ? 'Updating...' : 'Update Role'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete Role Confirmation */}
          <AlertDialog open={!!roleToDelete} onOpenChange={(open) => !open && setRoleToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Role</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete the role "{roleToDelete?.name}"? This action cannot be undone.
                  Roles with assigned users cannot be deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => roleToDelete && handleDeleteRole(roleToDelete)}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="text-xs">Role</th>
                    <th className="text-xs">Description</th>
                    <th className="text-xs text-center">Users</th>
                    <th className="text-xs hidden md:table-cell">Permissions</th>
                    <th className="text-xs text-center w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rolesLoading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-muted-foreground">Loading roles...</td>
                    </tr>
                  ) : roles.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-muted-foreground">No roles found</td>
                    </tr>
                  ) : (
                    roles.map((role) => (
                      <tr key={role.role_id}>
                        <td className="font-medium text-foreground text-xs md:text-sm">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-primary" />
                            {role.name}
                          </div>
                        </td>
                        <td className="text-muted-foreground text-xs">{role.description || '-'}</td>
                        <td className="text-center">
                          <Badge variant="outline" className="text-xs">{usersCountByRole[role.role_id] || 0}</Badge>
                        </td>
                        <td className="hidden md:table-cell">
                          <span className="text-xs text-muted-foreground">-</span>
                        </td>
                        <td>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => handleEditRole(role)}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => setRoleToDelete(role)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
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
                      <Label htmlFor="username" className="text-sm">Username *</Label>
                      <Input
                        id="username"
                        placeholder="john.doe"
                        className="mt-1"
                        value={userDraft.username}
                        onChange={(e) => setUserDraft({ ...userDraft, username: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="fullName" className="text-sm">Full Name *</Label>
                      <Input
                        id="fullName"
                        placeholder="John Doe"
                        className="mt-1"
                        value={userDraft.full_name}
                        onChange={(e) => setUserDraft({ ...userDraft, full_name: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email" className="text-sm">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="john.doe@email.com"
                        className="mt-1"
                        value={userDraft.email}
                        onChange={(e) => setUserDraft({ ...userDraft, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone" className="text-sm">Phone</Label>
                      <Input
                        id="phone"
                        placeholder="+1234567890"
                        className="mt-1"
                        value={userDraft.phone}
                        onChange={(e) => setUserDraft({ ...userDraft, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="tax_id" className="text-sm">Tax ID</Label>
                      <Input
                        id="tax_id"
                        placeholder="TAX-001"
                        className="mt-1"
                        value={userDraft.tax_id}
                        onChange={(e) => setUserDraft({ ...userDraft, tax_id: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="entity_type" className="text-sm">Entity Type</Label>
                      <Select
                        value={userDraft.entity_type}
                        onValueChange={(value) => setUserDraft({ ...userDraft, entity_type: value })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                          <SelectItem value="CORP">Corporate</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="userRole" className="text-sm">Role *</Label>
                      <Select
                        value={userDraft.role_id ? userDraft.role_id.toString() : ''}
                        onValueChange={(value) => setUserDraft({ ...userDraft, role_id: parseInt(value) })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map(role => (
                            <SelectItem key={role.role_id} value={role.role_id.toString()}>{role.name}</SelectItem>
                          ))}
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
                        value={userDraft.password}
                        onChange={(e) => setUserDraft({ ...userDraft, password: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" onClick={() => setIsNewUserOpen(false)}>Cancel</Button>
                    <Button
                      className="bg-primary text-primary-foreground"
                      onClick={handleCreateUser}
                      disabled={userActionLoading}
                    >
                      {userActionLoading ? 'Creating...' : 'Create User'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Edit User Dialog */}
          <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="editUsername" className="text-sm">Username *</Label>
                    <Input
                      id="editUsername"
                      placeholder="john.doe"
                      className="mt-1"
                      value={userDraft.username}
                      onChange={(e) => setUserDraft({ ...userDraft, username: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editFullName" className="text-sm">Full Name *</Label>
                    <Input
                      id="editFullName"
                      placeholder="John Doe"
                      className="mt-1"
                      value={userDraft.full_name}
                      onChange={(e) => setUserDraft({ ...userDraft, full_name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="editEmail" className="text-sm">Email *</Label>
                    <Input
                      id="editEmail"
                      type="email"
                      placeholder="john.doe@email.com"
                      className="mt-1"
                      value={userDraft.email}
                      onChange={(e) => setUserDraft({ ...userDraft, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editPhone" className="text-sm">Phone</Label>
                    <Input
                      id="editPhone"
                      placeholder="+1234567890"
                      className="mt-1"
                      value={userDraft.phone}
                      onChange={(e) => setUserDraft({ ...userDraft, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="editTaxId" className="text-sm">Tax ID</Label>
                    <Input
                      id="editTaxId"
                      placeholder="TAX-001"
                      className="mt-1"
                      value={userDraft.tax_id}
                      onChange={(e) => setUserDraft({ ...userDraft, tax_id: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editEntityType" className="text-sm">Entity Type</Label>
                    <Select
                      value={userDraft.entity_type}
                      onValueChange={(value) => setUserDraft({ ...userDraft, entity_type: value })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                        <SelectItem value="CORP">Corporate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="editUserRole" className="text-sm">Role *</Label>
                  <Select
                    value={userDraft.role_id ? userDraft.role_id.toString() : ''}
                    onValueChange={(value) => setUserDraft({ ...userDraft, role_id: parseInt(value) })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map(role => (
                        <SelectItem key={role.role_id} value={role.role_id.toString()}>{role.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setIsEditUserOpen(false)}>Cancel</Button>
                  <Button
                    className="bg-primary text-primary-foreground"
                    onClick={handleUpdateUser}
                    disabled={userActionLoading}
                  >
                    {userActionLoading ? 'Updating...' : 'Update User'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete User Confirmation */}
          <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Deactivate User</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to deactivate the user "{userToDelete?.full_name}"?
                  The user will be marked as inactive but not deleted from the system.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => userToDelete && handleDeleteUser(userToDelete)}
                >
                  Deactivate
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="text-xs">User</th>
                    <th className="text-xs hidden md:table-cell">Email</th>
                    <th className="text-xs">Role</th>
                    <th className="text-xs text-center">Status</th>
                    <th className="text-xs text-center w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersLoading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-muted-foreground">Loading users...</td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-muted-foreground">No users found</td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.user_id}>
                        <td>
                          <div>
                            <p className="font-medium text-foreground text-xs md:text-sm">{user.full_name}</p>
                            <p className="text-[10px] text-muted-foreground">@{user.username}</p>
                          </div>
                        </td>
                        <td className="text-muted-foreground text-xs hidden md:table-cell">{user.email}</td>
                        <td>
                          <Badge variant="outline" className="text-xs">{user.role?.name || 'Unknown'}</Badge>
                        </td>
                        <td className="text-center">
                          {user.is_active ? (
                            <Badge className="text-[10px] bg-gain/20 text-gain border-gain/30">Active</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-muted/50">Inactive</Badge>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => handleEditUser(user)}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => setUserToDelete(user)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
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
                    // For now, show all roles since permissions are not implemented
                    const accessibleRoles = roles.filter(role =>
                      role.name === 'ADMIN' ||
                      page.permissions.some(p => p.includes('view'))
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
                              <Badge key={role.role_id} variant="outline" className="text-[10px]">{role.name}</Badge>
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
