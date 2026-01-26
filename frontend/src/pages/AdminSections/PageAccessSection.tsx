import { Badge } from '@/components/ui/badge';
import { TabsContent } from '@/components/ui/tabs';
import type { RoleApi } from './types';
import { pagePermissions } from './types';

interface PageAccessSectionProps {
    roles: RoleApi[];
}

const PageAccessSection = ({ roles }: PageAccessSectionProps) => {
    return (
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
    );
};

export default PageAccessSection;
