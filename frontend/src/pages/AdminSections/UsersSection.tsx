import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Plus, Edit, Trash2 } from 'lucide-react';
import type { RoleApi, UserApi } from './types';

interface UserDraft {
    email: string;
    username: string;
    full_name: string;
    phone: string;
    tax_id: string;
    entity_type: string;
    role_id: number;
    password: string;
}

interface UsersSectionProps {
    users: UserApi[];
    usersLoading: boolean;
    roles: RoleApi[];
    isNewUserOpen: boolean;
    setIsNewUserOpen: (open: boolean) => void;
    isEditUserOpen: boolean;
    setIsEditUserOpen: (open: boolean) => void;
    userDraft: UserDraft;
    setUserDraft: (draft: UserDraft) => void;
    userActionLoading: boolean;
    userToDelete: UserApi | null;
    setUserToDelete: (user: UserApi | null) => void;
    handleCreateUser: () => void;
    handleEditUser: (user: UserApi) => void;
    handleUpdateUser: () => void;
    handleDeleteUser: (user: UserApi) => void;
}

const UsersSection = ({
    users,
    usersLoading,
    roles,
    isNewUserOpen,
    setIsNewUserOpen,
    isEditUserOpen,
    setIsEditUserOpen,
    userDraft,
    setUserDraft,
    userActionLoading,
    userToDelete,
    setUserToDelete,
    handleCreateUser,
    handleEditUser,
    handleUpdateUser,
    handleDeleteUser,
}: UsersSectionProps) => {
    return (
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
    );
};

export default UsersSection;
