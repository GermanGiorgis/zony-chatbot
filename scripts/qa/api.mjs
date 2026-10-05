// Exercises the real /api/chat with attachments and bad input. Uses the live model quota, so it is run by hand.
//   npm run dev -- -p 3100   (in another terminal)   then   npm run qa:api [basic|rename|invalid|docs|bad|links|more|multi]
// Set FAKE_IP to dodge the per-IP rate limit between runs.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const JSZip = require("jszip");
const URL_ = process.env.ZONY_URL ?? "http://localhost:3100/api/chat";

const dataUrl = (buf, mt) => `data:${mt};base64,${Buffer.from(buf).toString("base64")}`;
const user = (text, files = []) => ({
  id: crypto.randomUUID(), role: "user",
  parts: [...files.map((f) => ({ type: "file", mediaType: f.mt, filename: f.name, url: dataUrl(f.buf, f.mt) })), ...(text ? [{ type: "text", text }] : [])],
});

async function post(body, label) {
  const t0 = Date.now();
  const res = await fetch(URL_, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": process.env.FAKE_IP ?? "9.9.9.9" }, body: typeof body === "string" ? body : JSON.stringify(body) });
  const raw = await res.text();
  let text = "";
  for (const line of raw.split("\n")) {
    if (!line.startsWith("data:")) continue;
    try { const j = JSON.parse(line.slice(5)); if (j.type === "text-delta") text += j.delta; if (j.type === "error") text += `[ERR:${j.errorText}]`; } catch {}
  }
  const out = res.ok ? text : raw;
  console.log(`\n### ${label} -> ${res.status} (${Date.now() - t0}ms)\n${out.slice(0, 420).replace(/\n/g, " ⏎ ")}`);
  return { status: res.status, text: out };
}

const docx = async () => {
  const z = new JSZip();
  z.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  z.file("_rels/.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  z.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Informe de ventas Q3: el producto estrella fue Zafiro con 1.240 unidades.</w:t></w:r></w:p><w:p><w:r><w:t>El cliente con mayor gasto fue Ferretería Norte.</w:t></w:r></w:p></w:body></w:document>`);
  return z.generateAsync({ type: "nodebuffer" });
};
const pptx = async () => {
  const z = new JSZip();
  z.file("ppt/slides/slide1.xml", `<p:sld xmlns:a="a" xmlns:p="p"><a:p><a:r><a:t>Plan de lanzamiento &amp; metas</a:t></a:r></a:p><a:p><a:r><a:t>Fecha clave: 14 de marzo</a:t></a:r></a:p></p:sld>`);
  return z.generateAsync({ type: "nodebuffer" });
};
const pdf = () => {
  const stream = "BT /F1 18 Tf 50 700 Td (Contrato de alquiler: monto mensual 350 USD, vence el 1 de agosto.) Tj ET";
  const objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>", `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  let out = "%PDF-1.4\n"; const off = [];
  objs.forEach((o, i) => { off.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + off.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("") + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return Buffer.from(out);
};
// Solid red 32x32 PNG built by hand, so the script needs no image library.
import zlib from "node:zlib";
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, crc]); };
const png = async () => {
  const w = 32, h = 32, raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1); raw[o] = 0; raw[o + 1 + x * 3] = 220; raw[o + 2 + x * 3] = 30; raw[o + 3 + x * 3] = 30; }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
};

const which = process.argv[2] ?? "all";
const T = {
  async basic() { await post({ name: "Zony", messages: [user("Hola, ¿cómo te llamás y qué podés hacer? Respondé en 2 líneas.")] }, "básico"); },
  async rename() { await post({ name: "Pepe", messages: [user("¿Cómo te llamás?")] }, "nombre custom"); },
  async invalid() {
    await post("no es json", "cuerpo no-JSON");
    await post({ messages: "hola" }, "messages no-array");
    await post({ messages: [] }, "messages vacío");
    await post({ messages: [{ id: "a", role: "assistant", parts: [{ type: "text", text: "solo asistente" }] }] }, "sin mensaje de usuario");
    await post({ messages: [{ id: "a", role: "user", parts: [] }] }, "user sin partes");
  },
  async docs() {
    await post({ messages: [user("¿Cuál fue el producto estrella y el mejor cliente?", [{ name: "informe.docx", mt: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buf: await docx() }])] }, "docx");
    await post({ messages: [user("¿Qué fecha clave aparece?", [{ name: "plan.pptx", mt: "application/vnd.openxmlformats-officedocument.presentationml.presentation", buf: await pptx() }])] }, "pptx");
    await post({ messages: [user("¿Cuánto es el alquiler y cuándo vence?", [{ name: "contrato.pdf", mt: "application/pdf", buf: pdf() }])] }, "pdf");
    await post({ messages: [user("¿Qué color predomina?", [{ name: "foto.png", mt: "image/png", buf: await png() }])] }, "png");
    await post({ messages: [user("Sumá la columna monto.", [{ name: "datos.csv", mt: "text/csv", buf: Buffer.from("cliente,monto\nAna,100\nLuis,250\nEva,50\n") }])] }, "csv");
    await post({ messages: [user("", [{ name: "nota.txt", mt: "text/plain", buf: Buffer.from("Recordar comprar leche y pan el jueves.") }])] }, "txt sin texto");
  },
  async bad() {
    await post({ messages: [user("¿Qué dice?", [{ name: "raro.exe", mt: "application/x-msdownload", buf: Buffer.from("MZ....") }])] }, "exe");
    await post({ messages: [user("¿Qué dice?", [{ name: "roto.docx", mt: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buf: Buffer.from("no soy un zip") }])] }, "docx roto");
    await post({ messages: [user("¿Qué dice?", [{ name: "x.png", mt: "image/png", buf: Buffer.alloc(0) }])] }, "archivo vacío");
  },
  async links() {
    await post({ messages: [user("Resumime esta página en una línea: https://example.com")] }, "link web");
  },
  async tools() {
    await post({ messages: [user("¿Cuánto es el 15% de 2480 más 37 por 12? Calculalo.")] }, "calculadora");
    await post({ messages: [user("¿Qué hora es ahora en Tokio?")] }, "hora");
    await post({ messages: [user("¿Qué clima hace hoy en Rosario, Argentina?")] }, "clima");
    await post({ messages: [user("¿Qué clima hace en Xyzzyqwerty?")] }, "clima ciudad inexistente");
  },
  async more() {
    await post({ messages: [user("Sumá la columna monto y decime el total.", [{ name: "datos.csv", mt: "text/csv", buf: Buffer.from(["cliente,monto", "Ana,100", "Luis,250", "Eva,50", ""].join("\n")) }])] }, "csv");
    await post({ messages: [user("", [{ name: "nota.txt", mt: "text/plain", buf: Buffer.from("Recordar comprar leche y pan el jueves.") }])] }, "txt sin texto");
    await post({ messages: [user("¿Qué dice?", [{ name: "x.png", mt: "image/png", buf: Buffer.alloc(0) }])] }, "archivo vacío");
    await post({ messages: [user("Escribime una función en Python que invierta un string, con un ejemplo. Muy breve.")] }, "código");
  },
  async multi() {
    await post({ name: "Zony", messages: [user("Mi color favorito es el verde."), { id: "x", role: "assistant", parts: [{ type: "text", text: "¡Anotado! Verde." }] }, user("¿Cuál era mi color favorito?")] }, "memoria multi-turno");
  },
};
if (which === "all") for (const k of Object.keys(T)) await T[k](); else await T[which]();
