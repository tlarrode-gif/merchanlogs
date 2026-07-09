/**
 * Servicio de carga masiva (copiar/pegar desde Excel).
 *
 * Flujo: parsePaste -> validateRows -> (previsualizacion en UI) -> confirmImport.
 * Al confirmar se crean consecuencias REALES:
 *  - ImportBatch (documento de la importacion / entrada de material),
 *  - piezas unitarias (ISDIN, Banc Sabadell) en estado `recibido`,
 *  - movimientos de stock tipo `entrada` (trazabilidad),
 *  - para material generico: material agregado + entrada de stock + movimiento.
 */

import { ImportBatch, ImportRow, ImportType, MaterialItem, MaterialType } from "@/types";
import { makeCrud } from "@/services/crud";
import { getAdapter } from "@/services/adapter";
import { createMaterialItem, existingCodeSet, normalizeItemCode } from "@/services/material-items.service";
import { materialsService } from "@/services/catalog.service";
import { createEntry } from "@/services/entries.service";
import { recordMovement } from "@/services/stock.service";
import { nextCode } from "@/lib/ids";
import { nowIso } from "@/lib/dates";

const crud = makeCrud("importBatches", "imp");

export const listImportBatches = () => crud.list();
export const getImportBatch = (id: string) => crud.get(id);

// ---------------------------------------------------------------------------
// Plantillas de columnas
// ---------------------------------------------------------------------------

export const templates: Record<ImportType, string[]> = {
  isdin_vinilos: [
    "vinCode", "clientName", "ceco", "campaignName", "pharmacyName", "pointOfSaleName",
    "address", "city", "province", "postalCode", "week", "height", "width", "quantity",
    "installer", "serviceCode", "notes"
  ],
  banc_sabadell: [
    "officeCode", "officeName", "clientName", "ceco", "campaignName", "address", "city",
    "province", "postalCode", "installer", "visualCode", "materialType", "materialName",
    "height", "width", "quantity", "route", "wave", "notes"
  ],
  generico: [
    "name", "materialCode", "clientName", "ceco", "campaignName", "type", "dimensions",
    "unit", "quantity", "location", "notes"
  ]
};

// ---------------------------------------------------------------------------
// Parseo del texto pegado (TSV)
// ---------------------------------------------------------------------------

/** Convierte texto pegado desde Excel (tab-separado) en filas mapeadas por columna. */
export function parsePaste(text: string, type: ImportType): ImportRow[] {
  const cols = templates[type];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];

  // Deteccion de cabecera: si la primera fila contiene un nombre de columna conocido.
  const firstCells = lines[0].split("\t").map((c) => c.trim());
  const hasHeader = firstCells.some((c) => cols.includes(c));
  let headerMap: string[] = cols;
  let bodyLines = lines;
  if (hasHeader) {
    headerMap = firstCells.map((c) => (cols.includes(c) ? c : c));
    bodyLines = lines.slice(1);
  }

  return bodyLines.map((line, i) => {
    const cells = line.split("\t");
    const raw: Record<string, string> = {};
    headerMap.forEach((colName, idx) => {
      raw[colName] = (cells[idx] ?? "").trim();
    });
    return { rowIndex: i + 1, raw, valid: false, duplicate: false, errors: [] };
  });
}

// ---------------------------------------------------------------------------
// Validacion
// ---------------------------------------------------------------------------

const VIN_RE = /^VIN-[A-Z0-9]+$/;

