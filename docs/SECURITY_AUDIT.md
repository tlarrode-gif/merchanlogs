# Auditoría de seguridad — MerchanLOGS

Fecha: 2026-07-09 · Alcance: código de la app (fase actual: datos locales, sin backend propio)

## 1. Contexto de la superficie de ataque

MerchanLOGS en su fase actual **no tiene API routes, ni login real, ni backend**: es una SPA Next.js que opera sobre `localStorage` con una sesión simulada (selector de rol). Eso reduce mucho la superficie hoy, pero varios controles pedidos aplican "en diferido" y quedan documentados aquí para la conexión a Supabase (fase 3).

## 2. Correcciones aplicadas en esta iteración

| # | Punto | Resultado |
|---|-------|-----------|
| 1 | **Rate limiting de endpoints** | **No aplica todavía**: no existen API routes ni login/registro (la "sesión" es un selector simulado sin contraseña). Cuando la fase 3 introduzca autenticación real, se usará **Supabase Auth**, que trae rate limiting de servidor en login/registro de serie (ver §3.1). En MerchanOPS, que sí tiene login, el límite de 5 intentos/15 min queda implementado. |
| 2 | **Escaneo de secretos** | Limpio: no hay claves API, tokens ni contraseñas en el código. Supabase entra por `.env` (`NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, aún sin conectar) y `.gitignore` ya excluye `.env*`. |
| 3 | **Sanitización de inputs** | Aplicada de forma **centralizada** en la capa CRUD (`services/crud.ts` + `lib/sanitize.ts`): todo string que entra por `create`/`update` —formularios e importaciones copiar/pegar— se limpia de caracteres de control y se acota en longitud (`sanitizeDeep`). XSS en render lo cubre React (JSX escapa; no hay `dangerouslySetInnerHTML` ni `eval` en el código). |

## 3. Vulnerabilidades / riesgos restantes (por prioridad)

### 3.1 Para la fase 3 (conexión Supabase) — CRÍTICO planificarlo ANTES de conectar
El proyecto Supabase compartido con MerchanOPS tiene **RLS desactivado en las 39 tablas**: la anon key da lectura/escritura total. Conectar MerchanLOGS a ese proyecto tal cual **hereda ese agujero**. Antes de la conexión real:
1. Migrar autenticación a **Supabase Auth** (sustituye la sesión simulada; usuarios compartidos con OPS).
2. Definir políticas RLS por rol (Administración/Gestor/Almacén) para las tablas `logistics_*`.
3. Activar RLS. El detalle completo y el SQL están en `docs/SECURITY_AUDIT.md` de **MerchanOPS** (§2).

### 3.2 Dependencias con CVEs (MEDIA)
`npm audit`: **12 vulnerabilidades (2 críticas, 4 altas)**, casi todas del toolchain:
- `next@14.2.23` — crítica (SSRF middleware, cache poisoning, dev server). Subir a 14.2.35+ o 15/16 (breaking).
- `@supabase/supabase-js@2.48.1` — baja (auth-js path routing). Subir a 2.110+ antes de conectar la fase 3.
- `vitest`/`glob`/`postcss` — solo afectan a desarrollo/build, no al runtime desplegado.

### 3.3 Datos locales sin cifrar (BAJA, informativo)
Los datos operativos viven en `localStorage` del navegador en claro. Es aceptable para el MVP con datos de prueba; desaparece al pasar a Supabase.

### 3.4 Permisos solo de UI (BAJA hoy, ALTA en fase 3)
`lib/permissions.ts` filtra navegación y acciones en cliente. Con datos locales es suficiente; con Supabase, la autoridad debe estar en RLS (ver §3.1) y los permisos de UI quedan como usabilidad.

## 4. Recomendación

No conectar MerchanLOGS al proyecto Supabase compartido hasta cerrar el plan Auth+RLS descrito en la auditoría de MerchanOPS. La arquitectura por capas de LOGS (UI → services → adapter) hace que ese cambio no toque pantallas ni lógica de dominio.
