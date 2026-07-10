"use client";

import { useState } from "react";
import Link from "next/link";
import { ImportRow, ImportType } from "@/types";
import {
  templates, parsePaste, validateRows, summarize, confirmImport, listImportBatches
} from "@/services/imports.service";
import { useSession } from "@/components/session-provider";
import { useData } from "@/components/use-data";
import { useCatalog } from "@/components/use-catalog";
import {
  Badge, Button, Card, EmptyState, Field, NoAccess, PageHeader, Select, Table, Td, Textarea
} from "@/components/ui";
import { importBatchStatusMeta, importTypeMeta } from "@/lib/status";
import { formatDateTime } from "@/lib/dates";
import { MaterialsTabs } from "@/components/materials-tabs";

const importTypes: ImportType[] = ["isdin_vinilos", "banc_sabadell", "generico"];

export default function ImportacionesPage() {
  const { can, user, refreshData } = useSession();
  const { data: batches } = useData(() => listImportBatches(), []);
  const { catalog } = useCatalog();

  const [type, setType] = useState<ImportType>("isdin_vinilos");
  const [clientId, setClientId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  if (!can("imports.view")) return <NoAccess />;
  const canManage = can("imports.manage");

  const summary = rows ? summarize(rows) : null;

  async function preview() {
    const parsed = parsePaste(text, type);
    const validated = await validateRows(type, parsed);
    setRows(validated);
  }

  async function confirm() {
    if (!rows || !clientId) return;
    setBusy(true);
    try {
      await confirmImport(type, clientId, campaignId || null, rows, user?.id);
      setRows(null);
      setText("");
      refreshData();
      window.alert("Importacion confirmada. Se han creado piezas/materiales, movimientos de stock y el lote de importacion.");
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <MaterialsTabs />
      <PageHeader
        title="Carga masiva (copiar/pegar desde Excel)"
        subtitle="Pega filas desde Excel, previsualiza, valida y confirma. Al confirmar se crea stock real y movimientos."
      />

      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Tipo de importacion">
            <Select value={type} onChange={(e) => { setType(e.target.value as ImportType); setRows(null); }}>
              {importTypes.map((t) => <option key={t} value={t}>{importTypeMeta[t]}</option>)}
            </Select>
          </Field>
          <Field label="Cliente / CECO (obligatorio)">
            <Select value={clientId} onChange={(e) => { setClientId(e.target.value); setCampaignId(""); }}>
              <option value="">Selecciona cliente</option>
              {catalog.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Campana">
            <Select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
              <option value="">(sin campana)</option>
              {catalog.campaigns.filter((c) => !clientId || c.clientId === clientId).map((c) => <option key={c.id} value={c.id}>{c.campaignName}</option>)}
            </Select>
          </Field>
        </div>

        <div className="mt-3 rounded-md bg-gray-50 p-2 text-xs text-gray-500">
          <strong>Columnas esperadas (orden, separadas por tabulador):</strong>
          <div className="mt-1 overflow-x-auto font-mono">{templates[type].join(" · ")}</div>
          <p className="mt-1">Puedes incluir o no la fila de cabecera. Pega directamente desde Excel (se separa por tabuladores).</p>
        </div>

        <div className="mt-3">
          <Field label="Pega aqui las filas desde Excel">
            <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={type === "isdin_vinilos" ? "VIN-31195\tISDIN\tCECO-ISDIN-01\tISDIN Vinilos...\tFarmacia Diagonal\t..." : "Pega las filas..."} />
          </Field>
        </div>
        <div className="mt-2 flex gap-2">
          <Button variant="secondary" onClick={preview} disabled={!text.trim()}>Previsualizar y validar</Button>
          {rows && canManage ? (
            <Button onClick={confirm} disabled={busy || !clientId || summary!.validCount === 0}>
              Confirmar importacion ({summary!.validCount} validas)
            </Button>
          ) : null}
        </div>
        {rows && !clientId ? <p className="mt-2 text-xs text-red-600">Selecciona un cliente antes de confirmar.</p> : null}
      </Card>

      {/* Previsualizacion */}
      {rows ? (
        <Card className="mb-6">
          <div className="mb-2 flex flex-wrap gap-3 text-sm">
            <Badge tone="gray">{summary!.rowCount} filas</Badge>
            <Badge tone="green">{summary!.validCount} validas</Badge>
            <Badge tone="amber">{summary!.duplicateCount} duplicadas</Badge>
            <Badge tone="red">{summary!.errorCount} con error</Badge>
          </div>
          <div className="max-h-96 overflow-auto">
            <Table headers={["#", "Clave", "Destino", "Estado", "Errores"]}>
              {rows.map((r) => {
                const key = r.raw.vinCode || r.raw.officeCode || r.raw.materialCode || r.raw.name || "-";
                const dest = r.raw.pharmacyName || r.raw.pointOfSaleName || r.raw.officeName || "-";
                return (
                  <tr key={r.rowIndex} className={!r.valid ? "bg-red-50/40" : r.duplicate ? "bg-amber-50/40" : ""}>
                    <Td className="text-gray-400">{r.rowIndex}</Td>
                    <Td className="font-mono text-xs">{key}</Td>
                    <Td className="text-xs">{dest}</Td>
                    <Td>{r.valid ? <Badge tone="green">OK</Badge> : <Badge tone="red">Error</Badge>}{r.duplicate ? <Badge tone="amber">Duplicado</Badge> : null}</Td>
                    <Td className="text-xs text-red-600">{r.errors.join("; ")}</Td>
                  </tr>
                );
              })}
            </Table>
          </div>
        </Card>
      ) : null}

      {/* Historial de importaciones */}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Lotes de importacion</h2>
      {!batches?.length ? (
        <EmptyState message="Sin importaciones todavia." />
      ) : (
        <Table headers={["Codigo", "Tipo", "Cliente", "Filas", "Validas", "Duplic.", "Errores", "Estado", "Fecha", ""]}>
          {batches.map((b) => (
            <tr key={b.id}>
              <Td className="font-mono text-xs">{b.importCode}</Td>
              <Td className="text-xs">{importTypeMeta[b.type]}</Td>
              <Td>{catalog.clientName(b.clientId)}</Td>
              <Td>{b.rowCount}</Td>
              <Td className="text-green-700">{b.validCount}</Td>
              <Td className="text-amber-700">{b.duplicateCount}</Td>
              <Td className="text-red-600">{b.errorCount}</Td>
              <Td><Badge tone={importBatchStatusMeta[b.status].tone}>{importBatchStatusMeta[b.status].label}</Badge></Td>
              <Td className="whitespace-nowrap text-xs text-gray-500">{formatDateTime(b.createdAt)}</Td>
              <Td><Link href="/piezas" className="text-xs text-blue-600 hover:underline">ver piezas</Link></Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
