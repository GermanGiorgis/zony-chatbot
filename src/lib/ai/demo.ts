import { evaluate } from "./math";
import { timeIn, weatherFor } from "./tools";

/**
 * Demo mode: what Zony says when there is no AI behind it, either because the free quota of every model is spent for the
 * day or because the server has no key. It never pretends to be the real thing: every reply ends with a note saying so.
 * A few things do work for real without a model (the calculator, the clock and the weather); the rest are canned
 * answers about the project, matched by keywords.
 */

export type DemoReason = "quota" | "nokey";

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const ZONES: [RegExp, string, string][] = [
  [/buenos aires|argentina/, "America/Argentina/Buenos_Aires", "Buenos Aires"],
  [/madrid|espana/, "Europe/Madrid", "Madrid"],
  [/tokio|tokyo|japon/, "Asia/Tokyo", "Tokio"],
  [/nueva york|new york/, "America/New_York", "Nueva York"],
  [/londres|london/, "Europe/London", "Londres"],
  [/paris/, "Europe/Paris", "París"],
  [/berlin/, "Europe/Berlin", "Berlín"],
  [/roma/, "Europe/Rome", "Roma"],
  [/mexico/, "America/Mexico_City", "Ciudad de México"],
  [/santiago|chile/, "America/Santiago", "Santiago"],
  [/bogota/, "America/Bogota", "Bogotá"],
  [/lima|peru/, "America/Lima", "Lima"],
  [/montevideo|uruguay/, "America/Montevideo", "Montevideo"],
  [/sao paulo|brasil/, "America/Sao_Paulo", "San Pablo"],
  [/los angeles/, "America/Los_Angeles", "Los Ángeles"],
  [/sidney|sydney/, "Australia/Sydney", "Sídney"],
];

const num = (n: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 6 }).format(n);

/** The arithmetic in a message, if any: "15% de 2480", "raíz de 144", "(12 + 8) * 3 / 4". */
export function mathIn(text: string): { expression: string; result: number } | null {
  const t = normalize(text).replace(/(\d),(\d)/g, "$1.$2");
  const candidates: string[] = [];
  const percent = t.match(/(\d+(?:\.\d+)?)\s*%\s*de\s*(\d+(?:\.\d+)?)/);
  if (percent) candidates.push(`${percent[2]} * ${percent[1]}%`);
  const root = t.match(/raiz(?:\s+cuadrada)?\s+de\s+(\d+(?:\.\d+)?)/);
  if (root) candidates.push(`sqrt(${root[1]})`);
  const expr = t.match(/[\d(][\d\s.+\-*/^%()]*[+\-*/^%][\d\s.+\-*/^%()]*[\d)]/);
  if (expr) candidates.push(expr[0].trim());
  for (const expression of candidates) {
    try {
      const result = evaluate(expression);
      if (Number.isFinite(result)) return { expression, result };
    } catch {}
  }
  return null;
}

// Whole words only: "lima" is inside "clima".
const zoneIn = (t: string) => ZONES.find(([re]) => new RegExp("(?<![a-z])(?:" + re.source + ")(?![a-z])").test(t));

function cityIn(text: string): string {
  const t = text.replace(/[¿?¡!.,]/g, " ");
  const m = t.match(/\b(?:en|de|para)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+(?!y\b|hoy\b|ahora\b|que\b|qué\b|hace\b)[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+){0,2})/i);
  const city = m?.[1]?.trim();
  return city && !/^(el|la|los|las|un|una|este|esta|ahora|hoy)$/i.test(city) ? city : "Buenos Aires";
}

const CODE_ANSWER = `Te dejo un ejemplo en Python: una función que cuenta las palabras de un texto.

\`\`\`python
def contar_palabras(texto: str) -> int:
    """Devuelve cuántas palabras tiene el texto."""
    return len(texto.split())


print(contar_palabras("Hola, soy un robot con mucho código"))  # 7
\`\`\`

Paso a paso:

1. \`texto.split()\` corta el texto en cada espacio y devuelve una lista de palabras.
2. \`len(...)\` cuenta cuántos elementos tiene esa lista.
3. La anotación \`: str\` y \`-> int\` es opcional: documenta qué entra y qué sale.

En el modo normal puedo escribir, explicar y corregir código en cualquier lenguaje; este es un ejemplo fijo para que veas cómo se muestra.`;

const TECH_ANSWER = `Así estoy hecho:

- **Interfaz:** Next.js 16, React 19, TypeScript y Tailwind CSS 4.
- **IA:** Vercel AI SDK v7 con respuestas en streaming. Pruebo una cadena de modelos de Gemini en capa gratuita y, si se agotan, cae a Groq; los modelos que fallan "descansan" un rato para no hacerte esperar.
- **Cuerpo:** un robot 3D procedural (React Three Fiber, sin modelos descargados) con un rig propio: gestos, reacciones según lo que se dice y la boca que sigue la voz.
- **Escenas:** los seis fondos los dibuja un script con perspectiva, sin imágenes de terceros.
- **Archivos:** PDF, imágenes y audio van al modelo; Word, Excel y PowerPoint se convierten a texto en el servidor.
- **Calidad:** pruebas unitarias, pruebas de integración con Chrome headless y CI en GitHub.

Este modo demo es justamente la última red de seguridad: cuando la cuota gratuita se agota, sigo respondiendo en vez de mostrar un error.`;

