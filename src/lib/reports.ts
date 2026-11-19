import { sampleMode } from "./config";
import { db } from "./db";
import { buildSampleReport } from "./scan";
import type { Report } from "./types";

export async function loadReport(id: string): Promise<Report | null> {
  if (id === "sample") return sampleMode ? buildSampleReport() : null;
  return db.getDoc<Report>("reports", id);
}
