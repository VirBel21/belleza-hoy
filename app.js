"use strict";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const eur = (n) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
const fdate = (iso) => new Date(iso).toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" });
const fday = (iso) => new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

let DATA, CFG, watch = new Set(store.get("watch", []));
const F = { g: "todo", q: "", cat: "", store: "", brand: "", pct: 0, watch: false };
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// ---------- cálculo ----------
function pct(p) {
  if (p.descuento_pct != null) return { v: p.descuento_pct, calc: false };
  if (p.precio_anterior && p.precio_anterior > p.precio_actual)
    return { v: Math.round((1 - p.precio_actual / p.precio_anterior) * 100), calc: true };
  return { v: 0, calc: false };
}
const stockTag = (p) => p.disponibilidad === "no disponible" ? '<span class="tag bad">No disponible</span> ' : p.disponibilidad === "no confirmada" ? '<span class="tag">Stock sin confirmar</span> ' : "";
const hasLink = (p) => /^https?:\/\//.test(p.enlace || "");
function prevPrice(p) {
  const h = (p.historial || []).filter((x) => x.fecha < p.fecha_verificacion.slice(0, 10));
  return h.length ? h[h.length - 1].precio : null;
}
function passes(p) {
  if (F.g === "moda" && p.categoria !== "moda") return false;
  if (F.g === "belleza" && p.categoria === "moda") return false;
  if (F.q && !norm(`${p.marca} ${p.producto} ${p.tienda} ${p.categoria}`).includes(norm(F.q.trim()))) return false;
  if (F.cat && p.categoria !== F.cat) return false;
  if (F.store && p.tienda !== F.store) return false;
  if (F.brand && p.marca !== F.brand) return false;
  if (pct(p).v < F.pct) return false;
  if (F.watch && !watch.has(p.id)) return false;
  return true;
}

// ---------- componentes ----------
function spark(p) {
  const h = (p.historial || []).map((x) => x.precio);
  if (h.length < 2) return `<p class="meta">Historial: sin datos suficientes todavía.</p>`;
  const min = Math.min(...h), max = Math.max(...h), r = max - min || 1;
  const pts = h.map((v, i) => `${i === 0 ? "M" : "L"}${(i / (h.length - 1)) * 100} ${26 - ((v - min) / r) * 24}`).join(" ");
  const last = h[h.length - 1], first = h[0];
  const txt = last < first ? `Ha bajado ${eur(first - last)} desde ${fday(p.historial[0].fecha)}` : last > first ? `Ha subido desde ${fday(p.historial[0].fecha)}` : "Sin cambios en el periodo";
  return `<svg class="spark" viewBox="0 0 100 28" preserveAspectRatio="none" role="img" aria-label="Historial de precio: ${esc(txt)}"><path d="${pts}"/></svg><p class="meta">${esc(txt)}</p>`;
}

