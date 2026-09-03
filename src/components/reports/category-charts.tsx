"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** Placeholder trend series — live series wired when category aggregations expand. */
const TREND = [
  { week: "W1", value: 4 },
  { week: "W2", value: 6 },
  { week: "W3", value: 5 },
  { week: "W4", value: 8 },
  { week: "W5", value: 7 },
  { week: "W6", value: 9 },
];

const DIST = [
  { name: "P0", count: 12 },
  { name: "P1", count: 8 },
  { name: "P2", count: 15 },
  { name: "P3", count: 4 },
  { name: "P4", count: 2 },
];

export function CategoryCharts({
  category,
  hints,
  colors,
}: {
  category: string;
  hints: string[];
  colors: string[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border border-stone-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold text-stone-800">
          {hints[0] ?? "Trend"}
        </h3>
        <div
          className="h-56"
          role="img"
          aria-label={`${category} trend chart: ${hints[0] ?? "trend over recent weeks"}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={TREND}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis dataKey="week" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                name="Count"
                stroke={colors[2] ?? "#56B4E9"}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-lg border border-stone-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold text-stone-800">
          {hints[1] ?? "Distribution"}
        </h3>
        <div
          className="h-56"
          role="img"
          aria-label={`${category} distribution chart: ${hints[1] ?? "category distribution"}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={DIST}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="Count" fill={colors[3] ?? "#009E73"} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
