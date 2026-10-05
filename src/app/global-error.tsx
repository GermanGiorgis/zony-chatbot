"use client";

/** Last resort when even the root layout fails: it has to bring its own <html> and cannot rely on the app's styles. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#f3efe6", color: "#1c1a17", fontFamily: "system-ui, sans-serif", textAlign: "center", padding: 24 }}>
        <div style={{ maxWidth: 360 }}>
          <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>Algo se rompió de mi lado</h1>
          <p style={{ opacity: 0.7, margin: "0 0 20px" }}>La página tuvo un error inesperado. Tus conversaciones guardadas no se perdieron.</p>
          <button type="button" onClick={reset} style={{ cursor: "pointer", border: 0, borderRadius: 999, padding: "10px 20px", background: "#1c1a17", color: "#f3efe6", fontSize: 14 }}>
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