function card(p, opts = {}) {
  const d = pct(p);
  return `<article class="card">
    <div class="ph" style="--h:${(p.marca.charCodeAt(0) * 37) % 360}">${p.imagen ? `<img src="${esc(p.imagen)}" alt="${esc(p.marca + " " + p.producto)} (imagen de ${esc(p.tienda)})" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}<span aria-hidden="true">${esc(p.marca[0] || "?")}</span></div>
    <div>${p.ejemplo ? '<span class="tag ej">EJEMPLO</span> ' : ""}${stockTag(p)}${!hasLink(p) ? '<span class="tag bad">No verificado</span>' : ""}</div>
    <h3>${esc(p.producto)}</h3>
    <div class="meta">${esc(p.marca)} · ${esc(p.formato)} · ${esc(p.tienda)}</div>
    <div class="price-row">
      <span class="price">${p.precio_desde ? "desde " : ""}${eur(p.precio_actual)}</span>
      ${p.precio_anterior ? `<span class="old">${eur(p.precio_anterior)}</span>` : ""}
      ${d.v ? `<span class="pct" title="${d.calc ? "Cálculo propio" : "Dato de la tienda"}">−${d.v}%${d.calc ? "*" : ""}</span>` : ""}
    </div>
    ${d.calc ? '<div class="meta">* % calculado por nosotros.</div>' : ""}
    ${p.valoracion && p.valoracion.n >= 5 ? `<div class="rating" title="Valoración de los clientes de ${esc(p.valoracion.fuente)}, no nuestra"><span aria-hidden="true">★</span> <strong>${String(p.valoracion.nota).replace(".", ",")}</strong> <span class="meta">(${p.valoracion.n.toLocaleString("es-ES")} valoraciones en ${esc(p.valoracion.fuente)})</span></div>` : ""}
    ${p.motivo ? `<p class="meta"><strong>Por qué suena:</strong> ${esc(p.motivo)}</p>` : ""}
    ${p.ventaja ? `<p class="meta"><strong>Ventaja:</strong> ${esc(p.ventaja)}</p>` : ""}
    ${p.fecha_limite ? `<div class="meta">Hasta el ${fday(p.fecha_limite)}</div>` : ""}
    ${opts.noSpark ? "" : spark(p)}
    <div class="meta">Verificado: ${fdate(p.fecha_verificacion)}</div>
    <div class="go">
      ${hasLink(p) ? `<a class="btn" href="${esc(p.enlace)}" target="_blank" rel="noopener noreferrer${CFG.afiliados ? " sponsored" : ""}">Ir a la oferta</a>` : `<span class="btn ghost" aria-disabled="true">Sin enlace</span>`}
      <button class="fav" type="button" data-id="${esc(p.id)}" aria-pressed="${watch.has(p.id)}" aria-label="Guardar ${esc(p.producto)} en mi lista">${watch.has(p.id) ? "♥" : "♡"}</button>
    </div>
  </article>`;
}

const grid = (items, max) => {
  const l = items.slice(0, max);
  return l.length ? `<div class="grid">${l.map((p) => card(p)).join("")}</div>` : `<div class="empty">Sin datos verificados hoy para esta sección (o ningún resultado con estos filtros).</div>`;
};

function comparator(items) {
  const groups = {};
  items.forEach((p) => (groups[p.grupo] ??= []).push(p));
  const gl = Object.values(groups).sort((x, y) => new Set(y.map((p) => p.tienda)).size - new Set(x.map((p) => p.tienda)).size).slice(0, 8);
  const out = gl.map((all) => {
    const fc = {};
    all.forEach((p) => (fc[p.formato] = (fc[p.formato] || 0) + 1));
    const ref = Object.entries(fc).sort((a, b) => b[1] - a[1])[0][0];
    const same = all.filter((p) => p.formato === ref), other = all.filter((p) => p.formato !== ref);
    const ok = same.filter((p) => p.disponibilidad !== "no disponible");
    const best = ok.length > 1 ? ok.reduce((a, b) => (a.precio_actual <= b.precio_actual ? a : b)) : null;
    const rows = same.sort((a, b) => a.precio_actual - b.precio_actual).map((p) => `
      <tr class="${p === best ? "best" : ""}"><td>${esc(p.tienda)} ${p === best ? '<span class="tag good">Más barato</span>' : ""}
        ${stockTag(p)}</td>
        <td class="num">${p.precio_desde ? "desde " : ""}${eur(p.precio_actual)}</td>
        <td class="meta">${fdate(p.fecha_verificacion)}</td>
        <td>${hasLink(p) ? `<a href="${esc(p.enlace)}" target="_blank" rel="noopener noreferrer">Ficha</a>` : '<span class="unver">No verificado</span>'}
        <button class="fav" type="button" data-id="${esc(p.id)}" aria-pressed="${watch.has(p.id)}" aria-label="Guardar en mi lista">${watch.has(p.id) ? "♥" : "♡"}</button></td></tr>`).join("");
    const ej = same[0].ejemplo ? '<span class="tag ej">EJEMPLO</span> ' : "";
    return `<div class="cmp"><h3>${ej}${esc(same[0].producto)} · ${esc(same[0].marca)} · ${esc(ref)}</h3>
      ${same.length < 2 ? '<p class="meta">Solo tenemos precio en una tienda; no hay comparación posible.</p>' : ""}
      <div class="tblwrap"><table><thead><tr><th>Tienda</th><th>Precio</th><th>Verificado</th><th>Enlace</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${other.length ? `<p class="meta">Excluido por formato distinto (no comparable): ${other.map((p) => `${esc(p.tienda)} ${esc(p.formato)} a ${eur(p.precio_actual)}`).join("; ")}.</p>` : ""}
      ${best ? "" : same.length > 1 ? '<p class="meta">No hay suficientes tiendas con stock para marcar la más barata.</p>' : ""}
    </div>`;
  });
  return out.length ? out.join("") : `<div class="empty">Sin datos verificados hoy para esta sección (o ningún resultado con estos filtros).</div>`;
}

// ---------- render ----------
const byType = (t) => DATA.productos.filter((p) => p.tipo === t && passes(p));
const halActive = () => {
  const c = CFG.campana; if (!c) return false;
  const end = new Date(c.hasta + "T23:59:59"); return new Date() <= end;
};
function render() {
  const active = !!(F.q || F.cat || F.store || F.brand || F.pct || F.watch);
  const show = (id, on) => { $(id).hidden = !on; };
  const beauty = F.g !== "moda", fashion = F.g !== "belleza";
  ["#flash", "#comparador", "#perfumes", "#kbeauty", "#virales"].forEach((id) => show(id, beauty && !active));
  show("#halloween", beauty && !active && halActive());
  $("#nav-hal").hidden = !halActive();
  show("#moda", fashion && !active);
  show("#results", active);
  if (active) {
    const r = DATA.productos.filter(passes).sort((x, y) => pct(y).v - pct(x).v);
    $("#res-n").textContent = `(${r.length})`;
    $("#res-out").innerHTML = r.length ? `<div class="grid">${r.map((p) => card(p)).join("")}</div>` : `<div class="empty">No hay productos verificados con esa búsqueda. Prueba con otra marca o quita filtros.</div>`;
  }
  const flash = DATA.productos
    .filter((p) => p.tipo === "flash" && passes(p) && pct(p).v >= DATA.meta.umbral_flash && p.disponibilidad !== "no disponible")
    .filter((p) => !(p.mostrada_antes && !(prevPrice(p) != null && p.precio_actual < prevPrice(p))))
    .sort((a, b) => pct(b).v - pct(a).v);
  $("#flash-out").innerHTML = flash.length ? grid(flash, 6)
    : `<div class="empty">Hoy no hay descuentos realmente destacables (umbral: ${DATA.meta.umbral_flash} %).</div>`;
  $("#cmp-out").innerHTML = comparator(byType("comparador"));
  $("#hal-out").innerHTML = grid(byType("halloween").sort((a, b) => pct(b).v - pct(a).v), 8);
  $("#perf-out").innerHTML = grid(byType("perfume").sort((a, b) => pct(b).v - pct(a).v), 8);
  $("#kb-out").innerHTML = grid(byType("kbeauty"), 5);
  $("#moda-out").innerHTML = grid(byType("moda"), 6);
  $("#vir-out").innerHTML = grid(byType("viral"), 5);
  const wl = DATA.productos.filter((p) => watch.has(p.id));
  render.after?.();
  $("#wl-out").innerHTML = wl.length ? `<div class="grid">${wl.map((p) => card(p)).join("")}</div>` : `<div class="empty">Aún no has guardado nada. Toca ♡ en cualquier producto.</div>`;
}

function campana() {
  const c = CFG.campana, el = $("#campana");
  if (!c || !halActive()) return;
  el.hidden = false;
  el.innerHTML = `<div class="wrap campana-in"><span>🎃 <strong>${esc(c.nombre)}</strong>: ${esc(c.texto)} <span class="small">Hasta el ${fday(c.hasta)}${c.hasta_confirmado ? "" : " (fecha no confirmada por la tienda)"}.</span></span><a class="btn" href="#halloween">Ver ofertas</a></div>`;
}
function header() {
  $("#updated").textContent = `Última actualización: ${fdate(DATA.meta.actualizado)}`;
  $("#example-banner").hidden = !DATA.meta.ejemplo;
  $("#aff-note").textContent = CFG.afiliados ? "Algunos enlaces son de afiliado: si compras a través de ellos podemos recibir una comisión, sin coste extra para ti. Están marcados en el código como «sponsored»." : "Esta web no usa enlaces de afiliado.";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const evs = CFG.eventos.filter((e) => e.fecha).map((e) => ({ ...e, d: new Date(e.fecha + "T00:00:00") }));
  const next = evs.filter((e) => e.d >= today && ["singles", "bf"].includes(e.id)).sort((a, b) => a.d - b.d)[0];
  const key = $("#key-day");
  const hit = evs.find((e) => e.d.getTime() === today.getTime());
  const eve = evs.find((e) => e.d.getTime() - today.getTime() === 864e5);
  if (hit) { key.hidden = false; key.textContent = `Hoy es ${hit.nombre}. Revisa las ofertas, pero confirma cada precio en la tienda.`; }
  else if (eve) { key.hidden = false; key.textContent = `Mañana es ${eve.nombre}: hoy es víspera de campaña.`; }
  if (!next) { $("#cd-name").textContent = "Sin campañas próximas"; $("#cd-time").textContent = ""; return; }
  $("#cd-name").textContent = `${next.nombre} · ${fday(next.fecha)}`;
  const tick = () => {
    const ms = next.d - new Date(); if (ms <= 0) return ($("#cd-time").textContent = "¡Hoy!");
    const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60;
    $("#cd-time").textContent = `${d} d ${h} h ${m} min`;
  };
  tick(); setInterval(tick, 30000);
}

function calendar() {
  $("#cal-out").innerHTML = CFG.eventos.map((e) => `<li><span><strong>${esc(e.nombre)}</strong><br><span class="meta">${esc(e.detalle)}</span></span>
    <span>${e.fecha ? esc(fday(e.fecha)) : ""} <span class="tag ${e.estado === "confirmado" ? "good" : ""}">${esc(e.estado)}</span></span></li>`).join("");
}

function filters() {
  const fill = (id, vals, lab, key) => {
    const el = $(id);
    vals.forEach((v) => {
      const n = DATA.productos.filter((p) => p[key] === v).length;
      el.insertAdjacentHTML("beforeend", `<option value="${esc(v)}">${esc(lab ? lab(v) : v)} (${n})</option>`);
    });
  };
  const u = (k) => [...new Set(DATA.productos.map((p) => p[k]))].sort((a, b) => a.localeCompare(b, "es"));
  fill("#f-cat", u("categoria"), (v) => CFG.categorias[v] || v, "categoria");
  fill("#f-store", u("tienda"), null, "tienda"); fill("#f-brand", u("marca"), null, "marca");
  const bind = (id, key, cast = (x) => x) => $(id).addEventListener("change", (e) => { F[key] = cast(e.target.type === "checkbox" ? e.target.checked : e.target.value); render(); });
  bind("#f-cat", "cat"); bind("#f-store", "store"); bind("#f-brand", "brand"); bind("#f-pct", "pct", Number); bind("#f-watch", "watch");
  document.querySelectorAll(".segbtn").forEach((b) => b.addEventListener("click", () => { F.g = b.dataset.g; document.querySelectorAll(".segbtn").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); render(); }));
  const chips = $("#chips");
  chips.innerHTML = u("marca").map((b) => `<button type="button" class="chip" data-b="${esc(b)}" aria-pressed="false">${esc(b)}</button>`).join("");
  const sync = () => { chips.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(norm(c.dataset.b) === norm(F.q)))); const n = DATA.productos.filter(passes).length; $("#q-count").textContent = F.q ? `${n} resultado${n === 1 ? "" : "s"} para «${F.q}»` : ""; };
  render.after = sync;
  $("#q").addEventListener("input", (e) => { F.q = e.target.value; render(); });
  chips.addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (!c) return; F.q = norm(F.q) === norm(c.dataset.b) ? "" : c.dataset.b; $("#q").value = F.q; render(); });
  $("#f-reset").addEventListener("click", () => { Object.assign(F, { q: "", cat: "", store: "", brand: "", pct: 0, watch: false }); $("#q").value = ""; document.querySelectorAll(".filters select").forEach((s) => (s.selectedIndex = 0)); $("#f-watch").checked = false; render(); });
}

// ---------- informe ----------
function report() {
  const L = [`INFORME DEL DÍA · ${fdate(DATA.meta.actualizado)}`, DATA.meta.ejemplo ? "*** DATOS DE EJEMPLO ***" : "", ""];
  const sec = (t, items) => { if (!items.length) return; L.push(t.toUpperCase()); items.forEach((p) => { const d = pct(p); L.push(`- ${p.producto} (${p.marca}, ${p.formato}) · ${p.tienda}: ${eur(p.precio_actual)}${p.precio_anterior ? ` (antes ${eur(p.precio_anterior)}${d.v ? `, −${d.v}%${d.calc ? " cálculo propio" : ""}` : ""})` : ""} · ${hasLink(p) ? p.enlace : "no verificado"}`); }); L.push(""); };
  sec("Flash", DATA.productos.filter((p) => p.tipo === "flash" && pct(p).v >= DATA.meta.umbral_flash));
  sec("Comparador", DATA.productos.filter((p) => p.tipo === "comparador"));
  sec("Halloween en Primor", byType("halloween").slice(0, 8)); sec("Perfumes", byType("perfume").slice(0, 8)); sec("K-beauty", byType("kbeauty").slice(0, 5)); sec("Moda", byType("moda").slice(0, 6)); sec("Virales", byType("viral").slice(0, 5));
  L.push("Los precios pueden cambiar: confirma siempre en la tienda.");
  return L.join("\n");
}
function toast(m) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2500); }

// ---------- arranque ----------
document.addEventListener("click", (e) => {
  const b = e.target.closest(".fav"); if (!b) return;
  watch.has(b.dataset.id) ? watch.delete(b.dataset.id) : watch.add(b.dataset.id);
  store.set("watch", [...watch]); render();
});
$("#theme").addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme:dark)").matches);
  document.documentElement.dataset.theme = dark ? "light" : "dark"; store.set("theme", document.documentElement.dataset.theme);
});
if (["localhost", "127.0.0.1"].includes(location.hostname)) $("#admin-link").hidden = false;
const saved = store.get("theme", null); if (saved) document.documentElement.dataset.theme = saved;
$("#share").addEventListener("click", async () => {
  const text = report();
  try { if (navigator.share) { await navigator.share({ title: "Informe del día", text }); return; } await navigator.clipboard.writeText(text); toast("Informe copiado"); }
  catch { toast("No se pudo compartir; usa Descargar"); }
});
$("#dl-report").addEventListener("click", () => {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([report()], { type: "text/plain" }));
  a.download = `informe-${DATA.meta.actualizado.slice(0, 10)}.txt`; a.click(); URL.revokeObjectURL(a.href);
});

Promise.all([fetch("data/productos.json", { cache: "no-cache" }).then((r) => r.json()), fetch("data/config.json", { cache: "no-cache" }).then((r) => r.json())])
  .then(([d, c]) => { DATA = d; CFG = c; campana(); header(); filters(); calendar(); render(); })
  .catch(() => { $("#updated").textContent = "No se pudieron cargar los datos. Abre la web desde un servidor (ver README), no con doble clic."; });
