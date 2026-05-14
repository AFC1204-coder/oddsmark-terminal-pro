import { supabase } from "@/lib/supabase";

export async function testSupabaseConnection() {
  console.log("🔍 DB Check: Iniciando verificación de conexión...");

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error("❌ DB Check: Error de autenticación:", authError.message);
      return false;
    }

    if (!user) {
      console.log("⚠️ DB Check: No hay usuario autenticado. Inicia sesión primero.");
      return false;
    }

    console.log("✅ DB Check: Usuario autenticado:", user.email);

    const { data: profile, error: readError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (readError) {
      console.error("❌ DB Check: Error leyendo perfil:", readError.message);
      return false;
    }

    console.log("✅ DB Check: Perfil leído:", profile ? "Existe" : "No existe (se creará)");

    const testPayload = {
      id: user.id,
      unit_value: profile?.unit_value ?? 10,
      target_bankroll: profile?.target_bankroll ?? 0,
      updated_at: new Date().toISOString(),
    };

    console.log("🔍 DB Check: Enviando update de prueba:", testPayload);

    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .upsert(testPayload, { onConflict: "id" })
      .select()
      .single();

    if (updateError) {
      console.error("❌ DB Check: Error actualizando perfil:", updateError.message);
      console.error("❌ DB Check: Código:", updateError.code);
      console.error("❌ DB Check: Detalles:", updateError.details);
      console.error("❌ DB Check: Hint:", updateError.hint);
      return false;
    }

    console.log("✅ DB Check: Perfil actualizado correctamente");
    console.log("✅ DB Check: Datos guardados:", {
      id: updatedProfile.id,
      unit_value: updatedProfile.unit_value,
      target_bankroll: updatedProfile.target_bankroll,
      updated_at: updatedProfile.updated_at,
    });

    return true;
  } catch (err) {
    console.error("❌ DB Check: Error inesperado:", err);
    return false;
  }
}

if (typeof window !== "undefined") {
  (window as unknown as { testDB: typeof testSupabaseConnection }).testDB = testSupabaseConnection;
  console.log("💡 DB Check: Ejecuta window.testDB() en la consola para probar la conexión");
  
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session?.user) {
      console.log("🔔 DB Check: Usuario detectado, ejecutando verificación automática...");
      setTimeout(() => testSupabaseConnection(), 1000);
    }
  });
}
