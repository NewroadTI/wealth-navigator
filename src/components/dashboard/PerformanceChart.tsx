import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
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
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 15%)" />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: 'hsl(215, 20%, 55%)' }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: 'hsl(215, 20%, 55%)' }}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(222, 47%, 10%)',
              border: '1px solid hsl(222, 30%, 18%)',
              borderRadius: '8px',
              padding: '8px 12px',
            }}
            labelStyle={{ color: 'hsl(210, 40%, 98%)', marginBottom: '4px' }}
            itemStyle={{ padding: '2px 0' }}
            formatter={(value: number) => [`${value.toFixed(2)}%`, '']}
          />
          <Line
            type="monotone"
            dataKey="portfolio"
            stroke="hsl(168, 76%, 42%)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'hsl(168, 76%, 42%)' }}
            name="Portfolio"
          />
          <Line
            type="monotone"
            dataKey="benchmark"
            stroke="hsl(43, 96%, 56%)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'hsl(43, 96%, 56%)' }}
            name="Benchmark"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
