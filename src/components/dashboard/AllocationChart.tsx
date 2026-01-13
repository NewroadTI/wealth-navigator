import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { assetAllocation } from '@/lib/mockData';

export function AllocationChart() {
  return (
    <div className="metric-card h-[320px]">
      <h3 className="text-sm font-medium text-foreground mb-4">Asset Allocation</h3>
      <ResponsiveContainer width="100%" height="85%">
        <PieChart>
          <Pie
            data={assetAllocation}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {assetAllocation.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(222, 47%, 10%)',
              border: '1px solid hsl(222, 30%, 18%)',
              borderRadius: '8px',
              padding: '8px 12px',
            }}
            itemStyle={{ color: 'hsl(210, 40%, 98%)' }}
            formatter={(value: number) => [`${value}%`, '']}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => (
              <span className="text-xs text-muted-foreground">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
