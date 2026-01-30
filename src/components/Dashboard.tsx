import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Plus, X, GripVertical, BarChart3, LineChartIcon, PieChartIcon, TrendingUp } from "lucide-react";

// Chart color palette using CSS variable-friendly colors
const COLORS = [
  "oklch(0.6 0.18 250)", // primary blue
  "oklch(0.7 0.15 145)", // green
  "oklch(0.75 0.12 65)",  // orange/yellow
  "oklch(0.7 0.14 300)", // purple
  "oklch(0.65 0.2 25)",   // red
  "oklch(0.7 0.12 200)", // cyan
];

interface ChartData {
  [key: string]: string | number;
}

interface Widget {
  id: string;
  type: "line" | "bar" | "pie" | "area" | "stat";
  title: string;
  data: ChartData[];
  dataKey?: string;
  xAxisKey?: string;
  width?: 1 | 2;
  statValue?: string;
  statLabel?: string;
  statChange?: number;
}

interface DashboardConfig {
  title: string;
  widgets: Widget[];
}

interface DashboardProps {
  content: string;
  onChange?: (content: string) => void;
  readOnly?: boolean;
}

// Parse dashboard config from markdown/JSON
function parseDashboardConfig(content: string): DashboardConfig | null {
  try {
    // Try parsing as JSON first
    if (content.trim().startsWith("{")) {
      return JSON.parse(content);
    }

    // Try extracting JSON from markdown code block
    const jsonMatch = content.match(/```(?:json|dashboard)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }

    return null;
  } catch (e) {
    console.error("Failed to parse dashboard config:", e);
    return null;
  }
}

// Sample dashboard for new files
const SAMPLE_DASHBOARD: DashboardConfig = {
  title: "My Dashboard",
  widgets: [
    {
      id: "1",
      type: "stat",
      title: "Total Revenue",
      data: [],
      statValue: "$45,231",
      statLabel: "Revenue this month",
      statChange: 12.5,
      width: 1,
    },
    {
      id: "2",
      type: "stat",
      title: "Active Users",
      data: [],
      statValue: "2,345",
      statLabel: "Users online now",
      statChange: -3.2,
      width: 1,
    },
    {
      id: "3",
      type: "line",
      title: "Revenue Over Time",
      xAxisKey: "month",
      dataKey: "revenue",
      width: 2,
      data: [
        { month: "Jan", revenue: 4000, expenses: 2400 },
        { month: "Feb", revenue: 3000, expenses: 1398 },
        { month: "Mar", revenue: 2000, expenses: 9800 },
        { month: "Apr", revenue: 2780, expenses: 3908 },
        { month: "May", revenue: 1890, expenses: 4800 },
        { month: "Jun", revenue: 2390, expenses: 3800 },
      ],
    },
    {
      id: "4",
      type: "bar",
      title: "Sales by Category",
      xAxisKey: "category",
      dataKey: "sales",
      width: 1,
      data: [
        { category: "Electronics", sales: 4000 },
        { category: "Clothing", sales: 3000 },
        { category: "Food", sales: 2000 },
        { category: "Books", sales: 2780 },
      ],
    },
    {
      id: "5",
      type: "pie",
      title: "Market Share",
      dataKey: "value",
      width: 1,
      data: [
        { name: "Product A", value: 400 },
        { name: "Product B", value: 300 },
        { name: "Product C", value: 200 },
        { name: "Product D", value: 100 },
      ],
    },
    {
      id: "6",
      type: "area",
      title: "User Growth",
      xAxisKey: "month",
      dataKey: "users",
      width: 2,
      data: [
        { month: "Jan", users: 1000 },
        { month: "Feb", users: 1500 },
        { month: "Mar", users: 2200 },
        { month: "Apr", users: 3100 },
        { month: "May", users: 4200 },
        { month: "Jun", users: 5800 },
      ],
    },
  ],
};

function StatWidget({ widget }: { widget: Widget }) {
  const isPositive = (widget.statChange || 0) >= 0;

  return (
    <div className="bg-card border border-app rounded-xl p-6 h-full">
      <h3 className="text-sm font-medium text-muted mb-2">{widget.title}</h3>
      <div className="text-3xl font-bold text-app mb-1">{widget.statValue}</div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted">{widget.statLabel}</span>
        {widget.statChange !== undefined && (
          <span
            className={`text-sm font-medium flex items-center gap-1 ${
              isPositive ? "text-chart-3" : "text-destructive"
            }`}
          >
            <TrendingUp
              className={`w-4 h-4 ${!isPositive ? "rotate-180" : ""}`}
            />
            {Math.abs(widget.statChange)}%
          </span>
        )}
      </div>
    </div>
  );
}

function ChartWidget({ widget }: { widget: Widget }) {
  const renderChart = () => {
    const commonProps = {
      data: widget.data,
      margin: { top: 10, right: 30, left: 0, bottom: 0 },
    };

    switch (widget.type) {
      case "line":
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey={widget.xAxisKey}
              stroke="var(--muted-foreground)"
              fontSize={12}
            />
            <YAxis stroke="var(--muted-foreground)" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                color: "var(--foreground)",
              }}
            />
            <Legend />
            {Object.keys(widget.data[0] || {})
              .filter((key) => key !== widget.xAxisKey)
              .map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                  dot={{ fill: COLORS[index % COLORS.length] }}
                />
              ))}
          </LineChart>
        );

      case "bar":
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey={widget.xAxisKey}
              stroke="var(--muted-foreground)"
              fontSize={12}
            />
            <YAxis stroke="var(--muted-foreground)" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                color: "var(--foreground)",
              }}
            />
            <Legend />
            {Object.keys(widget.data[0] || {})
              .filter((key) => key !== widget.xAxisKey)
              .map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={COLORS[index % COLORS.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
          </BarChart>
        );

      case "pie":
        return (
          <PieChart>
            <Pie
              data={widget.data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey={widget.dataKey || "value"}
              label={({ name, percent }) =>
                `${name} (${(percent * 100).toFixed(0)}%)`
              }
              labelLine={false}
            >
              {widget.data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                color: "var(--foreground)",
              }}
            />
          </PieChart>
        );

      case "area":
        return (
          <AreaChart {...commonProps}>
            <defs>
              {Object.keys(widget.data[0] || {})
                .filter((key) => key !== widget.xAxisKey)
                .map((key, index) => (
                  <linearGradient
                    key={key}
                    id={`gradient-${key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={COLORS[index % COLORS.length]}
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor={COLORS[index % COLORS.length]}
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey={widget.xAxisKey}
              stroke="var(--muted-foreground)"
              fontSize={12}
            />
            <YAxis stroke="var(--muted-foreground)" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                color: "var(--foreground)",
              }}
            />
            <Legend />
            {Object.keys(widget.data[0] || {})
              .filter((key) => key !== widget.xAxisKey)
              .map((key, index) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={COLORS[index % COLORS.length]}
                  fill={`url(#gradient-${key})`}
                />
              ))}
          </AreaChart>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-card border border-app rounded-xl p-6 h-full flex flex-col">
      <h3 className="text-sm font-medium text-muted mb-4">{widget.title}</h3>
      <div className="flex-1 min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart() || <div />}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function Dashboard({ content, onChange, readOnly = false }: DashboardProps) {
  const [editMode, setEditMode] = useState(false);

  const config = useMemo(() => {
    const parsed = parseDashboardConfig(content);
    if (!parsed && !content.trim()) {
      // Return sample dashboard for empty files
      return SAMPLE_DASHBOARD;
    }
    return parsed;
  }, [content]);

  if (!config) {
    return (
      <div className="p-6">
        <div className="bg-card border border-app rounded-xl p-8 text-center">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted" />
          <h3 className="text-lg font-semibold text-app mb-2">
            Invalid Dashboard Configuration
          </h3>
          <p className="text-muted mb-4">
            The dashboard configuration could not be parsed. Please ensure it's
            valid JSON.
          </p>
          <button
            onClick={() => {
              if (onChange) {
                onChange(JSON.stringify(SAMPLE_DASHBOARD, null, 2));
              }
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-colors"
          >
            Load Sample Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-app">{config.title}</h1>
        {!readOnly && (
          <button
            onClick={() => setEditMode(!editMode)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              editMode
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted hover:text-app"
            }`}
          >
            {editMode ? "Done Editing" : "Edit Dashboard"}
          </button>
        )}
      </div>

      {/* Widget Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {config.widgets.map((widget) => (
          <div
            key={widget.id}
            className={widget.width === 2 ? "md:col-span-2" : ""}
          >
            {widget.type === "stat" ? (
              <StatWidget widget={widget} />
            ) : (
              <ChartWidget widget={widget} />
            )}
          </div>
        ))}
      </div>

      {/* Edit Mode Hint */}
      {editMode && (
        <div className="mt-6 p-4 bg-muted rounded-xl text-center">
          <p className="text-sm text-muted">
            Edit the JSON configuration to modify widgets. Switch to Edit mode to
            modify the raw JSON.
          </p>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
