"use strict";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const KEY = "draft-productos", KEYC = "draft-config";
let DATA, CFG;

const toast = (m) => { const t = $("#toast"); t.textContent = m; t.hidden = false; setTimeout(() => (t.hidden = true), 2500); };
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const nowIso = () => { const d = new Date(), o = -d.getTimezoneOffset(), p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00${o >= 0 ? "+" : "-"}${p(Math.floor(Math.abs(o) / 60))}:${p(Math.abs(o) % 60)}`; };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(DATA)); localStorage.setItem(KEYC, JSON.stringify(CFG)); } catch {} };
function download(name, text, type) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); URL.revokeObjectURL(a.href); }

function upsert(p) {
  const i = DATA.productos.findIndex((x) => x.id === p.id);
  if (i >= 0) {
    const old = DATA.productos[i];
    p.historial = [...(old.historial || [])];
    if (old.precio_actual !== p.precio_actual) p.historial.push({ fecha: old.fecha_verificacion.slice(0, 10), precio: old.precio_actual });
    DATA.productos[i] = p;
  } else DATA.productos.push(p);
}

function draw() {
  $("#n").textContent = DATA.productos.length;
  $("#rows").innerHTML = DATA.productos.map((p) => `<tr><td>${p.ejemplo ? "[EJEMPLO] " : ""}${esc(p.producto)} <span class="muted">${esc(p.formato)}</span></td><td>${esc(p.tienda)}</td><td>${p.precio_actual} €</td><td>${esc(p.fecha_verificacion.slice(0, 10))}</td><td><button class="btn ghost" type="button" data-del="${esc(p.id)}" aria-label="Eliminar ${esc(p.producto)}">Borrar</button></td></tr>`).join("");
  $("#stores").innerHTML = CFG.tiendas.map((t, i) => `<label class="small muted" style="display:block;margin-bottom:8px">${esc(t.nombre)} · acceso: ${esc(t.acceso)}<textarea data-store="${i}" style="min-height:48px">${esc(t.urls.join("\n"))}</textarea></label>`).join("");
}

$("#f").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  const num = (v) => (v === "" || v == null ? null : Number(v));
  const link = f.enlace.trim();
  if (link && !/^https?:\/\//.test(link)) return toast("El enlace debe empezar por http(s)://");
  const p = {
    id: slug(`${f.tienda}-${f.producto}-${f.formato}`), producto: f.producto, marca: f.marca, formato: f.formato, tienda: f.tienda,
    precio_actual: num(f.precio_actual), precio_anterior: num(f.precio_anterior), descuento_pct: num(f.descuento_pct),
    enlace: link, fecha_verificacion: nowIso(), disponibilidad: f.disponibilidad, categoria: f.categoria, tipo: f.tipo,
    grupo: f.grupo || null, motivo: f.motivo || null, ventaja: null, fecha_limite: f.fecha_limite || null,
    precio_desde: !!f.precio_desde, ejemplo: !!f.ejemplo, historial: [],
  };
  upsert(p); DATA.meta.actualizado = nowIso(); save(); draw(); toast("Guardado en borrador");
});
document.addEventListener("click", (e) => {
  const d = e.target.closest("[data-del]");
  if (d) { DATA.productos = DATA.productos.filter((p) => p.id !== d.dataset.del); save(); draw(); }
});
document.addEventListener("input", (e) => {
  const s = e.target.dataset.store; if (s == null) return;
  CFG.tiendas[s].urls = e.target.value.split("\n").map((x) => x.trim()).filter(Boolean); save();
});
$("#dl-json").onclick = () => download("productos.json", JSON.stringify(DATA, null, 1), "application/json");
$("#dl-cfg").onclick = () => download("config.json", JSON.stringify(CFG, null, 1), "application/json");
$("#dl-csv").onclick = () => {
  const cols = ["producto", "marca", "formato", "tienda", "precio_actual", "precio_anterior", "descuento_pct", "enlace", "fecha_verificacion", "disponibilidad", "categoria"];
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  download("productos.csv", [cols.join(","), ...DATA.productos.map((p) => cols.map((c) => q(p[c])).join(","))].join("\n"), "text/csv");
};
$("#reset").onclick = () => { try { localStorage.removeItem(KEY); localStorage.removeItem(KEYC); } catch {} location.reload(); };
$("#imp").onclick = () => {
  try {
    const j = JSON.parse($("#paste").value); const arr = Array.isArray(j) ? j : j.productos;
    if (!Array.isArray(arr)) throw 0;
    arr.forEach((p) => { if (!p.id || typeof p.precio_actual !== "number") throw 0; upsert(p); });
    save(); draw(); toast(`${arr.length} importados`);
  } catch { toast("JSON no válido: cada producto necesita id y precio_actual"); }
};

(async () => {
  const get = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  DATA = get(KEY) || (await (await fetch("data/productos.json", { cache: "no-cache" })).json());
  CFG = get(KEYC) || (await (await fetch("data/config.json", { cache: "no-cache" })).json());
  $("#tienda").innerHTML = CFG.tiendas.map((t) => `<option>${esc(t.nombre)}</option>`).join("");
  $("#categoria").innerHTML = Object.entries(CFG.categorias).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");
  draw();
})().catch(() => toast("Abre el panel desde un servidor (ver README)"));
