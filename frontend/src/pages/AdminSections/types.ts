// Shared types for Admin sections

export interface RoleApi {
    role_id: number;
    name: string;
    description: string | null;
}

export interface UserApi {
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
export const pagePermissions = [
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
