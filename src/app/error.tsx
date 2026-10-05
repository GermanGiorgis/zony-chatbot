"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-6 text-center text-ink">
      <div className="max-w-sm space-y-4">
        <h1 className="font-display text-3xl font-bold tracking-tight">Algo se rompió de mi lado</h1>
        <p className="text-muted">La página tuvo un error inesperado. Tus conversaciones guardadas no se perdieron.</p>
        <button
          type="button"
          onClick={reset}
          className="cursor-pointer rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-transform duration-150 ease-out active:scale-[0.97]"
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}
