import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluate } from "../src/lib/ai/math";

test("does arithmetic with the usual precedence", () => {
  assert.equal(evaluate("1 + 2 * 3"), 7);
  assert.equal(evaluate("(1 + 2) * 3"), 9);
  assert.equal(evaluate("2 ^ 3 ^ 2"), 512); // right associative
  assert.equal(evaluate("2 ** 10"), 1024);
  assert.equal(evaluate("-3 + 5"), 2);
  assert.equal(evaluate("10 / 4"), 2.5);
});

test("understands percentages, constants and functions", () => {
  assert.equal(evaluate("2480 * 15%"), 372);
  assert.equal(evaluate("200 + 10%"), 200.1); // % divides by 100: the caller writes 200 * (1 + 10%) for a raise
  assert.ok(Math.abs(evaluate("pi * 2") - 6.283185307) < 1e-8);
  assert.equal(evaluate("sqrt(144) + max(3, 9, 4)"), 21);
  assert.equal(evaluate("round(2.6) + floor(2.9) + ceil(2.1)"), 8);
});

test("accepts × and ÷ as written in messages", () => {
  assert.equal(evaluate("6 × 7"), 42);
  assert.equal(evaluate("84 ÷ 2"), 42);
});

test("reports errors instead of guessing or crashing", () => {
  assert.throws(() => evaluate("1 / 0"), /división por cero/);
  assert.throws(() => evaluate("2 +"), /incompleta/);
  assert.throws(() => evaluate("(2 + 3"), /paréntesis/);
  assert.throws(() => evaluate("foo(2)"), /función desconocida/);
  assert.throws(() => evaluate("xyz"), /no conozco/);
  assert.throws(() => evaluate(""), /vacía/);
  assert.throws(() => evaluate("1e999"), /finito/);
});

test("cannot be used to run code", () => {
  for (const evil of ["process.exit(1)", "require('fs')", "constructor.constructor('return 1')()", "this", "globalThis", "1;alert(1)", "`${1}`"]) {
    assert.throws(() => evaluate(evil), Error, evil);
  }
});

test("refuses absurd inputs", () => {
  assert.throws(() => evaluate("1+".repeat(200) + "1"), /demasiado larga/);
  assert.throws(() => evaluate("(".repeat(60) + "1" + ")".repeat(60)), /anidados/);
});
