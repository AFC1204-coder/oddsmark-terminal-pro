import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, HeartHandshake, Mail, Scale, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";

export type LegalPageType = "privacy" | "terms" | "responsible-gaming" | "support";

const pageByPath: Record<string, LegalPageType> = {
  "/privacidad": "privacy",
  "/condiciones": "terms",
  "/juego-responsable": "responsible-gaming",
  "/soporte": "support",
  "/privacy": "privacy",
  "/terms": "terms",
  "/responsible-gaming": "responsible-gaming",
  "/support": "support",
};

const pageMeta: Record<LegalPageType, { eyebrow: string; title: string; description: string; icon: ReactNode; sections: Array<{ title: string; body: string }> }> = {
  privacy: {
    eyebrow: "Privacidad",
    title: "Tus datos dentro de Oddsmark",
    description: "Resumen práctico para la beta: qué guardamos, por qué lo usamos y qué puede hacerse público si lo activas.",
    icon: <ShieldCheck className="h-5 w-5" />,
    sections: [
      {
        title: "Datos de cuenta",
        body: "Usamos email, proveedor de acceso y datos básicos de sesión para autenticarte. La autenticación se apoya en Supabase y no vendemos datos personales.",
      },
      {
        title: "Datos de actividad",
        body: "Guardamos apuestas, banca, estrategias, transacciones y preferencias para construir tu historial privado, métricas y estados de producto.",
      },
      {
        title: "Perfil público",
        body: "Solo se muestra fuera de tu cuenta si publicas una ficha. Las apuestas compartidas o verificables enseñan lo necesario para comprobar el registro, no información privada innecesaria.",
      },
      {
        title: "Beta y soporte",
        body: "Los mensajes de feedback se registran para priorizar mejoras y resolver incidencias. Evita incluir contraseñas, documentos o datos sensibles en esos mensajes.",
      },
    ],
  },
  terms: {
    eyebrow: "Condiciones",
    title: "Uso responsable de la beta",
    description: "Oddsmark es un registro analítico. No vende picks, no garantiza rentabilidad y no sustituye tu criterio.",
    icon: <Scale className="h-5 w-5" />,
    sections: [
      {
        title: "Producto en beta",
        body: "La app puede cambiar, tener errores o limitar funciones durante la beta controlada. Mantén copia de cualquier información crítica para ti.",
      },
      {
        title: "Sin asesoramiento",
        body: "Las métricas, señales y tarjetas son herramientas de seguimiento. No son recomendaciones de apuesta ni promesas de beneficio.",
      },
      {
        title: "Contenido compartido",
        body: "Eres responsable de lo que publicas desde tu perfil o tarjetas. No uses Oddsmark para suplantar identidad, manipular resultados o engañar a terceros.",
      },
      {
        title: "Integridad",
        body: "Cuando existe hash público, la verificación sirve para comprobar cuándo se registró una apuesta. Si no existe prueba, la interfaz debe indicarlo con claridad.",
      },
    ],
  },
  "responsible-gaming": {
    eyebrow: "Juego responsable",
    title: "Apuesta solo si puedes parar",
    description: "La app debe ayudarte a medir riesgo, no a normalizar pérdidas ni perseguir resultados.",
    icon: <HeartHandshake className="h-5 w-5" />,
    sections: [
      {
        title: "Mayores de edad",
        body: "Usa Oddsmark únicamente si eres mayor de edad y si las apuestas están permitidas en tu jurisdicción.",
      },
      {
        title: "Límites claros",
        body: "Define banca, unidad y exposición máxima antes de apostar. Si rompes tus reglas, pausa y revisa el patrón antes de seguir.",
      },
      {
        title: "Señales de alerta",
        body: "Deja de apostar si intentas recuperar pérdidas, ocultas actividad, aumentas stake por ansiedad o te cuesta cerrar sesión.",
      },
      {
        title: "Ayuda externa",
        body: "Si el juego afecta tu economía, descanso o relaciones, busca apoyo profesional y usa herramientas de autoexclusión disponibles en tu país.",
      },
    ],
  },
  support: {
    eyebrow: "Soporte beta",
    title: "Reporta bugs y fricciones",
    description: "Durante la beta priorizamos errores de confianza, verificación, datos, móvil y flujos críticos.",
    icon: <Mail className="h-5 w-5" />,
    sections: [
      {
        title: "Feedback dentro de la app",
        body: "Usa el botón Feedback del dashboard para enviar incidencias con la ruta actual. Así podemos revisar el contexto sin pedirte capturas largas.",
      },
      {
        title: "Qué incluir",
        body: "Cuenta qué intentabas hacer, qué esperabas ver y qué ocurrió. Si afecta a verificación o share cards, indica si la apuesta tenía hash real.",
      },
      {
        title: "Contacto",
        body: "Para incidencias de acceso a la beta, escribe a soporte@oddsmark.app indicando tu email de cuenta y el dispositivo usado.",
      },
    ],
  },
};

export function getLegalPageType(pathname: string): LegalPageType | null {
  return pageByPath[pathname] ?? null;
}

export default function LegalPage({ type }: { type: LegalPageType }) {
  const [, setLocation] = useLocation();
  const page = pageMeta[type];

  return (
    <main className="terminal-shell min-h-screen text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-5 sm:px-6 lg:py-8">
        <header className="flex items-center justify-between gap-4">
          <button onClick={() => setLocation("/")} className="flex items-center" aria-label="Volver a Oddsmark">
            <BrandLogo className="h-8 w-44" imageClassName="max-h-full" />
          </button>
          <Button variant="outline" size="sm" onClick={() => setLocation("/auth")} className="rounded-full">
            Entrar
          </Button>
        </header>

        <section className="max-w-3xl pt-6">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="-ml-3 mb-6 rounded-full text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/70 bg-foreground/[0.04] px-3 py-1 text-[10px] font-bold uppercase text-muted-foreground">
            {page.icon}
            {page.eyebrow}
          </div>
          <h1 className="max-w-2xl text-3xl font-black leading-tight tracking-normal sm:text-5xl">{page.title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{page.description}</p>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          {page.sections.map((section) => (
            <article key={section.title} className="surface-panel rounded-lg p-4">
              <h2 className="text-sm font-black text-foreground">{section.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{section.body}</p>
            </article>
          ))}
        </section>

        <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 py-5 text-xs text-muted-foreground">
          <button onClick={() => setLocation("/privacidad")} className="hover:text-foreground">Privacidad</button>
          <button onClick={() => setLocation("/condiciones")} className="hover:text-foreground">Condiciones</button>
          <button onClick={() => setLocation("/juego-responsable")} className="hover:text-foreground">Juego responsable</button>
          <button onClick={() => setLocation("/soporte")} className="hover:text-foreground">Soporte</button>
        </footer>
      </div>
    </main>
  );
}
