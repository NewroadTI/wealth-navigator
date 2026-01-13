import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { performanceData } from '@/lib/mockData';

export function PerformanceChart() {
  return (
    <div className="metric-card h-[320px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-foreground">Performance vs Benchmark</h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-muted-foreground">Portfolio</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-accent" />
            <span className="text-muted-foreground">S&P 500</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={performanceData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 35%, 18%)" />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: 'hsl(38, 20%, 55%)' }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: 'hsl(38, 20%, 55%)' }}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(222, 47%, 13%)',
              border: '1px solid hsl(222, 35%, 22%)',
              borderRadius: '8px',
              padding: '8px 12px',
            }}
            labelStyle={{ color: 'hsl(38, 30%, 95%)', marginBottom: '4px' }}
            itemStyle={{ padding: '2px 0' }}
            formatter={(value: number) => [`${value.toFixed(2)}%`, '']}
          />
          <Line
            type="monotone"
            dataKey="portfolio"
            stroke="hsl(220, 82%, 44%)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'hsl(220, 82%, 44%)' }}
            name="Portfolio"
          />
          <Line
            type="monotone"
            dataKey="benchmark"
            stroke="hsl(38, 70%, 55%)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'hsl(38, 70%, 55%)' }}
            name="Benchmark"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}