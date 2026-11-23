"use strict";

const $ = id => document.getElementById(id);
const tz = "America/Mexico_City";
const shortDay = new Intl.DateTimeFormat("es-MX", {day:"numeric", month:"short", timeZone:"UTC"});
const dayMonth = new Intl.DateTimeFormat("es-MX", {day:"numeric", month:"long", timeZone:"UTC"});
const monthName = new Intl.DateTimeFormat("es-MX", {month:"long", timeZone:"UTC"});
const pct = new Intl.NumberFormat("es-MX", {style:"percent", maximumFractionDigits:8});
const phase = "Fase lunar principal y hora";
const eventFields = [phase, "Equinoccio o solsticio", "Lluvia de estrellas · pico previsto", "Eclipse visible en México · detalle para Jalisco"];
const civicState = "Estado de datos documentados";
let sky, civil, garden, first, last, selected, city = "Zapopan";
let followingToday = true;

function node(tag, content, className) {
  const el = document.createElement(tag);
  if (content != null) el.textContent = content;
  if (className) el.className = className;
  return el;
}

function realToday() {
  const parts = new Intl.DateTimeFormat("es-MX", {timeZone:tz, year:"numeric", month:"2-digit", day:"2-digit"}).formatToParts(new Date());
  const part = type => parts.find(p => p.type === type).value;
  return [part("year"),part("month"),part("day")].join("-");
}

