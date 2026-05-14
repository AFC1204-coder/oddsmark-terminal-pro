import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { AlertCircle, ArrowRight, CheckCircle2, KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

type AuthAction = "password" | "register" | "magic" | "google";

const trustItems = [
  "Prueba pre-evento cuando existe hash público.",
  "Banca separada de depósitos, retiros y P&L.",
  "Sin picks ni promesas de rentabilidad: solo registro, métricas y pruebas.",
];

function getAuthErrorMessage(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "Email o contraseña incorrectos.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Confirma tu email antes de iniciar sesión.";
  }
  if (normalized.includes("user not found") || normalized.includes("signup")) {
    return "No encontramos una cuenta activa con ese email.";
  }
  if (normalized.includes("rate limit") || normalized.includes("too many")) {
    return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
  }
  if (normalized.includes("supabase no está configurado")) {
    return "Supabase no está configurado en este preview.";
  }
  return "No se pudo completar la autenticación. Revisa los datos e inténtalo de nuevo.";
}

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const {
    isConfigured,
    error: authError,
    signInWithEmail,
    signInWithMagicLink,
    signUp,
    signInWithGoogle,
  } = useSupabaseAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activeAction, setActiveAction] = useState<AuthAction | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isBusy = activeAction !== null;

  const requireEmail = () => {
    if (email.trim()) return true;
    const message = "Introduce tu email.";
    setErrorMessage(message);
    toast({ title: message, variant: "destructive" });
    return false;
  };

  const requireConfigured = (description: string) => {
    if (isConfigured) return true;
    const message = "Auth no configurado";
    setErrorMessage("Añade VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para activar el acceso.");
    toast({ title: message, description, variant: "destructive" });
    return false;
  };

  const runAuthAction = async (action: AuthAction, task: () => Promise<{ error: Error | null }>) => {
    setNotice(null);
    setErrorMessage(null);
    setActiveAction(action);
    const { error } = await task();
    setActiveAction(null);
    if (error) {
      const message = getAuthErrorMessage(error.message);
      setErrorMessage(message);
      toast({ title: "No se pudo autenticar", description: message, variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleSignIn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!requireEmail()) return;
    if (!password) {
      const message = "Introduce tu contraseña.";
      setErrorMessage(message);
      toast({ title: message, variant: "destructive" });
      return;
    }
    if (!requireConfigured("El login con contraseña necesita Supabase activo.")) return;

    await runAuthAction("password", () => signInWithEmail(email.trim(), password));
  };

  const handleSignUp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!requireEmail()) return;
    if (!password) {
      const message = "Crea una contraseña.";
      setErrorMessage(message);
      toast({ title: message, variant: "destructive" });
      return;
    }
    if (!requireConfigured("El registro necesita Supabase activo.")) return;
    if (password.length < 6) {
      const message = "La contraseña debe tener al menos 6 caracteres.";
      setErrorMessage(message);
      toast({ title: message, variant: "destructive" });
      return;
    }

    const ok = await runAuthAction("register", () => signUp(email.trim(), password));
    if (ok) {
      const message = "Cuenta creada. Si tu proyecto requiere confirmación, revisa tu email.";
      setNotice(message);
      toast({ title: "Cuenta creada", description: message });
    }
  };

  const handleMagicLink = async () => {
    if (!requireEmail()) return;
    if (!requireConfigured("El enlace mágico necesita Supabase activo.")) return;

    const ok = await runAuthAction("magic", () => signInWithMagicLink(email.trim()));
    if (ok) {
      const message = "Te hemos enviado un enlace de acceso si el email pertenece a la beta.";
      setNotice(message);
      toast({ title: "Revisa tu email", description: message });
    }
  };

  const handleGoogleSignIn = async () => {
    if (!requireConfigured("Google requiere VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.")) return;
    await runAuthAction("google", () => signInWithGoogle());
  };

  return (
    <main className="min-h-screen bg-background text-foreground" data-testid="page-auth">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(23rem,28rem)] lg:items-center lg:gap-12 lg:py-8">
        <section className="hidden min-h-[38rem] flex-col justify-between rounded-lg border border-border/70 bg-card/45 p-8 shadow-2xl shadow-black/20 lg:flex">
          <div>
            <BrandLogo className="h-10 w-52" imageClassName="max-h-full" />
            <div className="mt-14 max-w-xl">
              <p className="mono-section-title">Acceso beta</p>
              <h1 className="mt-3 text-5xl font-black leading-none tracking-normal">Oddsmark</h1>
              <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
                Panel privado para registrar apuestas, controlar banca real y compartir pruebas verificables sin maquillar el historial.
              </p>
            </div>
          </div>

          <div className="grid max-w-xl gap-2">
            {trustItems.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-md border border-border/60 bg-background/45 px-3 py-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                <p className="text-sm leading-snug text-muted-foreground">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex min-h-screen flex-col justify-center py-4 lg:min-h-0 lg:py-0">
          <div className="mb-8 flex justify-center lg:hidden">
            <BrandLogo className="h-10 w-48" imageClassName="max-h-full" />
          </div>

          <div className="surface-panel overflow-hidden rounded-lg" data-testid="card-auth">
            <div className="border-b border-border/70 px-4 py-4 sm:px-5">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border/70 bg-foreground/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase text-muted-foreground">
                <KeyRound className="h-3 w-3" />
                Beta controlada
              </div>
              <h2 className="text-2xl font-black tracking-normal">Accede a Oddsmark</h2>
              <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Historial, banca y pruebas públicas en una sola cuenta.
              </p>
            </div>

            <div className="px-4 py-4 sm:px-5">
              {!isConfigured && (
                <div className="mb-4 rounded-lg border border-pending/35 bg-pending/10 p-3 text-sm text-foreground">
                  <div className="flex gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-pending" />
                    <p>
                      Preview sin Supabase configurado. Puedes revisar la interfaz, pero login, registro, Google y enlace mágico quedan desactivados.
                    </p>
                  </div>
                </div>
              )}

              {(errorMessage || authError) && (
                <div className="mb-4 rounded-lg border border-loss/35 bg-loss/10 p-3 text-sm text-foreground" role="alert">
                  <div className="flex gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-loss" />
                    <p>{errorMessage || authError}</p>
                  </div>
                </div>
              )}

              {notice && !errorMessage && (
                <div className="mb-4 rounded-lg border border-win/30 bg-win/10 p-3 text-sm text-foreground" role="status">
                  <div className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-win" />
                    <p>{notice}</p>
                  </div>
                </div>
              )}

              <Tabs defaultValue="login" className="w-full">
                <TabsList className="mono-pill grid h-10 w-full grid-cols-2 p-1">
                  <TabsTrigger value="login" data-testid="tab-login" className="h-8 rounded-full text-xs">
                    Iniciar sesión
                  </TabsTrigger>
                  <TabsTrigger value="register" data-testid="tab-register" className="h-8 rounded-full text-xs">
                    Crear cuenta
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="mt-5">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        placeholder="tu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-11 rounded-lg bg-muted/45"
                        data-testid="input-login-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Contraseña</Label>
                      <Input
                        id="login-password"
                        type="password"
                        autoComplete="current-password"
                        placeholder="********"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-11 rounded-lg bg-muted/45"
                        data-testid="input-login-password"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="h-11 w-full rounded-full font-black"
                      disabled={isBusy || !isConfigured}
                      data-testid="button-login-submit"
                    >
                      {activeAction === "password" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar con contraseña"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full rounded-full font-bold"
                      onClick={handleMagicLink}
                      disabled={isBusy || !isConfigured}
                      data-testid="button-magic-link"
                    >
                      {activeAction === "magic" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Mail className="h-4 w-4" />
                          Enviar enlace mágico
                        </>
                      )}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="register" className="mt-5">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-email">Email</Label>
                      <Input
                        id="register-email"
                        type="email"
                        autoComplete="email"
                        placeholder="tu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-11 rounded-lg bg-muted/45"
                        data-testid="input-register-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-password">Contraseña</Label>
                      <Input
                        id="register-password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-11 rounded-lg bg-muted/45"
                        data-testid="input-register-password"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="h-11 w-full rounded-full font-black"
                      disabled={isBusy || !isConfigured}
                      data-testid="button-register-submit"
                    >
                      {activeAction === "register" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          Crear cuenta
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Si el proyecto requiere confirmación, recibirás un email antes de entrar.
                    </p>
                  </form>
                </TabsContent>
              </Tabs>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/60" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-card px-2 font-bold text-muted-foreground">O continúa con</span>
                </div>
              </div>

              <Button
                variant="outline"
                className="h-11 w-full rounded-full font-bold"
                onClick={handleGoogleSignIn}
                disabled={isBusy || !isConfigured}
                data-testid="button-google-signin"
              >
                {activeAction === "google" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                  Continuar con Google
                </>
              )}
              </Button>
            </div>
            <div className="border-t border-border/70 px-4 py-3 sm:px-5">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Oddsmark registra y analiza tu historial. No ofrece asesoramiento, picks ni garantías de rentabilidad.
                Usa la app solo donde esté permitido.
              </p>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <button onClick={() => setLocation("/privacidad")} className="hover:text-foreground">Privacidad</button>
                <button onClick={() => setLocation("/condiciones")} className="hover:text-foreground">Condiciones</button>
                <button onClick={() => setLocation("/juego-responsable")} className="hover:text-foreground">Juego responsable</button>
                <button onClick={() => setLocation("/soporte")} className="hover:text-foreground">Soporte</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
