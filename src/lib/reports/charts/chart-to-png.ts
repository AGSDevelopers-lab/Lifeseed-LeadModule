import "server-only";

import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import type { ChartConfiguration } from "chart.js";

/**
 * Render a Chart.js config to PNG for embedding in react-pdf exports.
 * Falls back to empty buffer if native canvas bindings are unavailable.
 */
export async function chartToPng(
  configuration: ChartConfiguration,
  width = 720,
  height = 360,
): Promise<Buffer> {
  try {
    const canvas = new ChartJSNodeCanvas({
      width,
      height,
      backgroundColour: "white",
    });
    return await canvas.renderToBuffer(configuration);
  } catch (err) {
    console.warn("[reports] chartToPng failed — chart omitted from PDF", err);
    return Buffer.alloc(0);
  }
}
