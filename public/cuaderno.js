"use strict";

const MESES = Array.from({length:12}, (_, i) =>
  new Intl.DateTimeFormat("es-MX", {month:"long", timeZone:"UTC"}).format(new Date(Date.UTC(2027,i,1))));
const METODOS = ["Meses de siembra directa", "Meses de almácigo", "Meses de trasplante"];
const normalizar = text => String(text ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const mesAbrev = MESES.map(m => normalizar(m.slice(0,3)));
const patronMes = "(ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?|jul(?:io)?|ago(?:sto)?|sep(?:tiembre)?|oct(?:ubre)?|nov(?:iembre)?|dic(?:iembre)?)";

function incluyeMes(ventana, indice) {
  const texto = normalizar(ventana);
  if (/\btodo el ano\b/.test(texto)) return true;
  const tramos = new RegExp("\\b" + patronMes + "\\b(?:\\s*(?:[-–—]|a)\\s*" + patronMes + "\\b)?","g");
  for (const match of texto.matchAll(tramos)) {
    const inicio = mesAbrev.indexOf(match[1].slice(0,3));
    const fin = match[2] ? mesAbrev.indexOf(match[2].slice(0,3)) : inicio;
    if ((indice - inicio + 12) % 12 <= (fin - inicio + 12) % 12) return true;
  }
  return false;
}

const tipoEvento = [
  ["fase", "◐", "Fase lunar", "Fase lunar principal y hora"],
  ["festivo", "⚑", "Descanso obligatorio", "Descanso obligatorio MX · LFT art. 74"],
  ["eclipse", "◉", "Eclipse", "Eclipse visible en México · detalle para Jalisco"],
  ["meteoros", "✧", "Lluvia de estrellas", "Lluvia de estrellas · pico previsto"],
  ["civica", "◇", "Fecha cívica o cultural", "Fecha cívica o cultural"],
  ["estacion", "☼", "Equinoccio o solsticio", "Equinoccio o solsticio"]
];

function marcaEvento([tipo, simbolo, nombre], valor) {
  if (tipo === "fase" && valor) {
    const fase = normalizar(valor);
    if (fase.includes("nueva")) simbolo = "●";
    if (fase.includes("llena")) simbolo = "○";
    if (fase.includes("menguante")) simbolo = "◑";
  }
  const el = node("span",simbolo,"marca " + tipo);
  el.setAttribute("aria-hidden","true");
  el.title = valor || nombre;
  return el;
}

function cabeceraVista(titulo, subtitulo, id) {
  const head = node("div",null,"portada");
  const label = node("p",subtitulo,"eyebrow");
  const nombre = node("h1",titulo);
  nombre.id = id;
  head.append(label,nombre);
  return head;
}

function selector(label, entries, prompt) {
  const wrapper = node("label",label,"campo");
  const control = node("select");
  control.setAttribute("aria-label",label);
  if (prompt) control.append(new Option(prompt,""));
  entries.forEach(([v,t]) => control.append(new Option(t,v)));
  wrapper.append(control);
  return {wrapper,control};
}

function iniciarCalendario({sky, civil, getDay, first, last}) {
  const view = $("vista-calendario");
  view.append(cabeceraVista("Calendario","Edición 2027","calendarTitle"));
  const panel = node("div",null,"panelMes");
  const bar = node("div",null,"mesBar");
  const {wrapper,control} = selector("Mes",MESES.map((m,i)=>[i,upperFirst(m)]));
  const buttons = node("div",null,"pasoMes");
  const atras = node("button","‹","arrow"), adelante = node("button","›","arrow");
  atras.setAttribute("aria-label","Mes anterior");
  adelante.setAttribute("aria-label","Mes siguiente");
  buttons.append(atras,adelante);
  bar.append(wrapper,buttons);
  const tabla = node("table",null,"mesTabla");
  const thead = tabla.createTHead().insertRow();
  ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].forEach(d => {
    const th = node("th",d); th.scope = "col"; thead.append(th);
  });
  const body = tabla.createTBody();
  const leyenda = node("ul",null,"leyenda");
  tipoEvento.forEach(tipo => {
    const li=node("li"); li.append(marcaEvento(tipo),tipo[2]); leyenda.append(li);
  });
  panel.append(bar,tabla,leyenda);
  view.append(panel);

  const dialog = node("dialog",null,"ficha");
  dialog.setAttribute("aria-labelledby","ficha-title");
  const cerrar = node("button","Cerrar","accion");
  cerrar.onclick = () => dialog.close();
  const title = node("h2"); title.id="ficha-title";
  const top = node("div",null,"fichaHead"); top.append(title,cerrar);
  const fichaBody = node("div");
  dialog.append(top,fichaBody); view.append(dialog);
  function grupo(titulo, status, pairs) {
    const section = node("section"), header = node("div",null,"fichaGrupo");
    header.append(node("h3",titulo),badge(status));
    const dl = node("dl",null,"facts");
    for (const [k,v] of pairs) {
      const box = node("div");
      box.append(node("dt",k),node("dd",v ?? "Sin registro en la base.")); dl.append(box);
    }
    section.append(header,dl);
    return section;
  }
  function abrirDia(key) {
    const cielo=sky.get(key) || {}, fecha=civil.get(key) || {};
    title.textContent = upperFirst(new Intl.DateTimeFormat("es-MX",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(asDate(key)));
    const datosCielo = Object.entries(cielo).filter(([k])=>!["Estado","Fecha","Día"].includes(k)).map(([k,v])=> {
      if (k === "Iluminación lunar" && v != null) return [k,pct.format(v)];
      return [k, typeof v === "string" ? v.replace(/^(\d\d:\d\d):00$/,"$1") : v];
    });
    const sep = "Vacaciones escolares SEP · educación básica";
    const datosFecha = Object.entries(fecha).filter(([k])=>!k.startsWith("Estado") && k !== "Fecha" && k !== sep);
    fichaBody.replaceChildren(grupo("Sol y luna · eventos del cielo",cielo.Estado,datosCielo),
      grupo("Fechas y clima",fecha["Estado de datos documentados"],datosFecha),
      grupo("Calendario escolar",fecha["Estado SEP"],[[sep,fecha[sep]]]));
    dialog.showModal();
    dialog.scrollTop = 0;
  }
  let mes = Number(getDay().slice(5,7))-1;
  function dibujar() {
    control.value = String(mes); atras.disabled = mes === 0; adelante.disabled = mes === 11;
    tabla.setAttribute("aria-label",upperFirst(MESES[mes]) + " de 2027");
    const inicio = new Date(Date.UTC(2027,mes,1));
    const blancos = (inicio.getUTCDay()+6)%7;
    const dias = new Date(Date.UTC(2027,mes+1,0)).getUTCDate();
    body.replaceChildren();
    for (let i=0; i<Math.ceil((blancos+dias)/7)*7; i++) {
      if (i%7 === 0) body.insertRow();
      const cell = body.rows[body.rows.length-1].insertCell();
      const n=i-blancos+1;
      if (n<1 || n>dias) { cell.className="vacio"; continue; }
      const key = "2027-" + String(mes+1).padStart(2,"0") + "-" + String(n).padStart(2,"0");
      const btn=node("button",null,"dia");
      const num=node("span",n,"numero"), marcas=node("span",null,"marcas");
      const descripciones = [];
      const cielo=sky.get(key), fecha=civil.get(key);
      for (const t of tipoEvento) {
        const valor=cielo?.[t[3]] ?? fecha?.[t[3]];
        if (valor) {marcas.append(marcaEvento(t,valor)); descripciones.push(t[2]);}
      }
      btn.setAttribute("aria-label",[dayMonth.format(asDate(key)), ...descripciones].join(", "));
      if (key === realToday()) btn.setAttribute("aria-current","date");
      btn.disabled = key < first || key > last || (!cielo && !fecha);
      btn.onclick = () => abrirDia(key); btn.append(num,marcas); cell.append(btn);
    }
  }
  control.onchange = () => {mes=Number(control.value);dibujar();};
  atras.onclick = () => {mes--;dibujar();};
  adelante.onclick = () => {mes++;dibujar();};
  let visto = false;
  return () => { if (!visto) mes = Number(getDay().slice(5,7))-1; visto = true; dibujar(); };
}

function iniciarSiembra({crops,realToday}) {
  const view = $("vista-siembra");
  view.append(cabeceraVista("Siembra","Huerto de Zapopan y la Ribera","plantTitle"));
  const panel = node("div",null,"filtros");
  const busqueda = node("label","Buscar cultivo","campo");
  const buscador = node("input"); buscador.type="search"; buscador.placeholder="Ej. cilantro"; busqueda.append(buscador);
  const tipos = [...new Set(crops.map(r=>r.Tipo).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es-MX"));
  const tipo=selector("Tipo",tipos.map(t=>[t,t]),"Todos los tipos");
  const mes=selector("Mes",MESES.map((m,i)=>[i,upperFirst(m)]),"Todo el año");
  const helada=selector("Sensible a heladas",[["si","Sí"],["no","No"]],"Todos");
  const atajos = node("div",null,"atajos");
  const esteMes = node("button","¿Qué siembro este mes?","accion primaria");
  const limpiar = node("button","Limpiar filtros","accion");
  atajos.append(esteMes,limpiar);
  panel.append(busqueda,tipo.wrapper,mes.wrapper,helada.wrapper,atajos);
  const total=node("p",null,"resultado"); total.setAttribute("role","status");
  const lista=node("div",null,"cultivos");
  view.append(panel,total,lista);
  function mostrar() {
    const query=normalizar(buscador.value.trim());
    const rows=crops.filter(r=>
      normalizar(r.Cultivo).includes(query) && (!tipo.control.value || r.Tipo === tipo.control.value) &&
      (!helada.control.value || normalizar(r["Sensible a heladas"]).split(/[^a-z]+/)[0] === helada.control.value) &&
      (mes.control.value === "" || METODOS.some(k=>incluyeMes(r[k],Number(mes.control.value)))));
    const mesTxt=mes.control.value === "" ? "" : " · " + upperFirst(MESES[Number(mes.control.value)]);
    total.textContent = rows.length + (rows.length === 1 ? " cultivo" : " cultivos") + mesTxt;
    lista.replaceChildren();
    if (!rows.length) lista.append(node("p","Sin coincidencias. Prueba otro nombre o limpia los filtros.","sinResultados"));
    for (const row of rows) {
      const card=node("details",null,"cultivo");
      const summary=node("summary");
      const name=node("span",null,"cultivoNombre"); name.append(node("small",row.Tipo),node("strong",row.Cultivo));
      summary.append(name,badge(row.Estado),node("span","⌄","desplegar"));
      const body=node("div",null,"cultivoDatos");
      const dl=node("dl",null,"facts");
      for (const [label,value] of Object.entries(row)) {
        if (["Cultivo","Tipo","Estado"].includes(label)) continue;
        const box=node("div");
        if (METODOS.includes(label) && mes.control.value !== "" && incluyeMes(value,Number(mes.control.value))) box.className="coincide";
        box.append(node("dt",label),node("dd",value ?? "Sin registro en la base."));dl.append(box);
      }
      body.append(dl);card.append(summary,body);lista.append(card);
    }
  }
  buscador.oninput=mostrar;
  for (const field of [mes,tipo,helada]) field.control.onchange=mostrar;
  function reset() { buscador.value=""; for (const field of [mes,tipo,helada]) field.control.value=""; }
  esteMes.onclick=()=>{reset(); mes.control.value=String(Number(realToday().slice(5,7))-1); mostrar();};
  limpiar.onclick=()=>{reset();mostrar();};
  mostrar();
}

function iniciarCuaderno(datos) {
  const calendario = iniciarCalendario(datos);
  iniciarSiembra(datos);
  const refrescarCielo = iniciarCielo(datos.sky);
  iniciarClima(datos.clima);
  const links = [...document.querySelectorAll(".sections a")];
  function navegar() {
    const vista = location.hash.slice(1);
    const activo = ["calendario","siembra","cielo","clima"].includes(vista) ? vista : "hoy";
    for (const link of links) {
      const key=link.hash.slice(1), enabled=key===activo;
      $("vista-"+key).hidden = !enabled;
      if (enabled) {link.setAttribute("aria-current","page");document.title=link.textContent+" · Lakeside Almanac — Almanaque de la Ribera de Chapala · 2027";}
      else link.removeAttribute("aria-current");
    }
    if (activo==="calendario") calendario();
    if (activo==="cielo") refrescarCielo();
    if (vista !== "main") window.scrollTo(0,0);
  }
  window.addEventListener("hashchange",navegar);
  navegar();
}
