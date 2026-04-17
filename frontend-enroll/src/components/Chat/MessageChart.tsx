import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { ChartSeries } from './chatTypes';

const PALETTE = [
  '#f3c13a', '#ff904e', '#4a90d9', '#27ae60',
  '#9b59b6', '#e74c3c', '#1abc9c', '#e67e22',
];

interface MessageChartProps {
  title: string;
  chartType: 'bar' | 'line' | 'pie';
  data: Record<string, unknown>[];
  xKey: string;
  series: ChartSeries[];
}

const tooltipStyle = {
  background: '#fff',
  border: '1px solid #e5e0d5',
  borderRadius: 8,
  fontSize: 12,
};

export function MessageChart({ title, chartType, data, xKey, series }: MessageChartProps) {
  const renderChart = () => {
    if (chartType === 'pie') {
      const dataKey = series[0]?.key ?? 'value';
      return (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              dataKey={dataKey}
              nameKey={xKey}
              cx="50%"
              cy="45%"
              outerRadius={70}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [v, n]} />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
              iconSize={10}
              formatter={(value) => <span style={{ color: '#1b1307' }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ede6" />
            <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#8a7d65' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#8a7d65' }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconSize={8} />
            {series.map((s, i) => (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stroke={s.color || PALETTE[i % PALETTE.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    // Bar chart — single series gets per-bar colors, multi-series keeps series colors
    const isSingleSeries = series.length === 1;
    return (
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0ede6" />
          <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#8a7d65' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#8a7d65' }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconSize={8} />
          {series.map((s, si) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color || PALETTE[si % PALETTE.length]} radius={[3, 3, 0, 0]} maxBarSize={40}>
              {isSingleSeries && data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--border, #e5e0d5)',
      borderRadius: 12,
      padding: '12px 4px 8px 4px',
      width: '100%',
      minWidth: 260,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text, #1b1307)', paddingLeft: 12, marginBottom: 8 }}>
        {title}
      </div>
      {renderChart()}
    </div>
  );
}
