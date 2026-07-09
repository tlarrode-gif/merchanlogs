"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { getPickingBatch, groupLines, summarizeBatch } from "@/services/picking.service";
import { listIncidents } from "@/services/incidents.service";
import { useData } from "@/components/use-data";
import { useCatalog } from "@/components/use-catalog";
import { groupingTypeMeta, pickingBatchStatusMeta, priorityMeta } from "@/lib/status";
import { formatDate } from "@/lib/dates";

/**
 * Hoja de picking imprimible. Se agrupa segun el groupingType del batch.
 * Usa window.print(). El CSS de impresion oculta la navegacion (ver estilos abajo).
 */
export default function PickingPrintPage() {
  const params = useParams();
  const id = String(params.id);
  const { data: batch } = useData(() => getPickingBatch(id), [id]);
  const { data: incidents } = useData(() => listIncidents(), []);
  const { catalog } = useCatalog();
  const groups = useMemo(() => (batch ? groupLines(batch) : []), [batch]);

  if (!batch) return <p className="p-6 text-sm text-gray-400">Cargando hoja...</p>;
  const summary = summarizeBatch(batch, incidents ?? []);

  return (
    <div className="print-sheet mx-auto max-w-4xl bg-white p-6 text-sm text-black">
      <style>{`
        @media print {
          aside, header { display: none !important; }
          main { padding: 0 !important; }
          .no-print { display: none !important; }
          .print-sheet { max-width: none !important; padding: 0 !important; }
          .group-block { break-inside: avoid; page-break-inside: avoid; }
          thead { display: table-header-group; }
        }
        .print-sheet table { width: 100%; border-collapse: collapse; }
        .print-sheet th, .print-sheet td { border: 1px solid #999; padding: 4px 6px; text-align: left; font-size: 11px; }
        .print-sheet th { background: #f0f0f0; }
        .chk { display: inline-block; width: 14px; height: 14px; border: 1px solid #333; }
      `}</style>

      <div className="no-print mb-4 flex justify-end gap-2">
        <button onClick={() => window.print()} className="rounded bg-blue-600 px-4 py-2 text-white">Imprimir hoja de picking</button>
        <a href={`/picking/${batch.id}`} className="rounded border px-4 py-2">Volver</a>
      </div>

      {/* Cabecera */}
      <div className="mb-3 flex items-start justify-between border-b-2 border-black pb-2">
        <div>
          <h1 className="text-xl font-bold">Hoja de Picking — {batch.pickingCode}</h1>
          <p>{catalog.clientName(batch.clientId)} · {catalog.campaignName(batch.campaignId)}</p>
          <p>Agrupacion: <strong>{groupingTypeMeta[batch.groupingType]}</strong>{batch.assignedInstaller ? ` · Instalador: ${batch.assignedInstaller}` : ""}</p>
          {batch.province || batch.route || batch.wave ? (
            <p>{[batch.province && `Provincia: ${batch.province}`, batch.route && `Ruta: ${batch.route}`, batch.wave && `Oleada: ${batch.wave}`].filter(Boolean).join(" · ")}</p>
          ) : null}
        </div>
        <div className="text-right text-xs">
          <p>Creado: {formatDate(batch.createdAt)}</p>
          <p>Prioridad: {priorityMeta[batch.priority].label}</p>
          <p>Estado: {pickingBatchStatusMeta[batch.status].label}</p>
          <p className="mt-2">Preparado por: ____________</p>
          <p>Revisado por: ____________</p>
        </div>
      </div>

      {/* Resumen */}
      <div className="mb-4 flex flex-wrap gap-4 text-xs">
        <span>Total destinos: <strong>{summary.totalPoints}</strong></span>
        <span>Total lineas: <strong>{summary.totalLines}</strong></span>
        <span>Total unidades: <strong>{summary.totalUnits}</strong></span>
        <span>Incidencias abiertas: <strong>{summary.openIncidents}</strong></span>
      </div>

      {/* Detalle agrupado */}
      {groups.map((group) => (
        <div key={group.key} className="group-block mb-5">
          <h2 className="mb-1 bg-gray-200 px-2 py-1 text-sm font-bold">{group.key}</h2>
          <table>
            <thead>
              <tr>
                <th>Destino / Oficina</th>
                <th>Direccion</th>
                <th>Cod./VIN</th>
                <th>Material</th>
                <th>Medidas</th>
                <th>Cant.</th>
                <th>Ubic.</th>
                <th>Prep.</th>
                <th>Falta</th>
                <th>Inc.</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {group.lines.map((line) => (
                <tr key={line.id}>
                  <td>{line.officeName || line.pointOfSaleName || "-"}</td>
                  <td>{[line.address, line.city].filter(Boolean).join(", ") || "-"}</td>
                  <td>{line.serviceCode || line.officeCode || "-"}</td>
                  <td>{line.description}</td>
                  <td>{line.dimensions || "-"}</td>
                  <td>{line.quantity}</td>
                  <td>{line.location || "-"}</td>
                  <td><span className="chk" /></td>
                  <td><span className="chk" /></td>
                  <td><span className="chk" /></td>
                  <td style={{ minWidth: 120 }}></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
