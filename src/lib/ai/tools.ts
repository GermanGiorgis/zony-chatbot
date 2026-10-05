import { tool } from "ai";
import { z } from "zod";
import { track } from "@/lib/analytics";
import { evaluate } from "./math";

/**
 * Tools the model can call on its own. All are read-only, take only a few characters of input and talk to fixed
 * hosts (never an address chosen by the visitor), so a prompt-injected call can do no harm: at worst it asks the
 * weather of a city. They return plain objects (with an `error` field instead of throwing) so the model can explain
 * what went wrong in its own words.
 */

const TIMEOUT_MS = 6000;

export const calculadora = tool({
  description:
    "Calcula una expresión matemática con exactitud. Usala SIEMPRE para cuentas (sumas, porcentajes, potencias, raíces…) en vez de calcular de memoria. Operadores: + - * / ^ %, paréntesis, pi, e y funciones sqrt, abs, round, floor, ceil, sin, cos, tan, ln, log, exp, min, max, pow. Los decimales llevan punto. Ejemplo para el 15% de 2480: \"2480 * 15%\".",
  inputSchema: z.object({ expresion: z.string().min(1).max(200).describe("La expresión a calcular, por ejemplo \"(12 + 8) * 3 / 4\"") }),
  execute: ({ expresion }) => {
    track("tool", { name: "calculadora" });
    try {
      const resultado = evaluate(expresion);
      return { expresion, resultado: Number(resultado.toPrecision(12)) };
    } catch (e) {
      return { expresion, error: e instanceof Error ? e.message : "no pude calcularlo" };
    }
  },
});

/** Date and time in an IANA zone (shared with the offline demo). */
export function timeIn(zonaHoraria: string) {
  try {
    const now = new Date();
    const parts = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-AR", { timeZone: zonaHoraria, ...opts }).format(now);
    return {
      zonaHoraria,
      fecha: parts({ dateStyle: "full" }),
      hora: parts({ hour: "2-digit", minute: "2-digit", hour12: false }),
    };
  } catch {
    return { zonaHoraria, error: "no reconozco esa zona horaria; usá un nombre como America/Argentina/Buenos_Aires o Europe/Madrid" };
  }
}

export const horaActual = tool({
  description:
    "Devuelve la fecha y la hora actuales en una zona horaria. Usala cuando pregunten qué hora o qué día es, ahora o en otra ciudad. Si no dicen dónde, usá America/Argentina/Buenos_Aires.",
  inputSchema: z.object({
    zonaHoraria: z.string().min(1).max(60).describe("Nombre IANA de la zona, por ejemplo America/Argentina/Buenos_Aires, Europe/Madrid, Asia/Tokyo"),
  }),
  execute: ({ zonaHoraria }) => {
    track("tool", { name: "horaActual" });
    return timeIn(zonaHoraria);
  },
});

const WEATHER: Record<number, string> = {
  0: "despejado",
  1: "mayormente despejado",
  2: "parcialmente nublado",
  3: "nublado",
  45: "niebla",
  48: "niebla con escarcha",
  51: "llovizna leve",
  53: "llovizna",
  55: "llovizna intensa",
  56: "llovizna helada",
  57: "llovizna helada intensa",
  61: "lluvia leve",
  63: "lluvia",
  65: "lluvia fuerte",
  66: "lluvia helada",
  67: "lluvia helada fuerte",
  71: "nevada leve",
  73: "nevada",
  75: "nevada fuerte",
  77: "granizo fino",
  80: "chubascos leves",
  81: "chubascos",
  82: "chubascos violentos",
  85: "chubascos de nieve",
  86: "chubascos de nieve fuertes",
  95: "tormenta",
  96: "tormenta con granizo",
  99: "tormenta fuerte con granizo",
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`el servicio del clima respondió ${res.status}`);
  return (await res.json()) as T;
}

type Geocoding = { results?: { name: string; country?: string; admin1?: string; latitude: number; longitude: number }[] };
type Forecast = {
  current?: { time: string; temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; weather_code: number; wind_speed_10m: number };
  daily?: { temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max?: (number | null)[] };
};

/** Current weather and today's forecast for a city (shared with the offline demo). */
export async function weatherFor(ciudad: string) {
  try {
    const geo = await getJson<Geocoding>(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ciudad)}&count=1&language=es&format=json`);
    const place = geo.results?.[0];
    if (!place) return { ciudad, error: "no encontré esa ciudad" };
    const url =
      "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${place.latitude}&longitude=${place.longitude}` +
      "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m" +
      "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1";
    const f = await getJson<Forecast>(url);
    if (!f.current) return { ciudad, error: "no hay datos del clima en este momento" };
    return {
      lugar: [place.name, place.admin1, place.country].filter(Boolean).join(", "),
      horaLocal: f.current.time.replace("T", " "),
      temperaturaC: f.current.temperature_2m,
      sensacionC: f.current.apparent_temperature,
      humedadPct: f.current.relative_humidity_2m,
      vientoKmH: f.current.wind_speed_10m,
      estado: WEATHER[f.current.weather_code] ?? "sin descripción",
      maximaHoyC: f.daily?.temperature_2m_max?.[0],
      minimaHoyC: f.daily?.temperature_2m_min?.[0],
      probabilidadLluviaPct: f.daily?.precipitation_probability_max?.[0] ?? undefined,
    };
  } catch (e) {
    return { ciudad, error: e instanceof Error && e.name === "TimeoutError" ? "el servicio del clima tardó demasiado" : "no pude consultar el clima ahora" };
  }
}

export const clima = tool({
  description:
    "Consulta el clima actual y el pronóstico de hoy de una ciudad (datos de Open-Meteo, sin clave). Usala cuando pregunten por el clima, la temperatura o si va a llover.",
  inputSchema: z.object({ ciudad: z.string().min(2).max(80).describe("Nombre de la ciudad, por ejemplo \"Buenos Aires\" o \"Madrid\"") }),
  execute: ({ ciudad }) => {
    track("tool", { name: "clima" });
    return weatherFor(ciudad);
  },
});

export const zonyTools = { calculadora, horaActual, clima };
export type ZonyToolName = keyof typeof zonyTools;