function num(value: string): number | null {
  if (value == null || value.trim() === "") return null;
  const n = Number(value.replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

/**
 * Valida las filas segun la plantilla. Detecta campos obligatorios, formatos y
 * duplicados (dentro del propio pegado y contra los datos ya existentes).
 */
export async function validateRows(type: ImportType, rows: ImportRow[]): Promise<ImportRow[]> {
  const existing = type === "isdin_vinilos" ? await existingCodeSet() : new Set<string>();
  const seen = new Set<string>();

  return rows.map((row) => {
    const errors: string[] = [];
    let duplicate = false;
    const r = row.raw;

    if (type === "isdin_vinilos") {
      const code = normalizeItemCode(r.vinCode || "");
      if (!code) errors.push("vinCode obligatorio");
      else if (!VIN_RE.test(code)) errors.push(`vinCode con formato invalido (esperado VIN-XXXXX): ${r.vinCode}`);
      if (!r.clientName) errors.push("clientName obligatorio");
      if (!r.campaignName) errors.push("campaignName obligatorio");
      if (r.height && num(r.height) === null) errors.push("height debe ser numerico");
      if (r.width && num(r.width) === null) errors.push("width debe ser numerico");
      if (code) {
        if (seen.has(code) || existing.has(code)) duplicate = true;
        seen.add(code);
      }
    } else if (type === "banc_sabadell") {
      if (!r.officeCode && !r.officeName) errors.push("officeCode u officeName obligatorio");
      if (!r.materialName) errors.push("materialName obligatorio");
      if (!r.clientName) errors.push("clientName obligatorio");
      if (!r.campaignName) errors.push("campaignName obligatorio");
      if (r.height && num(r.height) === null) errors.push("height debe ser numerico");
      if (r.width && num(r.width) === null) errors.push("width debe ser numerico");
      if (r.quantity && num(r.quantity) === null) errors.push("quantity debe ser numerico");
      const key = `${r.officeCode}|${r.visualCode}|${r.materialName}`.toUpperCase();
      if (seen.has(key)) duplicate = true;
      seen.add(key);
    } else {
      if (!r.name) errors.push("name obligatorio");
      if (!r.clientName) errors.push("clientName obligatorio");
      if (r.quantity && num(r.quantity) === null) errors.push("quantity debe ser numerico");
    }

    // Un duplicado ISDIN es error (pieza unica); en Sabadell es solo advertencia.
    const valid = errors.length === 0 && (type !== "isdin_vinilos" || !duplicate);
    if (type === "isdin_vinilos" && duplicate) errors.push("vinCode duplicado (pieza unica; no se importara)");
    return { ...row, errors, duplicate, valid };
  });
}

export interface ValidationSummary {
  rowCount: number;
  validCount: number;
  duplicateCount: number;
  errorCount: number;
}

export function summarize(rows: ImportRow[]): ValidationSummary {
  return {
    rowCount: rows.length,
    validCount: rows.filter((r) => r.valid).length,
    duplicateCount: rows.filter((r) => r.duplicate).length,
    errorCount: rows.filter((r) => !r.valid).length
  };
}

// ---------------------------------------------------------------------------
// Confirmacion (consecuencias reales)
// ---------------------------------------------------------------------------

const materialTypeFromString = (value?: string): MaterialType => {
  const v = (value || "").toLowerCase();
  const known: MaterialType[] = ["vinilo", "plv", "display", "carteleria", "muestra", "promocional", "generico", "otro"];
  return (known.find((t) => t === v) as MaterialType) ?? "otro";
};

export async function nextImportCode(): Promise<string> {
  const all = await crud.list();
  return nextCode("IMP", all.map((i) => i.importCode));
}

/**
 * Confirma la importacion: crea el ImportBatch y las entidades derivadas. Solo se
 * procesan las filas validas; los duplicados y errores se conservan en el detalle.
 */
export async function confirmImport(
  type: ImportType,
  clientId: string,
  campaignId: string | null,
  rows: ImportRow[],
  actorId?: string | null
): Promise<ImportBatch> {
  const summary = summarize(rows);
  const importCode = await nextImportCode();

  // Crear el batch primero para poder enlazar las entidades a el.
  const batch = await crud.create(
    {
      importCode,
      type,
      clientId,
      campaignId,
      status: summary.errorCount > 0 ? "con_errores" : "confirmado",
      rowCount: summary.rowCount,
      validCount: summary.validCount,
      duplicateCount: summary.duplicateCount,
      errorCount: summary.errorCount,
      rows,
      notes: null
    },
    actorId
  );

  const processedRows: ImportRow[] = [];
  for (const row of rows) {
    if (!row.valid) {
      processedRows.push(row);
      continue;
    }
    let createdId: string | null = null;
    if (type === "isdin_vinilos") {
      createdId = await importIsdinRow(row, clientId, campaignId, batch.id, actorId);
    } else if (type === "banc_sabadell") {
      createdId = await importSabadellRow(row, clientId, campaignId, batch.id, actorId);
    } else {
      createdId = await importGenericRow(row, clientId, campaignId, batch.id, actorId);
    }
    processedRows.push({ ...row, createdEntityId: createdId });
  }

  return crud.update(batch.id, { rows: processedRows }, actorId);
}

async function importIsdinRow(
  row: ImportRow,
  clientId: string,
  campaignId: string | null,
  importBatchId: string,
  actorId?: string | null
): Promise<string> {
  const r = row.raw;
  const item = await createMaterialItem(
    {
      itemCode: normalizeItemCode(r.vinCode),
      clientId,
      campaignId,
      materialId: null,
      name: r.pharmacyName || r.pointOfSaleName || r.vinCode,
      type: "vinilo",
      heightCm: r.height ? Number(r.height.replace(",", ".")) : null,
      widthCm: r.width ? Number(r.width.replace(",", ".")) : null,
      pointOfSaleName: r.pharmacyName || r.pointOfSaleName || null,
      officeCode: null,
      address: r.address || null,
      city: r.city || null,
      province: r.province || null,
      postalCode: r.postalCode || null,
      week: r.week || null,
      installer: r.installer || null,
      route: null,
      wave: null,
      serviceId: null,
      serviceCode: r.serviceCode || null,
      location: null,
      status: "recibido",
      notes: r.notes || null,
      stockEntryId: null,
      importBatchId,
      pickingBatchId: null,
      pickingLineId: null,
      shipmentId: null,
      incidentId: null
    } as Omit<MaterialItem, "id" | keyof import("@/types").BaseEntity>,
    actorId
  );
  await recordMovement({
    materialItemId: item.id,
    clientId,
    campaignId,
    type: "entrada",
    quantity: 1,
    reason: `Importacion ${importBatchId} (VIN ${item.itemCode})`,
    relatedEntityType: "import_batch",
    relatedEntityId: importBatchId,
    actorId
  });
  return item.id;
}

async function importSabadellRow(
  row: ImportRow,
  clientId: string,
  campaignId: string | null,
  importBatchId: string,
  actorId?: string | null
): Promise<string> {
  const r = row.raw;
  const quantity = Math.max(1, Number(r.quantity || "1") || 1);
  const baseCode = normalizeItemCode(`${r.officeCode || "OFI"}-${r.visualCode || r.materialName || "MAT"}`);
  let firstId = "";
  for (let n = 1; n <= quantity; n++) {
    const item = await createMaterialItem(
      {
        itemCode: `${baseCode}-${n}`,
        clientId,
        campaignId,
        materialId: null,
        name: r.materialName || r.visualCode || "Material Sabadell",
        type: materialTypeFromString(r.materialType),
        heightCm: r.height ? Number(r.height.replace(",", ".")) : null,
        widthCm: r.width ? Number(r.width.replace(",", ".")) : null,
        pointOfSaleName: r.officeName || r.officeCode || null,
        officeCode: r.officeCode || null,
        address: r.address || null,
        city: r.city || null,
        province: r.province || null,
        postalCode: r.postalCode || null,
        week: null,
        installer: r.installer || null,
        route: r.route || null,
        wave: r.wave || null,
        serviceId: null,
        serviceCode: null,
        location: null,
        status: "recibido",
        notes: r.notes || null,
        stockEntryId: null,
        importBatchId,
        pickingBatchId: null,
        pickingLineId: null,
        shipmentId: null,
        incidentId: null
      } as Omit<MaterialItem, "id" | keyof import("@/types").BaseEntity>,
      actorId
    );
    if (!firstId) firstId = item.id;
    await recordMovement({
      materialItemId: item.id,
      clientId,
      campaignId,
      type: "entrada",
      quantity: 1,
      reason: `Importacion ${importBatchId} (${item.itemCode})`,
      relatedEntityType: "import_batch",
      relatedEntityId: importBatchId,
      actorId
    });
  }
  return firstId;
}

async function importGenericRow(
  row: ImportRow,
  clientId: string,
  campaignId: string | null,
  importBatchId: string,
  actorId?: string | null
): Promise<string> {
  const r = row.raw;
  const quantity = Math.max(1, Number(r.quantity || "1") || 1);
  // Buscar material existente por codigo o crear uno nuevo.
  const materials = await getAdapter().list("materials");
  const existing = materials.find(
    (m) => m.clientId === clientId && (m.materialCode === r.materialCode || (r.materialCode === "" && m.name === r.name))
  );
  let materialId: string;
  if (existing) {
    materialId = existing.id;
  } else {
    const created = await materialsService.create(
      {
        clientId,
        campaignId,
        name: r.name,
        materialCode: r.materialCode || `MAT-IMP-${Date.now()}`,
        type: materialTypeFromString(r.type),
        description: null,
        dimensions: r.dimensions || null,
        heightCm: null,
        widthCm: null,
        unit: r.unit || "ud",
        currentStock: 0,
        reservedStock: 0,
        minimumStock: 0,
        location: r.location || null,
        status: "activo"
      } as Omit<import("@/types").Material, "id" | keyof import("@/types").BaseEntity>,
      actorId
    );
    materialId = created.id;
  }
  // Entrada de stock recibida -> actualiza stock + genera movimiento (via entries.service).
  await createEntry(
    {
      clientId,
      campaignId,
      materialId,
      quantity,
      entryDate: nowIso(),
      supplier: `Importacion ${importBatchId}`,
      deliveryNote: null,
      receivedBy: actorId ?? null,
      status: "recibida",
      notes: r.notes || null
    },
    actorId
  );
  return materialId;
}
