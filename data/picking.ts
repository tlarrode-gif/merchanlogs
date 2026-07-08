/**
 * Semilla de picking agrupado e importaciones. Se dejan vacios: los escenarios
 * ISDIN y Banc Sabadell se generan desde la propia app (carga masiva + creacion
 * de PickingBatch) para demostrar que las acciones tienen consecuencias reales.
 * Ver docs/PICKING_BATCHES.md y docs/BULK_IMPORTS.md.
 */

import { ImportBatch, PickingBatch } from "@/types";

export const pickingBatches: PickingBatch[] = [];
export const importBatches: ImportBatch[] = [];
