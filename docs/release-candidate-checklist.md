# Terminal PRO / Oddsmark - Release Candidate Checklist

Fecha de corte: 2026-05-02

## Estado RC

Estado objetivo: beta publica/controlada.

Estado actual: RC funcional con bloqueantes de validacion manual antes de abrir publico.

Reglas de release:
- No borrar apuestas demo ni datos de prueba sin confirmacion explicita.
- No ejecutar SQL destructivo.
- No tocar migraciones runtime.
- Mantener UI en espanol y codigo en ingles.
- No prometer verificacion si no existe `verificationHash` real.

## Bloqueantes Antes De Lanzar

| ID | Area | Bloqueante | Estado |
| --- | --- | --- | --- |
| RC-BLOCKER-001 | Desktop QA | Validar layout real en 1280, 1440 y 1728 px: header desktop, ausencia de bottom nav, modales, historial, share cards y estrategias. | Pendiente por limitacion de viewport del navegador integrado. |
| RC-BLOCKER-002 | Share cards | Exportar imagen real para simple, combinada, escalera, sin prueba, post-evento y pre-evento. | Pendiente de QA visual exportada. |
| RC-BLOCKER-003 | Supabase | Confirmar RLS/policies en proyecto real y aplicar `docs/supabase-rls-hardening.sql` en ventana controlada si falta. | Pendiente manual, no aplicado desde Codex. |
| RC-BLOCKER-004 | Produccion | Revisar variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SESSION_SECRET`. | Pendiente manual. |
| RC-BLOCKER-005 | Legal/beta | Aviso beta, uso responsable, privacidad minima y canal de reporte de bugs visible. | Pendiente producto/legal. |

## Bugs RC Trazados

| ID | Severidad | Descripcion | Resolucion |
| --- | --- | --- | --- |
| RC-BUG-001 | Alta | `sendToTelegram` y `getTelegramStatus` llamaban endpoints privados con cookies, pero el backend espera Supabase Bearer JWT. | Corregido: usan `apiRequest` con Authorization. |
| RC-BUG-002 | Alta | Escaneo de ticket llamaba `/api/scan-ticket` sin Bearer JWT. | Corregido: usa `apiRequest`. |
| RC-BUG-003 | Media | OG server de `/verify` aceptaba prefijos de 4 caracteres, aumentando superficie de enumeracion. | Corregido: minimo 8 y maximo 64 caracteres, igual que API publica. |
| RC-BUG-004 | Media | Busqueda de historial rompia si `tags` llegaba como array legacy. | Corregido en fase anterior con `bet-search`. |
| RC-BUG-005 | Baja | Tests OTS fallan dentro del sandbox por `listen EPERM` al abrir servidor local. | No es bug producto; correr `npm test` fuera del sandbox. |

## Matriz Share Cards

### ViralTicket

| Caso | Resultado esperado | Estado |
| --- | --- | --- |
| Simple pendiente + pre-evento | Muestra ganancia potencial, QR real, `PRUEBA PRE-EVENTO`. | Cubierto por helper, falta export visual. |
| Simple ganada + pre-evento | Muestra P&L positivo, QR real, no promete cobro validado. | Falta export visual. |
| Simple perdida + pre-evento | Muestra P&L negativo, QR real, mantiene confianza sin maquillar. | Falta export visual. |
| Apuesta sin `verificationHash` | Muestra `SIN PRUEBA PUBLICA`, sin QR. | Cubierto por test helper. |
| Registro post-evento | Muestra `REGISTRO POST-EVENTO`, QR real, sin prometer prueba previa. | Cubierto por test helper/social. |
| Combinada | Lista selecciones, cuota agregada, stake/P&L coherentes. | Falta export visual. |
| Escalera | Lista peldaños, stake por seleccion cuando aplica, cuota ponderada. | Falta export visual. |
| Texto largo | No debe cortar equipo/mercado de forma ilegible. | Pendiente QA visual. |

### TrendShareCard

| Temporalidad | Resultado esperado | Estado |
| --- | --- | --- |
| 1D / 1W / 1M / 3M / 6M / 1Y / ALL | Titulo, rango y badge adaptados a la temporalidad activa. | Cubierto por tests de `chart-share-period`, falta export visual. |
| Banca | Etiqueta `BANCA`, valores de banca, curva legible. | Pendiente QA visual. |
| P&L | Etiqueta `P&L`, valores de resultado, color segun signo. | Pendiente QA visual. |
| Datos insuficientes | Boton compartir deshabilitado o estado claro. | Pendiente QA navegador. |

### Reportes Y Resumenes

| Componente | Resultado esperado | Estado |
| --- | --- | --- |
| DailyTicket | Resumen diario sin claims de verificacion falsos. | Pendiente QA visual. |
| DailyReport | Calendario/reporte mensual exportable, sin overflow. | Pendiente QA visual. |
| ShareSummaryTicket | Resumen de apuestas resueltas, P&L/yield coherente. | Pendiente QA visual. |

## QA Desktop Real

Matriz minima:
- 1280 x 720
- 1440 x 900
- 1728 x 1117

Flujos:
- Dashboard sin bottom nav ni FAB movil duplicado.
- Header desktop con `Dashboard`, `Tipsters`, `Estrategias`, `Herramientas`, `Analitica`, `Nueva apuesta`.
- Modal Nueva Apuesta en simple, combinada, escalera.
- Historial con filtros, paginacion y busqueda sin resultados.
- Estrategias listado/detalle.
- Share card apuesta y grafica.
- `/verify?code=NOEXISTE1`.
- `/auth` sin sesion y `/auth` con sesion.

Nota de entorno: en esta sesion, el navegador integrado no expuso control de viewport desktop y Playwright CLI no pudo descargarse por red restringida. El QA desktop real queda como bloqueante manual o para una sesion con Playwright disponible.

## Seguridad Supabase/API

Referencias oficiales consultadas:
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/reference/javascript/auth-getuser

Checklist:
- RLS activado en todas las tablas de `public` expuestas.
- Policies con `to authenticated` y `auth.uid() is not null`.
- No usar `raw_user_meta_data` para autorizacion.
- No exponer `service_role` en cliente.
- Endpoints privados exigen Bearer JWT.
- Endpoints publicos `/api/verify`, `/api/tipsters`, `/api/verify/:code/ots` tienen rate limit.
- OTS download usa 404 uniforme si no hay prueba.
- Soft delete conserva ledger/verificacion.
- `telegram_configs` y `audit_logs` sin acceso anon.

Riesgos pendientes:
- Confirmar en el proyecto Supabase real que `docs/supabase-rls-hardening.sql` esta aplicado o aplicar manualmente.
- Revisar si `frameAncestors: ["*"]` debe limitarse fuera de embeds publicos.
- Verificar que `SESSION_SECRET` de produccion no usa fallback.
- Confirmar dashboard de Supabase: anon/authenticated grants y Data API para tablas privadas.

## Comandos De Cierre

```bash
npm run check
npm test -- client/src/lib/__tests__/share-verification.test.ts client/src/lib/__tests__/social-share.test.ts client/src/lib/__tests__/chart-share-period.test.ts client/src/lib/__tests__/decision-insights.test.ts client/src/lib/__tests__/bet-search.test.ts
npm test
```

`npm test` completo puede requerir ejecucion fuera del sandbox porque `server/__tests__/ots.test.ts` abre un servidor local en `127.0.0.1`.
