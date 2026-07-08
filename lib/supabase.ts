/**
 * Cliente Supabase preparado pero NO utilizado todavia.
 *
 * En esta fase MerchanLOGS trabaja con datos locales (ver services/local-adapter.ts).
 * Este modulo replica la convencion de MerchanOPS para que, cuando se active la
 * sincronizacion, la configuracion sea identica en ambos proyectos.
 *
 * El interruptor de origen de datos vive en services/adapter.ts.
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;
