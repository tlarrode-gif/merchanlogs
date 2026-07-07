import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { IntegrationEvent, LogisticsRequest, LogisticsState, MaterialRequirement, SyncLogEntry, loadLogistics, normalizeLogisticsState, saveLogistics, seedLogistics } from "@/lib/logistics";

type LoadResult = { state: LogisticsState; remote: boolean; error?: string };

export async function loadLogisticsState(): Promise<LoadResult> {
  if (!isSupabaseConfigured || !supabase) return { state: typeof window === "undefined" ? seedLogistics() : loadLogistics(), remote: false };
  try {
    const [materials, stock, movements, requests, requestLines, requirements, pickings, shipments, incidents, pendings, events, syncLogs, vins] = await Promise.all([
      supabase.from("logistics_materials").select("*"),
      supabase.from("logistics_stock").select("*"),
      supabase.from("logistics_stock_movements").select("*"),
      supabase.from("logistics_requests").select("*"),
      supabase.from("logistics_request_lines").select("*"),
      supabase.from("logistics_material_requirements").select("*"),
      supabase.from("logistics_pickings").select("*"),
      supabase.from("logistics_shipments").select("*"),
      supabase.from("logistics_incidents").select("*"),
      supabase.from("logistics_pending_arrivals").select("*"),
      supabase.from("integration_events").select("*"),
      supabase.from("sync_logs").select("*"),
      supabase.from("logistics_vins").select("*")
    ]);
    const responses = [materials, stock, movements, requests, requestLines, requirements, pickings, shipments, incidents, pendings, events, syncLogs, vins];
    const failed = responses.find(response => response.error);
    if (failed?.error) throw failed.error;
    const lines = (requestLines.data || []) as unknown as LogisticsState["requests"][number]["lines"];
    const state = normalizeLogisticsState({
      materials: materials.data as LogisticsState["materials"] || [],
      stock: stock.data as LogisticsState["stock"] || [],
      movements: movements.data as LogisticsState["movements"] || [],
      requests: ((requests.data || []) as LogisticsRequest[]).map(request => ({ ...request, lines: lines.filter(line => line.request_id === request.id) })),
      requirements: requirements.data as MaterialRequirement[] || [],
      pickings: ((pickings.data || []) as LogisticsState["pickings"]).map(picking => ({ ...picking, lineas: Array.isArray((picking as any).lineas) ? (picking as any).lineas : [] })),
      shipments: shipments.data as LogisticsState["shipments"] || [],
      incidents: incidents.data as LogisticsState["incidents"] || [],
      pendings: pendings.data as LogisticsState["pendings"] || [],
      events: events.data as IntegrationEvent[] || [],
      syncLogs: syncLogs.data as SyncLogEntry[] || [],
      vins: vins.data as LogisticsState["vins"] || []
    });
    return { state, remote: true };
  } catch (error) {
    return { state: typeof window === "undefined" ? seedLogistics() : loadLogistics(), remote: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function saveLogisticsState(state: LogisticsState, remote: boolean) {
  if (!remote || !isSupabaseConfigured || !supabase) {
    saveLogistics(state);
    return;
  }
  const normalized = normalizeLogisticsState(state);
  const requestLines = normalized.requests.flatMap(request => request.lines);
  const requests = normalized.requests.map(({ lines, ...request }) => request);
  const operations = [
    normalized.materials.length ? supabase.from("logistics_materials").upsert(normalized.materials) : null,
    normalized.stock.length ? supabase.from("logistics_stock").upsert(normalized.stock) : null,
    normalized.movements.length ? supabase.from("logistics_stock_movements").upsert(normalized.movements) : null,
    requests.length ? supabase.from("logistics_requests").upsert(requests) : null,
    requestLines.length ? supabase.from("logistics_request_lines").upsert(requestLines) : null,
    normalized.requirements.length ? supabase.from("logistics_material_requirements").upsert(normalized.requirements) : null,
    normalized.pickings.length ? supabase.from("logistics_pickings").upsert(normalized.pickings) : null,
    normalized.shipments.length ? supabase.from("logistics_shipments").upsert(normalized.shipments) : null,
    normalized.incidents.length ? supabase.from("logistics_incidents").upsert(normalized.incidents) : null,
    normalized.pendings.length ? supabase.from("logistics_pending_arrivals").upsert(normalized.pendings) : null,
    normalized.events.length ? supabase.from("integration_events").upsert(normalized.events) : null,
    normalized.syncLogs.length ? supabase.from("sync_logs").upsert(normalized.syncLogs) : null,
    normalized.vins.length ? supabase.from("logistics_vins").upsert(normalized.vins) : null
  ].filter(Boolean);
  const results = await Promise.all(operations);
  const failed = results.find(result => result && result.error);
  if (failed?.error) throw failed.error;
}
