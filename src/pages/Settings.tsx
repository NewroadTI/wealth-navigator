import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Bell, Shield, Database, Link, Clock } from 'lucide-react';

const Settings = () => {
  return (
    <AppLayout title="Settings" subtitle="Configure system preferences and integrations">
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="general" className="data-[state=active]:bg-card">
            <User className="h-4 w-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="notifications" className="data-[state=active]:bg-card">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="integrations" className="data-[state=active]:bg-card">
            <Link className="h-4 w-4 mr-2" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="data" className="data-[state=active]:bg-card">
            <Database className="h-4 w-4 mr-2" />
            Data & ETL
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-card">
            <Shield className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <div className="bg-card border border-border rounded-xl p-6 space-y-6">
            <div>
              <h3 className="font-semibold text-foreground mb-4">Organization Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Organization Name</Label>
                  <Input defaultValue="Newroad Wealth Management" className="bg-muted/50" />
                </div>
                <div className="space-y-2">
                  <Label>Default Currency</Label>
                  <Input defaultValue="USD" className="bg-muted/50" />
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-6">
              <h3 className="font-semibold text-foreground mb-4">Display Preferences</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Compact View</p>
                    <p className="text-sm text-muted-foreground">Show more data in less space</p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Show Cents</p>
                    <p className="text-sm text-muted-foreground">Display decimal values in currency</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                Save Changes
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold text-foreground mb-4">Notification Preferences</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div>
                  <p className="font-medium text-foreground">Portfolio Alerts</p>
                  <p className="text-sm text-muted-foreground">Notify on significant changes</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div>
                  <p className="font-medium text-foreground">ETL Status</p>
                  <p className="text-sm text-muted-foreground">Data sync success/failure alerts</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div>
                  <p className="font-medium text-foreground">Processing Errors</p>
                  <p className="text-sm text-muted-foreground">Alert on calculation errors</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-foreground">Daily Summary</p>
                  <p className="text-sm text-muted-foreground">End of day portfolio summary</p>
                </div>
                <Switch />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="integrations">
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold text-foreground mb-4">Custodian Integrations</h3>
            <div className="space-y-4">
              {['Interactive Brokers', 'Pershing', 'UBS'].map((custodian) => (
                <div
                  key={custodian}
                  className="flex items-center justify-between p-4 border border-border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <span className="text-sm font-semibold text-foreground">
                        {custodian.split(' ').map(w => w[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{custodian}</p>
                      <p className="text-sm text-muted-foreground">API Integration</p>
                    </div>
                  </div>
                  <Button variant="outline" className="border-border">
                    Configure
                  </Button>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-border">
              <h3 className="font-semibold text-foreground mb-4">Market Data Providers</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['OpenFIGI', 'Yahoo Finance'].map((provider) => (
                  <div
                    key={provider}
                    className="flex items-center justify-between p-4 border border-border rounded-lg"
                  >
                    <p className="font-medium text-foreground">{provider}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-success">Connected</span>
                      <div className="h-2 w-2 rounded-full bg-success"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="data">
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold text-foreground mb-4">ETL Configuration</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Auto Sync Schedule</p>
                    <p className="text-sm text-muted-foreground">Daily at 6:00 AM EST</p>
                  </div>
                </div>
                <Button variant="outline" className="border-border">
                  Edit
                </Button>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-foreground">Last Successful Sync</p>
                  <p className="text-sm text-muted-foreground">January 13, 2026 at 6:00 AM</p>
                </div>
                <span className="text-xs bg-success/20 text-success px-2 py-1 rounded">Success</span>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="security">
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold text-foreground mb-4">Security Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div>
                  <p className="font-medium text-foreground">Two-Factor Authentication</p>
                  <p className="text-sm text-muted-foreground">Require 2FA for all users</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div>
                  <p className="font-medium text-foreground">Session Timeout</p>
                  <p className="text-sm text-muted-foreground">Auto logout after 30 minutes</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-foreground">Audit Logging</p>
                  <p className="text-sm text-muted-foreground">Log all user actions</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default Settings;
