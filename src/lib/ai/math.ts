/**
 * Small arithmetic evaluator for the calculator tool. It parses the text itself (no eval, no Function), so whatever the
 * model or a visitor puts in it can only ever produce a number or an error.
 *
 * Supports: + - * / ^ (and **), %, parentheses, unary minus, the constants pi and e, and the functions
 * sqrt, abs, round, floor, ceil, sin, cos, tan, ln, log (base 10), exp, min, max, pow.
 */

type Token = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

const FUNCS: Record<string, (...a: number[]) => number> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
  min: Math.min,
  max: Math.max,
  pow: Math.pow,
};
const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

const MAX_LENGTH = 200;
const MAX_DEPTH = 40;

function tokenize(input: string): Token[] {
  const out: Token[] = [];
  const s = input.toLowerCase().replace(/×/g, "*").replace(/÷/g, "/").replace(/\s+/g, "");
  for (let i = 0; i < s.length; ) {
    const rest = s.slice(i);
    const num = /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/.exec(rest);
    if (num) {
      out.push({ t: "num", v: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    const id = /^[a-z_][a-z0-9_]*/.exec(rest);
    if (id) {
      out.push({ t: "id", v: id[0] });
      i += id[0].length;
      continue;
    }
    if (rest.startsWith("**")) {
      out.push({ t: "op", v: "^" });
      i += 2;
      continue;
    }
    if ("+-*/^%(),".includes(rest[0])) {
      out.push({ t: "op", v: rest[0] });
      i++;
      continue;
    }
    throw new Error(`carácter no válido: "${rest[0]}"`);
  }
  return out;
}

export function evaluate(expression: string): number {
  if (expression.length > MAX_LENGTH) throw new Error("la expresión es demasiado larga");
  const tokens = tokenize(expression);
  if (!tokens.length) throw new Error("la expresión está vacía");
  let pos = 0;

  const peek = () => tokens[pos];
  const isOp = (v: string) => peek()?.t === "op" && peek()!.v === v;
  const take = () => tokens[pos++];

  // expr = term (("+" | "-") term)*
  function expr(depth: number): number {
    if (depth > MAX_DEPTH) throw new Error("demasiados paréntesis anidados");
    let v = term(depth);
    while (isOp("+") || isOp("-")) v = take().v === "+" ? v + term(depth) : v - term(depth);
    return v;
  }
  // term = unary (("*" | "/") unary)*
  function term(depth: number): number {
    let v = unary(depth);
    while (isOp("*") || isOp("/")) {
      const op = take().v;
      const r = unary(depth);
      if (op === "/" && r === 0) throw new Error("división por cero");
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }
  // unary = "-" unary | power
  function unary(depth: number): number {
    if (isOp("-")) {
      take();
      return -unary(depth);
    }
    if (isOp("+")) {
      take();
      return unary(depth);
    }
    return power(depth);
  }
  // power = postfix ("^" unary)?   (right associative)
  function power(depth: number): number {
    const base = postfix(depth);
    if (isOp("^")) {
      take();
      return base ** unary(depth);
    }
    return base;
  }
  // postfix = primary "%"*
  function postfix(depth: number): number {
    let v = primary(depth);
    while (isOp("%")) {
      take();
      v /= 100;
    }
    return v;
  }
  function primary(depth: number): number {
    const tok = take();
    if (!tok) throw new Error("la expresión está incompleta");
    if (tok.t === "num") return tok.v;
    if (tok.t === "op" && tok.v === "(") {
      const v = expr(depth + 1);
      if (!isOp(")")) throw new Error("falta cerrar un paréntesis");
      take();
      return v;
    }
    if (tok.t === "id") {
      if (isOp("(")) {
        const fn = FUNCS[tok.v];
        if (!fn) throw new Error(`función desconocida: ${tok.v}`);
        take();
        const args: number[] = [];
        if (!isOp(")")) {
          args.push(expr(depth + 1));
          while (isOp(",")) {
            take();
            args.push(expr(depth + 1));
          }
        }
        if (!isOp(")")) throw new Error("falta cerrar un paréntesis");
        take();
        return fn(...args);
      }
      if (tok.v in CONSTANTS) return CONSTANTS[tok.v];
      throw new Error(`no conozco "${tok.v}"`);
    }
    throw new Error(`no esperaba "${tok.v}"`);
  }

  const result = expr(0);
  if (pos < tokens.length) throw new Error(`no esperaba "${tokens[pos].v}"`);
  if (!Number.isFinite(result)) throw new Error("el resultado no es un número finito");
  return result;
}
