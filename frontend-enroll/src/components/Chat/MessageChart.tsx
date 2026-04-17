import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { ChartSeries } from './chatTypes';

interface MessageChartProps {
  title: string;
  data: Record<string, unknown>[];
  xKey: string;
  series: ChartSeries[];
}

export function MessageChart({ title, data, xKey, series }: MessageChartProps) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--border, #e5e0d5)',
      borderRadius: 12,
      padding: '12px 4px 8px 4px',
      width: '100%',
      minWidth: 260,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text, #1b1307)', paddingLeft: 12, marginBottom: 10 }}>
        {title}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 0, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0ede6" />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 10, fill: '#8a7d65' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#8a7d65' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: '#fff',
              border: '1px solid #e5e0d5',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          {series.length > 1 && (
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
              iconSize={8}
            />
          )}
          {series.map(s => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[3, 3, 0, 0]} maxBarSize={40} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