const asDate = key => new Date(key + "T12:00:00Z");
const upperFirst = word => word.charAt(0).toLocaleUpperCase("es-MX") + word.slice(1);
function offset(key, days) {
  const d = asDate(key);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0,10);
}
function badge(status) {
  if (!status) return node("span", "Sin estado en la base", "badge pending");
  return node("span", status, status === "VERIFICADO" ? "badge" : "badge pending");
}
function facts(target, pairs) {
  $(target).replaceChildren(...pairs.map(([label, value]) => {
    const div = node("div");
    div.append(node("dt", label), node("dd", value ?? "Sin dato en la base"));
    return div;
  }));
}
function updateSun() {
  const record = sky.get(selected);
  for (const [id, key] of [["sunrise","Salida"],["sunset","Puesta"]]) {
    const t = record?.[key + " del sol · " + city];
    $(id).textContent = t == null ? "—" : String(t).replace(/^(\d\d:\d\d):00$/, "$1");
  }
  document.querySelectorAll("[data-city]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.city === city)));
}
function showEvents() {
  const end = offset(selected, 6) > last ? last : offset(selected, 6);
  $("period").textContent = shortDay.format(asDate(selected)) + " – " + shortDay.format(asDate(end)) + " · 2027";
  const list = $("events");
  list.replaceChildren();
  for (let day = selected; day <= end; day = offset(day, 1)) {
    const row = sky.get(day);
    if (!row) continue;
    for (const field of eventFields) {
      if (!row[field]) continue;
      const item = node("li"), date = node("div", null, "eventDate"), body = node("div", null, "eventText");
      date.append(node("span",day.slice(-2),"eventDay"), node("span",monthName.format(asDate(day)).slice(0,3),"eventMonth"));
      body.append(node("p",row[field]),badge(row.Estado));
      item.append(date, body);
      list.append(item);
    }
  }
  if (!list.children.length) list.append(node("li","Sin eventos registrados en este periodo."));
}
function render(day) {
  const today = realToday();
  selected = day;
  $("date").value = day;
  $("prev").disabled = day === first;
  $("next").disabled = day === last;
  const d = asDate(day), row = sky.get(day), daily = civil.get(day);
  const month = monthName.format(d);
  const task = garden.find(r => r.Mes?.toLocaleLowerCase("es-MX") === month);
  $("context").textContent = day === today ? "Hoy en la Ribera" : today < first || today > last ? "Vista previa de 2027" : "Ficha de 2027";
  $("weekday").textContent = row?.["Día"] ?? upperFirst(new Intl.DateTimeFormat("es-MX", {weekday:"long", timeZone:"UTC"}).format(d));
  $("day").textContent = dayMonth.format(d);
  $("announce").textContent = [$("weekday").textContent,$("day").textContent,"de 2027"].join(" ");
  for (const id of ["sunStatus","moonStatus"]) $(id).replaceChildren(badge(row?.Estado));
  $("civicStatus").replaceChildren(badge(daily?.[civicState]));
  $("gardenStatus").replaceChildren(badge(task?.Estado));
  updateSun();
  facts("lunar", [["Iluminación", row?.["Iluminación lunar"] != null ? pct.format(row["Iluminación lunar"]) : null], ["Fase principal y hora",row ? row[phase] ?? "Sin fase principal registrada este día." : null]]);
  facts("daily", [
    ["Santoral", daily?.["Santoral católico · Calendario Romano General"]],
    ["Descanso obligatorio", daily ? daily["Descanso obligatorio MX · LFT art. 74"] ?? "Sin descanso obligatorio registrado." : null],
    ["Fecha cívica o cultural", daily ? daily["Fecha cívica o cultural"] ?? "Sin fecha registrada." : null],
    ["Temporada histórica de Chapala", daily?.["Temporada histórica · Chapala"]]
  ]);
  $("gardenMonth").textContent = "Labores de " + month;
  const tasks = task ? [task["Siembra, trasplante o cosecha"], task["Qué revisar en el predio"]].filter(Boolean) : [];
  $("gardenText").replaceChildren(...(tasks.length ? tasks : ["Sin labores registradas para este mes."]).map(t => node("p",t)));
  showEvents();
}
function sourceNotes(datasets) {
  const box = $("sourceNotes");
  for (const sheet of datasets) {
    box.append(node("h3",sheet.hoja));
    for (const row of sheet.notas) {
      const values = Object.values(row);
      // Fuentes con URL y matices que la hoja identifica como no verificados.
      if (!values.some(v => typeof v === "string" && (v.startsWith("https://") || v === "NO VERIFICADO"))) continue;
      const p = node("p");
      values.forEach((v,i) => {
        if (i) p.append(" · ");
        if (typeof v === "string" && v.startsWith("https://")) {
          const link = node("a","Consultar fuente");
          link.href = v;
          p.append(link);
        } else p.append(String(v));
      });
      box.append(p);
    }
  }
}
async function loadSheet(name) {
  if (window.RIBERA_PREVIEW) return window.RIBERA_PREVIEW[name];
  const res = await fetch("./data/" + name + ".json");
  if (!res.ok) throw new Error("Error al cargar " + name);
  return res.json();
}
function setTheme(dark) {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  $("theme").setAttribute("aria-label", dark ? "Activar modo claro" : "Activar modo oscuro");
  $("theme").querySelector("use").setAttribute("href", dark ? "#i-sun" : "#i-moon");
}
const systemTheme = matchMedia("(prefers-color-scheme: dark)");
let preference;
try { preference = localStorage.getItem("ribera-color"); } catch {}
setTheme(preference ? preference === "dark" : systemTheme.matches);
systemTheme.addEventListener("change", e => { if (!preference) setTheme(e.matches); });
$("theme").onclick = () => {
  const dark = document.documentElement.dataset.theme !== "dark";
  setTheme(dark);
  preference = dark ? "dark" : "light";
  try { localStorage.setItem("ribera-color",preference); } catch {}
};
async function start() {
  const sets = await Promise.all(["cielo","fechas-clima","siembra"].map(loadSheet));
  sky = new Map(sets[0].tablas.CieloDiario.map(r => [r.Fecha,r]));
  civil = new Map(sets[1].tablas.FechasDiarias.map(r => [r.Fecha,r]));
  garden = sets[2].tablas.HuertoMensual;
  const dates = [...sky.keys(), ...civil.keys()].filter(d => /^2027-\d\d-\d\d$/.test(d)).sort();
  if (!dates.length) throw new Error("No hay fichas de 2027");
  first = $("date").min = dates[0];
  last = $("date").max = dates.at(-1);
  const todayInEdition = () => { const t = realToday(); return t < first ? first : t > last ? last : t; };
  render(todayInEdition());
  sourceNotes(sets);
  $("cards").hidden = false;
  iniciarCuaderno({sky, civil, crops: sets[2].tablas.Cultivos, getDay: () => selected, realToday, first, last});
  const change = day => {
    if (!day || day < first || day > last) { $("date").value = selected; return; }
    followingToday = day === realToday();
    render(day);
  };
  $("date").onchange = e => change(e.target.value);
  $("prev").onclick = () => change(offset(selected,-1));
  $("next").onclick = () => change(offset(selected,1));
  document.querySelectorAll("[data-city]").forEach(b => b.onclick = () => { city = b.dataset.city; updateSun(); });
  const updateDate = () => { if (followingToday && selected !== todayInEdition()) render(todayInEdition()); };
  document.addEventListener("visibilitychange",updateDate);
  setInterval(updateDate, 60000);
}
start().catch(() => {
  $("error").textContent = "No se pudo abrir la base de 2027. Vuelve a cargar la página desde la dirección de la app.";
  $("error").hidden = false;
});
if (window.RIBERA_PREVIEW) $("offline").textContent = "Vista previa local";
else if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js")
    .then(() => navigator.serviceWorker.ready)
    .then(() => { $("offline").textContent = "Disponible sin conexión"; })
    .catch(() => { $("offline").textContent = "Sin copia offline"; });
}
