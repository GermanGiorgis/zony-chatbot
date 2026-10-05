import assert from "node:assert/strict";
import { test } from "node:test";
import { guessLang, pickVoice, splitForSpeech, toSpeakable } from "../src/lib/speech";

test("turns Markdown into something a voice can read", () => {
  const md = "## Título\n\nUsá **negrita** y `código`.\n\n- primero\n- segundo\n\nMirá [la doc](https://example.com/x) 🎉";
  assert.equal(toSpeakable(md), "Título. Usá negrita y código. primero. segundo. Mirá la doc.");
});

test("summarises code blocks, tables and bare links instead of reading them", () => {
  assert.equal(toSpeakable("Acá va:\n```python\nprint(1)\n```\nListo"), "Acá va: Bloque de código. Listo.");
  assert.equal(toSpeakable("```js\nsin cerrar"), "Bloque de código.");
  assert.equal(toSpeakable("| a | b |\n|---|---|\n| 1 | 2 |"), "a, b. 1, 2.");
  assert.match(toSpeakable("Entrá a https://example.com/larga/ruta?x=1 ahora"), /Entrá a un enlace ahora\./);
});

test("keeps sentences whole and chunks them under the limit", () => {
  const text = "Primera frase corta. Segunda frase corta. " + "palabra ".repeat(60).trim() + ". Última.";
  const chunks = splitForSpeech(text, 100);
  assert.ok(chunks.every((c) => c.length <= 100), JSON.stringify(chunks.map((c) => c.length)));
  assert.equal(chunks.join(" ").replace(/\s+/g, " "), text.replace(/\s+/g, " "));
  assert.equal(splitForSpeech("Hola.", 100).length, 1);
  assert.deepEqual(splitForSpeech("", 100), []);
});

test("tells Spanish from English", () => {
  assert.equal(guessLang("Claro, te explico cómo funciona y por qué es importante para el proyecto."), "es");
  assert.equal(guessLang("Sure, here is how it works and what you can do with it in your project."), "en");
  assert.equal(guessLang("OK"), "es");
});

test("prefers Rioplatense/Latin American Spanish and the better engines", () => {
  const voices = [
    { name: "Microsoft Helena", lang: "es-ES" },
    { name: "Google español de Estados Unidos", lang: "es-US" },
    { name: "Microsoft Elena Online (Natural)", lang: "es-AR" },
    { name: "Samantha", lang: "en-US" },
  ];
  assert.equal(pickVoice(voices, "es")?.name, "Microsoft Elena Online (Natural)");
  assert.equal(pickVoice(voices, "en")?.name, "Samantha");
  assert.equal(pickVoice([{ name: "Solo inglés", lang: "en-GB" }], "es"), undefined);
  assert.equal(pickVoice([{ name: "Helena", lang: "es-ES" }, { name: "Paulina", lang: "es-MX" }], "es")?.name, "Paulina");
});
