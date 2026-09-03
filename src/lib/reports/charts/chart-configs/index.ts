import type { ChartConfiguration } from "chart.js";

import { paletteColor } from "@/lib/reports/charts/accessible-palette";

export function lineChartConfig(
  labels: string[],
  datasets: Array<{ label: string; data: number[] }>,
): ChartConfiguration {
  return {
    type: "line",
    data: {
      labels,
      datasets: datasets.map((d, i) => ({
        label: d.label,
        data: d.data,
        borderColor: paletteColor(i + 1),
        backgroundColor: paletteColor(i + 1),
        tension: 0.25,
      })),
    },
    options: {
      plugins: { legend: { position: "bottom" } },
      scales: { y: { beginAtZero: true } },
    },
  };
}

export function barChartConfig(
  labels: string[],
  datasets: Array<{ label: string; data: number[] }>,
): ChartConfiguration {
  return {
    type: "bar",
    data: {
      labels,
      datasets: datasets.map((d, i) => ({
        label: d.label,
        data: d.data,
        backgroundColor: paletteColor(i + 1),
      })),
    },
    options: {
      plugins: { legend: { position: "bottom" } },
      scales: { y: { beginAtZero: true } },
    },
  };
}

export function pieChartConfig(
  labels: string[],
  data: number[],
): ChartConfiguration {
  return {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: data.map((_, i) => paletteColor(i + 1)),
        },
      ],
    },
    options: { plugins: { legend: { position: "right" } } },
  };
}

export function donutChartConfig(
  labels: string[],
  data: number[],
): ChartConfiguration {
  return {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: data.map((_, i) => paletteColor(i + 1)),
        },
      ],
    },
    options: { plugins: { legend: { position: "right" } } },
  };
}

export function stackedBarConfig(
  labels: string[],
  datasets: Array<{ label: string; data: number[] }>,
): ChartConfiguration {
  return {
    type: "bar",
    data: {
      labels,
      datasets: datasets.map((d, i) => ({
        label: d.label,
        data: d.data,
        backgroundColor: paletteColor(i + 1),
        stack: "stack0",
      })),
    },
    options: {
      plugins: { legend: { position: "bottom" } },
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true },
      },
    },
  };
}

/** Funnel approximated as horizontal bar (descending stage counts). */
export function funnelChartConfig(
  stages: Array<{ label: string; value: number }>,
): ChartConfiguration {
  return {
    type: "bar",
    data: {
      labels: stages.map((s) => s.label),
      datasets: [
        {
          label: "Count",
          data: stages.map((s) => s.value),
          backgroundColor: stages.map((_, i) => paletteColor(i + 1)),
        },
      ],
    },
    options: {
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true } },
    },
  };
}
