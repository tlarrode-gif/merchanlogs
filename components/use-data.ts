"use client";

/**
 * Hook para cargar datos asincronos de la capa de servicios y recargarlos
 * cuando cambie `dataVersion` (tras crear/editar/eliminar) o cuando se pida
 * manualmente. Mantiene la UI desacoplada del origen de datos.
 */

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/session-provider";

export function useData<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const { dataVersion } = useSession();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loader();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar datos");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, dataVersion]);

  return { data, loading, error, reload };
}
