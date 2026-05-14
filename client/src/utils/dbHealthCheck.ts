import { supabase } from "@/lib/supabase";

const DUMMY_MARKER = "__DB_HEALTH_CHECK__";

interface TableCheckResult {
  success: boolean;
  error?: string;
  missingColumns?: string[];
  sqlRepairCommands?: string[];
}

interface HealthCheckResult {
  success: boolean;
  betsCheck: TableCheckResult;
  profilesCheck: TableCheckResult;
  transactionsCheck: TableCheckResult;
  allSqlCommands: string[];
}

function extractMissingColumn(errorMessage: string): string | null {
  const patterns = [
    /column "([^"]+)" (?:of relation|does not exist)/i,
    /Could not find column '([^']+)'/i,
    /Could not find the '([^']+)' column/i,
    /Unknown column: ([^\s,]+)/i,
  ];
  for (const pattern of patterns) {
    const match = errorMessage.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function inferSqlType(value: unknown): string {
  if (value === null || value === undefined) return "text";
  if (typeof value === "boolean") return "boolean DEFAULT false";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return "integer";
    return "real";
  }
  if (Array.isArray(value)) return "text[]";
  if (typeof value === "object") return "jsonb";
  return "text";
}

function generateSqlRepair(table: string, column: string, sampleValue: unknown): string {
  const sqlType = inferSqlType(sampleValue);
  return `ALTER TABLE ${table} ADD COLUMN ${column} ${sqlType};`;
}

const ALL_BET_COLUMNS: Record<string, unknown> = {
  date: "2026-01-15",
  sport: "Test Sport",
  competition: "Test League",
  event: DUMMY_MARKER,
  market: "Test Market",
  selection: "Test Selection",
  odds: 1.5,
  stake: 10,
  line: 0.5,
  bet_type: "simple",
  status: "pending",
  time: "12:00",
  bookie: "Test Bookie",
  tipster: "Test Tipster",
  selections: JSON.stringify([{ event: "test", odds: 1.5 }]),
  is_live: false,
  is_cashout: false,
  cashout_val: 5.5,
  current_cashout: 8.0,
  is_long_term: false,
  resolution_date: "2026-02-15",
  comment: "Test comment",
  strategy_id: null,
  position: "GK",
  formation: "4-3-3",
  player: "Test Player",
  is_substitute: false,
  tactic: "Defensive",
  tags: ["test", "health", "check"],
  market_type: "1X2",
  match_side: "home",
  image_url: "https://example.com/test.jpg",
  verified: false,
  closing_odds: 1.6,
  is_value: false,
  is_parlay: false,
};

const ALL_PROFILE_COLUMNS: Record<string, unknown> = {
  unit_value: 25,
  initial_capital: 1000,
  target_bankroll: 5000,
  currency: "EUR",
  updated_at: new Date().toISOString(),
};

const ALL_TRANSACTION_COLUMNS: Record<string, unknown> = {
  type: "deposit",
  amount: 100.0,
  date: "2026-01-15",
  note: "Test transaction",
  category: "bankroll",
};

async function findMissingColumns(
  table: string,
  allColumns: Record<string, unknown>,
  requiredFields: Record<string, unknown>,
  cleanupField: { key: string; value: unknown }
): Promise<{ missing: string[]; sqlCommands: string[] }> {
  const missing: string[] = [];
  const sqlCommands: string[] = [];

  for (const [column, value] of Object.entries(allColumns)) {
    if (column in requiredFields) continue;

    const testPayload = { ...requiredFields, [column]: value };
    const { error } = await supabase.from(table).insert(testPayload).select().single();

    if (error) {
      const missingCol = extractMissingColumn(error.message);
      if (missingCol === column || error.message.toLowerCase().includes(column.toLowerCase())) {
        missing.push(column);
        sqlCommands.push(generateSqlRepair(table, column, value));
      }
    } else {
      await supabase.from(table).delete().eq(cleanupField.key, cleanupField.value);
    }
  }

  return { missing, sqlCommands };
}

async function checkBetsTable(userId: string): Promise<TableCheckResult> {
  console.log("📋 PRUEBA 1: Verificando tabla 'bets' (" + Object.keys(ALL_BET_COLUMNS).length + " columnas)...");

  const dummyBet = { user_id: userId, ...ALL_BET_COLUMNS };
  const { data: insertedBet, error } = await supabase.from("bets").insert(dummyBet).select().single();

  if (error) {
    console.log("   ⚠️ Error detectado, buscando columnas faltantes...");
    const { missing, sqlCommands } = await findMissingColumns(
      "bets",
      ALL_BET_COLUMNS,
      { user_id: userId, event: DUMMY_MARKER, market: "Test", odds: 1, stake: 1, status: "pending", date: "2026-01-15" },
      { key: "event", value: DUMMY_MARKER }
    );

    if (missing.length > 0) {
      return { success: false, error: error.message, missingColumns: missing, sqlRepairCommands: sqlCommands };
    }
    return { success: false, error: error.message };
  }

  console.log("   ✅ Inserción exitosa");
  await supabase.from("bets").delete().eq("id", insertedBet.id);
  console.log("   ✅ Limpieza completada");
  return { success: true };
}

