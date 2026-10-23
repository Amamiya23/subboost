import { Database, FileCode, Link2, Server } from "lucide-react";
import { Card, CardContent } from "@subboost/ui/components/coss/compat/card";

type DashboardStatsUser = {
  isAdmin?: boolean;
  templateCount: number;
  quota: {
    maxSubscriptions: number;
    maxNodesPerSubscription: number;
    maxCustomTemplates: number;
    maxImportSourcesPerType: number;
  };
};

export function DashboardStatsCards({
  subscriptionCount,
  user,
}: {
  subscriptionCount: number;
  user: DashboardStatsUser;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary-500/20 text-primary-500">
              <FileCode className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">订阅配额</p>
              <p className="text-2xl font-bold">
                {subscriptionCount}
                <span className="text-sm font-normal text-muted-foreground">/{user.quota.maxSubscriptions}</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-info/10 text-info-foreground">
              <Server className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">节点上限配额</p>
              <p className="text-2xl font-bold">
                {user.quota.maxNodesPerSubscription}
                <span className="text-sm font-normal text-muted-foreground">/订阅</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-success/10 text-success-foreground">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">模板配额</p>
              <p className="text-2xl font-bold">
                {user.templateCount}
                <span className="text-sm font-normal text-muted-foreground">/{user.quota.maxCustomTemplates}</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-info/10 text-info-foreground">
              <Link2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">导入源配额</p>
              <p className="text-2xl font-bold">
                {user.isAdmin || user.quota.maxImportSourcesPerType >= 9999 ? "不限" : user.quota.maxImportSourcesPerType}
                <span className="text-sm font-normal text-muted-foreground">/每种</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
