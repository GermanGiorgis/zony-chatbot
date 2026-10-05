import assert from "node:assert/strict";
import { test } from "node:test";
import { friendlyError } from "../src/lib/ai/errors";

function quiet<T>(fn: () => T): T {
  const original = console.error;
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.error = original;
  }
}

test("maps provider failures to something the visitor can act on, using the robot's name", () => {
  assert.match(quiet(() => friendlyError({ statusCode: 429, message: "quota" }, "Pepe")), /^Pepe llegó al límite gratuito/);
  assert.match(quiet(() => friendlyError({ statusCode: 413 })), /demasiado grandes/);
  assert.match(quiet(() => friendlyError({ statusCode: 503 })), /saturado/);
  assert.match(quiet(() => friendlyError({ statusCode: 400 })), /archivo esté dañado/);
  assert.match(quiet(() => friendlyError(new Error("boom"))), /Algo salió mal/);
});

test("never leaks key names or file paths to visitors", () => {
  const msg = quiet(() => friendlyError({ statusCode: 401, message: "API key not valid" }));
  assert.ok(!/AIza|gsk_/.test(msg));
  assert.ok(!msg.includes("\\"));
});

test("does not log the request body of an SDK error", () => {
  const logged: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => void logged.push(args);
  try {
    friendlyError({ statusCode: 500, message: "x", requestBodyValues: { contents: "TEXTO PRIVADO DEL USUARIO" } });
  } finally {
    console.error = original;
  }
  assert.ok(!JSON.stringify(logged).includes("TEXTO PRIVADO"));
});
