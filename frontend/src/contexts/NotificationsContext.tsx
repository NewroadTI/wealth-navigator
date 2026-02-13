import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getApiBaseUrl } from '@/lib/config';

export interface MissingAsset {
  symbol: string;
  security_id: string;
  isin: string;
  description: string;
  currency: string;
  asset_class: string;
  asset_type: string;
  quantity: string;
  position_value: string;
  mark_price: string;
  reason: string;
}

export interface ETLNotification {
  id: string;
  type: 'missing_assets' | 'error' | 'warning' | 'info' | 'persh_import_error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  data?: {
    job_id?: number;
    job_type?: string;
    missing_assets?: MissingAsset[];
    missing_accounts?: Array<{ account_code: string; reason: string }>;
    filename?: string;  // For Pershing imports
  };
}

interface NotificationsContextType {
  notifications: ETLNotification[];
  unreadCount: number;
  missingAssets: MissingAsset[];
  loading: boolean;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
  refreshNotifications: () => Promise<void>;
  addNotification: (notification: Omit<ETLNotification, 'id' | 'timestamp' | 'read'>) => void;
  markJobAsDone: (jobId: number) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<ETLNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchETLNotifications = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch latest ETL jobs that are NOT done (filter by done=false)
      const response = await fetch(`${getApiBaseUrl()}/api/v1/etl/jobs?limit=50`);
      if (!response.ok) return;

      const jobs = await response.json();
      const newNotifications: ETLNotification[] = [];

      for (const job of jobs) {
        // Skip jobs that are already marked as done
        if (job.done) continue;

        // Check for missing assets
        if (job.extra_data?.missing_assets && job.extra_data.missing_assets.length > 0) {
          const existingNotification = notifications.find(
            n => n.data?.job_id === job.job_id && n.type === 'missing_assets'
          );

          newNotifications.push({
            id: `job-${job.job_id}-missing-assets`,
            type: 'missing_assets',
            title: `${job.extra_data.missing_assets.length} Assets Not Found`,
            message: `ETL job "${job.job_name}" completed with ${job.extra_data.missing_assets.length} missing assets that need to be created.`,
            timestamp: job.completed_at || job.started_at,
            read: existingNotification?.read || false,
            data: {
              job_id: job.job_id,
              job_type: job.job_type,
              missing_assets: job.extra_data.missing_assets,
              missing_accounts: job.extra_data.missing_accounts,
            },
          });
        }

        // Check for missing accounts
        if (job.extra_data?.missing_accounts && job.extra_data.missing_accounts.length > 0) {
          const existingNotification = notifications.find(
            n => n.data?.job_id === job.job_id && n.type === 'persh_import_error'
          );

          newNotifications.push({
            id: `job-${job.job_id}-missing-accounts`,
            type: 'persh_import_error',
            title: `${job.extra_data.missing_accounts.length} Accounts Not Found`,
            message: `ETL job "${job.job_name}" found ${job.extra_data.missing_accounts.length} transactions for unknown accounts.`,
            timestamp: job.completed_at || job.started_at,
            read: existingNotification?.read || false,
            data: {
              job_id: job.job_id,
              job_type: job.job_type,
              missing_accounts: job.extra_data.missing_accounts,
              filename: job.file_name
            },
          });
        }

        // Check for failed/partial jobs
        if ((job.status === 'failed' || job.status === 'partial') && job.error_message) {
          const existingNotification = notifications.find(
            n => n.data?.job_id === job.job_id && n.type === 'error'
          );

          newNotifications.push({
            id: `job-${job.job_id}-error`,
            type: 'error',
            title: job.status === 'partial' ? `ETL Job Completed with Warnings` : `ETL Job Failed`,
            message: job.error_message,
            timestamp: job.completed_at || job.started_at,
            read: existingNotification?.read || false,
            data: {
              job_id: job.job_id,
              job_type: job.job_type,
              missing_accounts: job.extra_data?.missing_accounts,
            },
          });
        }
      }

      // Sort by timestamp descending
      newNotifications.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setNotifications(newNotifications);
    } catch (error) {
      console.error('Failed to fetch ETL notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [notifications]);

  // Initial fetch
  useEffect(() => {
    fetchETLNotifications();
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const refreshNotifications = useCallback(async () => {
    await fetchETLNotifications();
  }, [fetchETLNotifications]);

  // Add a new notification (for Pershing imports and other manual additions)
  const addNotification = useCallback((notification: Omit<ETLNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: ETLNotification = {
      ...notification,
      id: `manual-${Date.now()}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications(prev => [newNotification, ...prev]);
  }, []);

  const markJobAsDone = useCallback(async (jobId: number) => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/etl/jobs/${jobId}/mark-done`, {
        method: 'PATCH',
      });
      if (!response.ok) {
        throw new Error('Failed to mark job as done');
      }
      // Remove notifications associated with this job
      setNotifications(prev => prev.filter(n => n.data?.job_id !== jobId));
    } catch (error) {
      console.error('Failed to mark job as done:', error);
      throw error;
    }
  }, []);

  // Aggregate all missing assets from recent notifications
  const missingAssets = notifications
    .filter(n => n.type === 'missing_assets' && !n.read)
    .flatMap(n => n.data?.missing_assets || []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        missingAssets,
        loading,
        markAsRead,
        markAllAsRead,
        clearNotification,
        refreshNotifications,
        addNotification,
        markJobAsDone,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
}
