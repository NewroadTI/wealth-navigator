import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Shield, Users, Eye } from 'lucide-react';
import {
  RolesSection,
  UsersSection,
  PageAccessSection,
} from './AdminSections';
import type { RoleApi, UserApi } from './AdminSections';

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

        <RolesSection
          roles={roles}
          rolesLoading={rolesLoading}
          usersCountByRole={usersCountByRole}
          isNewRoleOpen={isNewRoleOpen}
          setIsNewRoleOpen={setIsNewRoleOpen}
          isEditRoleOpen={isEditRoleOpen}
          setIsEditRoleOpen={setIsEditRoleOpen}
          roleDraft={roleDraft}
          setRoleDraft={setRoleDraft}
          roleActionLoading={roleActionLoading}
          roleToDelete={roleToDelete}
          setRoleToDelete={setRoleToDelete}
          handleCreateRole={handleCreateRole}
          handleEditRole={handleEditRole}
          handleUpdateRole={handleUpdateRole}
          handleDeleteRole={handleDeleteRole}
        />

        <UsersSection
          users={users}
          usersLoading={usersLoading}
          roles={roles}
          isNewUserOpen={isNewUserOpen}
          setIsNewUserOpen={setIsNewUserOpen}
          isEditUserOpen={isEditUserOpen}
          setIsEditUserOpen={setIsEditUserOpen}
          userDraft={userDraft}
          setUserDraft={setUserDraft}
          userActionLoading={userActionLoading}
          userToDelete={userToDelete}
          setUserToDelete={setUserToDelete}
          handleCreateUser={handleCreateUser}
          handleEditUser={handleEditUser}
          handleUpdateUser={handleUpdateUser}
          handleDeleteUser={handleDeleteUser}
        />

        <PageAccessSection roles={roles} />
      </Tabs>
    </AppLayout>
  );
};

export default Admin;
