// ... imports
import { useState } from 'react';
import { Bell, AlertTriangle, Package, Check, X, ExternalLink, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useNotifications, ETLNotification } from '@/contexts/NotificationsContext';
import { useToast } from '@/hooks/use-toast';

function NotificationItem({
  notification,
  onMarkRead,
  onDismiss,
  onMarkJobDone
}: {
  notification: ETLNotification;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onMarkJobDone: (jobId: number) => Promise<void>;
}) {
  const [isMarkingDone, setIsMarkingDone] = useState(false);
  const { toast } = useToast();

  const handleMarkDone = async () => {
    if (!notification.data?.job_id) return;

    setIsMarkingDone(true);
    try {
      await onMarkJobDone(notification.data.job_id);
      toast({
        title: 'Job marked as done',
        description: 'This job will no longer appear in notifications',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to mark job as done',
      });
    } finally {
      setIsMarkingDone(false);
    }
  };
  const getIcon = () => {
    switch (notification.type) {
      case 'missing_assets':
        return <Package className="h-4 w-4 text-warning" />;
      case 'error':
      case 'persh_import_error':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default:
        return <Bell className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <div
      className={cn(
        "relative p-3 border-b border-border last:border-0 transition-colors",
        !notification.read && "bg-primary/5"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={cn(
              "text-sm font-medium truncate",
              !notification.read && "text-foreground",
              notification.read && "text-muted-foreground"
            )}>
              {notification.title}
            </p>
            {!notification.read && (
              <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {notification.message}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-muted-foreground">
              {(() => {
                const now = new Date();
                const notifTime = new Date(notification.timestamp);
                const diffMs = now.getTime() - notifTime.getTime();
                const diffMin = Math.floor(diffMs / (1000 * 60));
                const diffHour = Math.floor(diffMs / (1000 * 60 * 60));
                const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24));

                if (diffMin < 1) return 'Just now';
                if (diffMin < 60) return `${diffMin} min ago`;
                if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
                return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
              })()}
            </span>
            {/* Dynamic View Details buttons based on error type */}
            {notification.data?.missing_assets && notification.data.missing_assets.length > 0 && (
              <Link
                to={`/etl-job/${notification.data?.job_id}`}
                onClick={() => onMarkRead(notification.id)}
              >
                <Badge variant="outline" className="text-[10px] gap-1 cursor-pointer hover:bg-muted">
                  Asset Details ({notification.data.missing_assets.length})
                  <ExternalLink className="h-2.5 w-2.5" />
                </Badge>
              </Link>
            )}
            {notification.data?.missing_accounts && notification.data.missing_accounts.length > 0 && (
              <Link
                to={`/etl-job/${notification.data?.job_id}`} // Direct link to new page
                onClick={() => onMarkRead(notification.id)}
              >
                <Badge
                  variant="outline"
                  className="text-[10px] gap-1 cursor-pointer hover:bg-muted"
                >
                  <Users className="h-2.5 w-2.5" />
                  Account Details ({notification.data.missing_accounts.length})
                </Badge>
              </Link>
            )}
          </div>
        </div>
        {/* Simplified buttons: Check (mark done) and X (dismiss & mark done) */}
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleMarkDone}
            disabled={isMarkingDone || !notification.data?.job_id}
            title="Mark as done"
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={handleMarkDone}
            disabled={isMarkingDone || !notification.data?.job_id}
            title="Dismiss"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotification,
    markJobAsDone
  } = useNotifications();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 md:h-9 md:w-9 text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
          <span className="text-sm font-medium">Notifications</span>
        </div>

        {/* Notifications List */}
        <div className="py-8 text-center text-sm text-foreground">
          <Bell className="h-8 w-8 mx-auto mb-2 text-primary" />
          <p className="font-medium">Welcome to Newroad AI</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