async function checkProfilesTable(userId: string): Promise<TableCheckResult> {
  console.log("\n📋 PRUEBA 2: Verificando tabla 'profiles' (" + Object.keys(ALL_PROFILE_COLUMNS).length + " columnas)...");

  const { data: existing } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  const originalValues = existing ? { ...existing } : null;

  const profilePayload = { id: userId, ...ALL_PROFILE_COLUMNS };
  const { error } = await supabase.from("profiles").upsert(profilePayload, { onConflict: "id" }).select().single();

  if (error) {
    const missingCol = extractMissingColumn(error.message);
    const sqlCommands = missingCol ? [generateSqlRepair("profiles", missingCol, ALL_PROFILE_COLUMNS[missingCol] ?? "")] : [];
    return { success: false, error: error.message, missingColumns: missingCol ? [missingCol] : [], sqlRepairCommands: sqlCommands };
  }

  console.log("   ✅ Actualización exitosa");

  if (originalValues) {
    await supabase.from("profiles").update(originalValues).eq("id", userId);
    console.log("   ✅ Valores originales restaurados");
  }

  return { success: true };
}

async function checkTransactionsTable(userId: string): Promise<TableCheckResult> {
  console.log("\n📋 PRUEBA 3: Verificando tabla 'transactions' (" + Object.keys(ALL_TRANSACTION_COLUMNS).length + " columnas)...");

  const dummyTransaction = { user_id: userId, ...ALL_TRANSACTION_COLUMNS, note: DUMMY_MARKER };
  const { data: inserted, error } = await supabase.from("transactions").insert(dummyTransaction).select().single();

  if (error) {
    console.log("   ⚠️ Error detectado, buscando columnas faltantes...");
    const { missing, sqlCommands } = await findMissingColumns(
      "transactions",
      ALL_TRANSACTION_COLUMNS,
      { user_id: userId, type: "deposit", amount: 100, date: "2026-01-15" },
      { key: "note", value: DUMMY_MARKER }
    );

    if (missing.length > 0) {
      return { success: false, error: error.message, missingColumns: missing, sqlRepairCommands: sqlCommands };
    }
    return { success: false, error: error.message };
  }

  console.log("   ✅ Inserción exitosa");
  await supabase.from("transactions").delete().eq("id", inserted.id);
  console.log("   ✅ Limpieza completada");
  return { success: true };
}

export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  console.log("\n" + "═".repeat(60));
  console.log("🏥 DB HEALTH CHECK - AUTO-REPARACIÓN v2.0");
  console.log("═".repeat(60) + "\n");

  const result: HealthCheckResult = {
    success: false,
    betsCheck: { success: false },
    profilesCheck: { success: false },
    transactionsCheck: { success: false },
    allSqlCommands: [],
  };

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("❌ Usuario no autenticado. Inicia sesión primero.");
      return result;
    }

    console.log(`✅ Usuario: ${user.email}\n`);

    result.betsCheck = await checkBetsTable(user.id);
    result.profilesCheck = await checkProfilesTable(user.id);
    result.transactionsCheck = await checkTransactionsTable(user.id);

    const allMissing: { table: string; columns: string[]; sql: string[] }[] = [];

    if (result.betsCheck.missingColumns?.length) {
      allMissing.push({ table: "bets", columns: result.betsCheck.missingColumns, sql: result.betsCheck.sqlRepairCommands || [] });
    }
    if (result.profilesCheck.missingColumns?.length) {
      allMissing.push({ table: "profiles", columns: result.profilesCheck.missingColumns, sql: result.profilesCheck.sqlRepairCommands || [] });
    }
    if (result.transactionsCheck.missingColumns?.length) {
      allMissing.push({ table: "transactions", columns: result.transactionsCheck.missingColumns, sql: result.transactionsCheck.sqlRepairCommands || [] });
    }

    result.allSqlCommands = allMissing.flatMap((m) => m.sql);
    result.success = result.betsCheck.success && result.profilesCheck.success && result.transactionsCheck.success;

    console.log("\n" + "═".repeat(60));

    if (result.success) {
      console.log("✅ SISTEMA 100% OPERATIVO");
      console.log("   Tablas verificadas: bets, profiles, transactions");
      console.log("   Todas las columnas existen y son escribibles");
    } else {
      console.error("❌ FALTAN COLUMNAS EN SUPABASE\n");

      for (const item of allMissing) {
        console.error(`   📦 Tabla '${item.table}':`);
        item.columns.forEach((col) => console.error(`      - ${col}`));
      }

      if (result.allSqlCommands.length > 0) {
        console.error("\n" + "─".repeat(60));
        console.error("🔧 EJECUTA ESTO EN SUPABASE SQL EDITOR:\n");
        result.allSqlCommands.forEach((sql) => console.error(sql));
        console.error("\n" + "─".repeat(60));
      }
    }

    console.log("═".repeat(60) + "\n");

    return result;
  } catch (err) {
    console.error("❌ Error inesperado:", err);
    return result;
  }
}

if (typeof window !== "undefined") {
  (window as unknown as { dbHealthCheck: typeof checkDatabaseHealth }).dbHealthCheck = checkDatabaseHealth;
  console.log("💡 DB Health Check disponible: Ejecuta window.dbHealthCheck() en la consola");

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session?.user) {
      console.log("🔔 DB Health Check: Usuario detectado, ejecutando verificación completa...");
      setTimeout(() => checkDatabaseHealth(), 2000);
    }
  });
}
