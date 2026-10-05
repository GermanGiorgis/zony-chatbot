import type { UIMessage } from "ai";

/** A tool call inside an assistant message (the SDK types them per tool, as "tool-<name>"). */
export type ToolPart = {
  type: `tool-${string}`;
  toolCallId: string;
  state: "input-streaming" | "input-available" | "output-available" | "output-error" | string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  errorText?: string;
};

export const isToolPart = (p: UIMessage["parts"][number]): p is UIMessage["parts"][number] & ToolPart => p.type.startsWith("tool-");

const num = (v: unknown) => (typeof v === "number" ? v : undefined);
const str = (v: unknown) => (typeof v === "string" ? v : undefined);

/** One line saying what the robot did, while it runs and once it has the result. */
function describe(part: ToolPart): { icon: string; text: string; busy: boolean; failed: boolean } {
  const name = part.type.slice(5);
  const busy = part.state === "input-streaming" || part.state === "input-available";
  const out = part.output ?? {};
  const error = part.state === "output-error" ? (part.errorText ?? "falló") : str(out.error);

  if (name === "calculadora") {
    const expr = str(part.input?.expresion) ?? str(out.expresion);
    if (busy) return { icon: "🧮", text: expr ? `Calculando ${expr}…` : "Calculando…", busy, failed: false };
    if (error) return { icon: "🧮", text: `No pude calcular${expr ? ` ${expr}` : ""}: ${error}`, busy, failed: true };
    return { icon: "🧮", text: `${expr} = ${num(out.resultado)?.toLocaleString("es-AR", { maximumFractionDigits: 10 })}`, busy, failed: false };
  }
  if (name === "horaActual") {
    const zone = str(part.input?.zonaHoraria) ?? str(out.zonaHoraria);
    const city = zone?.split("/").pop()?.replace(/_/g, " ");
    if (busy) return { icon: "🕒", text: city ? `Mirando el reloj de ${city}…` : "Mirando el reloj…", busy, failed: false };
    if (error) return { icon: "🕒", text: `No pude ver la hora: ${error}`, busy, failed: true };
    return { icon: "🕒", text: `${city}: ${str(out.hora)} · ${str(out.fecha)}`, busy, failed: false };
  }
  if (name === "clima") {
    const city = str(part.input?.ciudad);
    if (busy) return { icon: "⛅", text: city ? `Consultando el clima de ${city}…` : "Consultando el clima…", busy, failed: false };
    if (error) return { icon: "⛅", text: `No pude consultar el clima${city ? ` de ${city}` : ""}: ${error}`, busy, failed: true };
    return { icon: "⛅", text: `${str(out.lugar)}: ${num(out.temperaturaC)}°C, ${str(out.estado)}`, busy, failed: false };
  }
  return { icon: "🔧", text: busy ? `Usando ${name}…` : `Usé ${name}`, busy, failed: !!error };
}

export function ToolChip({ part }: { part: ToolPart }) {
  const { icon, text, busy, failed } = describe(part);
  return (
    <div
      className={`mb-2 flex w-fit max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${failed ? "border-line text-muted" : "border-line bg-surface/80"}`}
      role="status"
    >
      <span aria-hidden="true" className={busy ? "animate-pulse" : ""}>
        {icon}
      </span>
      <span className="min-w-0 break-words">{text}</span>
    </div>
  );
}
