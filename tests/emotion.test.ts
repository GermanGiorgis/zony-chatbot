import assert from "node:assert/strict";
import { test } from "node:test";
import { firstSentence, reactionFor } from "../src/lib/emotion";

test("greetings wave, and good news cheers", () => {
  assert.equal(reactionFor("¡Hola! Soy Zony."), "wave");
  assert.equal(reactionFor("Buenas tardes, ¿en qué te ayudo?"), "wave");
  assert.equal(reactionFor("¡Felicitaciones, lo lograste!"), "cheer");
  assert.equal(reactionFor("Listo 🎉"), "cheer");
});

test("apologies and bad news droop, and win over agreement", () => {
  assert.equal(reactionFor("Lo siento, no pude abrir el archivo."), "droop");
  assert.equal(reactionFor("Sí, pero lamentablemente no tengo acceso a internet."), "droop");
  assert.equal(reactionFor("Perdón por la confusión."), "droop");
});

test("doubt shrugs, agreement nods, explanations present", () => {
  assert.equal(reactionFor("No estoy seguro, depende del caso."), "shrug");
  assert.equal(reactionFor("Claro, te lo explico."), "nod");
  assert.equal(reactionFor("Veamos cómo funciona, paso a paso."), "present");
});

test("plain statements get no gesture", () => {
  assert.equal(reactionFor("Un algoritmo es una secuencia de pasos."), null);
  assert.equal(reactionFor(""), null);
  assert.equal(reactionFor("Cholas y cholos"), null); // "hola" inside another word is not a greeting
});

test("takes the first finished sentence, or waits, or gives up waiting when the text is long", () => {
  assert.equal(firstSentence("¡Hola! Soy Zony y te ayudo."), "¡Hola!");
  assert.equal(firstSentence("Un algoritmo es una secuencia de pasos. Sirve para"), "Un algoritmo es una secuencia de pasos.");
  assert.equal(firstSentence("Un algoritmo es una secuencia"), null);
  assert.equal(firstSentence("a".repeat(200))?.length, 140);
  const sad = firstSentence("¡Qué mal lo de la notebook! 😔 Entiendo lo frustrante.");
  assert.equal(sad, "¡Qué mal lo de la notebook! 😔");
  assert.equal(reactionFor(sad ?? ""), "droop");
});
