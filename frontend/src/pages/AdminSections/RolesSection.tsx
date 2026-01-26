import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TabsContent } from '@/components/ui/tabs';
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
import { Plus, Edit, Trash2, Shield } from 'lucide-react';
import type { RoleApi } from './types';

interface RolesSectionProps {
    roles: RoleApi[];
    rolesLoading: boolean;
    usersCountByRole: Record<number, number>;
    isNewRoleOpen: boolean;
    setIsNewRoleOpen: (open: boolean) => void;
    isEditRoleOpen: boolean;
    setIsEditRoleOpen: (open: boolean) => void;
    roleDraft: { name: string; description: string };
    setRoleDraft: (draft: { name: string; description: string }) => void;
    roleActionLoading: boolean;
    roleToDelete: RoleApi | null;
    setRoleToDelete: (role: RoleApi | null) => void;
    handleCreateRole: () => void;
    handleEditRole: (role: RoleApi) => void;
    handleUpdateRole: () => void;
    handleDeleteRole: (role: RoleApi) => void;
}

const RolesSection = ({
    roles,
    rolesLoading,
    usersCountByRole,
    isNewRoleOpen,
    setIsNewRoleOpen,
    isEditRoleOpen,
    setIsEditRoleOpen,
    roleDraft,
    setRoleDraft,
    roleActionLoading,
    roleToDelete,
    setRoleToDelete,
    handleCreateRole,
    handleEditRole,
    handleUpdateRole,
    handleDeleteRole,
}: RolesSectionProps) => {
    return (
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
    );
};

export default RolesSection;
