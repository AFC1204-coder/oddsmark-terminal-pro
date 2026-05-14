# Terminal PRO / Sport-Bet-Pro: auditoría y plan

## Lectura del estado actual

- La base ya usa React, TypeScript estricto, TanStack Query, Recharts y helpers compartidos para cálculo de apuestas.
- Hay helpers útiles para `calculateBetProfit`, escaleras, filtros de análisis, fechas locales, bankroll series, comparación de Yield y segmentación.
- La app ya separa parte de la lógica financiera de la UI, pero el primer dashboard todavía mezcla muchos widgets antes de una lectura clara de decisión.
- La banca real podía quedar visualmente contaminada por filtros, porque algunos cálculos de la pantalla principal usaban `filteredBets` junto con todas las transacciones.
- Hay soporte de verificación y ledger en schema/backend, pero en dashboard privado debe seguir siendo contextual y discreto.

## Principio de producto

La app no evalúa al usuario. Ordena evidencia. El copy debe describir muestra, concentración, variación reciente, exposición y verificabilidad sin frases moralizantes.

## Prioridad por bloques

1. Cálculo canónico y tests: beneficio, stake efectivo, wallet, drawdown, outliers, fechas locales y comparación de Yield.
2. Dashboard Modo Decisión: banca real, P&L de apuestas, Yield, drawdown, muestra resuelta, exposición y señales objetivas.
3. Gráfica principal inequívoca: Banca real, P&L apuestas, Yield acumulado, Yield rodante y Drawdown.
4. Analytics en tabs: Resumen, Evolución, Segmentos, Riesgo, Avanzado y Social/Verificación.
5. Segmentos accionables con aviso de muestra reducida y comparativa contra global.
6. Perfil público de tipster con rendimiento, estilo, riesgo y confianza verificable.
7. Herramientas conectadas a creación de apuesta.

## Decisiones aplicadas en este bloque

- Crear helpers puros para facts de decisión en `client/src/lib/decision-insights.ts`.
- Mantener UI en español y nombres de código en inglés.
- Separar `Banca real` de `P&L apuestas` y `Depósitos netos`.
- Usar señales objetivas como texto neutral: Yield, drawdown, outliers, live, stake tras rachas y verificabilidad.
- Corregir la gráfica de `Banca real` para que use todas las apuestas, incluso con filtros activos.
