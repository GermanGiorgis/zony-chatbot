import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Créditos · Zony" };

const link = "underline underline-offset-2 transition-colors hover:text-accent-text";

export default function Credits() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl bg-paper px-5 py-10 text-ink">
      <Link href="/" className={`text-sm text-muted ${link}`}>
        ← Volver al chat
      </Link>
      <h1 className="mt-6 font-display text-4xl font-bold tracking-tight">Créditos</h1>

      <section className="mt-8 space-y-3">
        <h2 className="font-display text-xl font-bold">Robot y escenas</h2>
        <p className="text-muted">
          El robot, sus piezas y los seis fondos de escena están dibujados con código: no usan fotografías ni imágenes de terceros. Los
          fondos se generan con un script del repositorio (<code className="font-mono text-sm">scripts/build-scenes.mjs</code>).
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="font-display text-xl font-bold">Tecnología</h2>
        <p className="text-muted">
          Next.js, React, Tailwind CSS, Vercel AI SDK, three.js con React Three Fiber y Motion. Respuestas generadas con modelos de
          Google Gemini y, como respaldo, de Groq.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="font-display text-xl font-bold">Tus datos</h2>
        <p className="text-muted">
          Las conversaciones se guardan solo en este navegador. Los mensajes y archivos que enviás se procesan con Gemini y Groq en sus capas
          gratuitas, que pueden usar el contenido para mejorar sus servicios: no subas datos sensibles. Si dictás con el micrófono, el
          reconocimiento de voz lo hace tu navegador (en Chrome y Edge, enviando el audio a sus servidores).
        </p>
      </section>
    </main>
  );
}
