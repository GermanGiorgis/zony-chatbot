import assert from "node:assert/strict";
import { test } from "node:test";
import { demoAnswer, mathIn } from "../src/lib/ai/demo";

const ask = (text: string, weather?: Parameters<typeof demoAnswer>[1]["weather"]) => demoAnswer(text, { name: "Zony", reason: "quota", weather });

test("calculates for real, in Spanish phrasing too", () => {
  assert.deepEqual(mathIn("¿Cuánto es el 15% de 2480?"), { expression: "2480 * 15%", result: 372 });
  assert.equal(mathIn("raíz cuadrada de 144")?.result, 12);
  assert.equal(mathIn("(12 + 8) * 3 / 4")?.result, 15);
  assert.equal(mathIn("2,5 * 4")?.result, 10);
  assert.equal(mathIn("hola, tengo 3 gatos"), null);
});

test("every answer says it is the demo", async () => {
  for (const text of ["hola", "(1+2)*3", "escribime una función en python", "cómo estás hecho", "asdf qwerty"]) {
    assert.match(await ask(text), /Modo demo/, text);
  }
});

test("the note changes with the reason", async () => {
  assert.match(await demoAnswer("hola", { name: "Zony", reason: "nokey" }), /no tiene una IA conectada/);
  assert.match(await ask("hola"), /llegó a su límite de hoy/);
});

test("greets with the name the visitor gave the robot", async () => {
  assert.match(await demoAnswer("Presentate", { name: "Robi", reason: "quota" }), /Soy Robi/);
});

test("answers the clock and the weather, with the city it was asked about", async () => {
  const time = await ask("¿Qué hora es en Tokio?");
  assert.match(time, /En Tokio es /);
  let asked = "";
  const weather = async (city: string) => {
    asked = city;
    return { lugar: "Madrid, España", horaLocal: "", temperaturaC: 21, sensacionC: 20, humedadPct: 40, vientoKmH: 5, estado: "despejado", maximaHoyC: 25, minimaHoyC: 14, probabilidadLluviaPct: 10 };
  };
  const answer = await ask("¿Qué clima hace en Madrid?", weather);
  assert.equal(asked, "Madrid");
  assert.match(answer, /21 °C/);
});

test("a weather failure is reported instead of thrown", async () => {
  const answer = await ask("clima en Narnia", async (ciudad) => ({ ciudad, error: "no encontré esa ciudad" }));
  assert.match(answer, /No pude consultar el clima de Narnia/);
});

test("unknown questions get the list of things to try", async () => {
  assert.match(await ask("blablabla"), /Probá con/);
});