const ROBOT_ANSWER = `Mi cuerpo se personaliza como en un MMORPG: tocá **Personalizar** y elegí cabeza, torso, brazos, piernas, ropa, sombrero, lentes, colores, acabado y fondo. También podés cambiarme el nombre y usar el botón **Aleatorio** si no te decidís.

Reacciono a lo que decimos: saludo, asiento, me encojo de hombros cuando algo falla y festejo las buenas noticias.`;

const VOICE_ANSWER = `Tengo voz, y funciona con tu navegador, sin costo:

- El micrófono del cuadro de texto **dicta** lo que decís.
- El botón **Voz** de arriba hace que lea mis respuestas en voz alta y que lo que dictás se envíe solo.
- Mientras hablo, mi boca sigue cada palabra.

El dictado anda en Chrome y Edge; en otros navegadores el botón del micrófono no aparece.`;

const FILES_ANSWER = `En el modo normal leo PDF, Word, Excel, PowerPoint, imágenes, audio, texto y código, además de enlaces de páginas web y de YouTube. Adjuntás el archivo con el clip del cuadro de texto (hasta 3 MB) y me pedís un resumen, una explicación o lo que necesites.

En el modo demo no puedo leer tus archivos: necesito la IA real para eso.`;

const GREETING = (name: string) => `¡Hola! Soy ${name}, un chatbot con cuerpo de robot 3D. En el modo normal explico, resuelvo problemas, programo y leo tus archivos (PDF, Word, Excel, PowerPoint, imágenes, audio y enlaces). También tengo calculadora, hora y clima, voz y un cuerpo que se personaliza desde **Personalizar**.`;

const HELP = `Ahora estoy en modo demo, así que respondo con ejemplos y con las herramientas que no necesitan IA. Probá con:

- "¿Cuánto es el 15% de 2480?" o "(12 + 8) * 3 / 4"
- "¿Qué hora es en Tokio?"
- "¿Qué clima hace en Madrid?"
- "Presentate"
- "Escribime una función en Python"
- "¿Cómo estás hecho?"`;

const NOTE: Record<DemoReason, string> = {
  quota: "🧪 *Modo demo: la IA gratuita llegó a su límite de hoy, así que respondo con respuestas de ejemplo. Volvé más tarde para chatear con la IA real.*",
  nokey: "🧪 *Modo demo: este servidor no tiene una IA conectada, así que respondo con respuestas de ejemplo.*",
};

type Deps = { weather?: typeof weatherFor };

/** The answer for one message, in Markdown (with the demo note at the end). */
export async function demoAnswer(text: string, { name, reason, weather = weatherFor }: { name: string; reason: DemoReason } & Deps): Promise<string> {
  const t = normalize(text);
  const parts: string[] = [];

  const math = mathIn(text);
  if (math) parts.push(`**${math.expression.replace(/\*/g, "×")}** = **${num(math.result)}**`);

  const asksTime = /\bhora\b|que dia es|\bfecha\b/.test(t);
  if (asksTime) {
    const zone = zoneIn(t) ?? ZONES[0];
    const now = timeIn(zone[1]);
    parts.push("error" in now ? "No pude consultar la hora." : `En ${zone[2]} es ${now.fecha}, ${now.hora} h.`);
  }

  if (/clima|temperatura|llover|lluvia|pronostico/.test(t)) {
    const place = zoneIn(t)?.[2] ?? cityIn(text);
    const w = await weather(place);
    if ("error" in w) parts.push(`No pude consultar el clima de ${place} ahora (${w.error}).`);
    else {
      const rain = w.probabilidadLluviaPct != null ? `, con ${w.probabilidadLluviaPct}% de probabilidad de lluvia` : "";
      parts.push(`En ${w.lugar} hay ${w.temperaturaC} °C (sensación de ${w.sensacionC} °C), ${w.estado}. Hoy va de ${w.minimaHoyC} a ${w.maximaHoyC} °C${rain}.`);
    }
  }

  if (!parts.length) {
    if (/\[se omitio|adjunt|archivo|\bpdf\b|\bword\b|\bexcel\b|powerpoint|documento|\bimagen\b|resum/.test(t)) parts.push(FILES_ANSWER);
    else if (/python|funcion|codigo|programa|javascript|script|algoritmo|java\b/.test(t)) parts.push(CODE_ANSWER);
    else if (/tecnolog|stack|arquitectura|hecho|construid|programad|como (funcionas|estas hecho)|modelos?\b|cuota|gemini|groq|\bnext\b|react/.test(t)) parts.push(TECH_ANSWER);
    else if (/\bvoz\b|dictar|microfono|escuchar|hablar/.test(t)) parts.push(VOICE_ANSWER);
    else if (/robot|personaliz|cuerpo|nombre|ropa|fondo|sombrero/.test(t)) parts.push(ROBOT_ANSWER);
    else if (/^\W*(hola|buenas|hey|buen dia|que tal|holis)|presenta|quien (sos|eres)|que (sabes|podes|puedes|haces)|ayuda/.test(t)) parts.push(GREETING(name));
    else if (/gracias|chau|adios|hasta luego/.test(t)) parts.push("¡De nada! Cuando quieras seguimos.");
    else parts.push(HELP);
  }

  const dev = process.env.NODE_ENV === "development" && reason === "nokey" ? "\n\n*(En desarrollo: agregá GOOGLE_GENERATIVE_AI_API_KEY en .env.local y reiniciá el servidor.)*" : "";
  return `${parts.join("\n\n")}\n\n> ${NOTE[reason]}${dev}`;
}
