"use strict";

function agendaDelCielo(sky) {
  const agenda = [];
  let eclipseAnterior;
  for (const [fecha, row] of [...sky].sort(([a],[b]) => a.localeCompare(b))) {
    for (const [tipo, campo] of [["fase",phase],["eclipse",eventFields[3]],["meteoros",eventFields[2]]]) {
      const texto = row[campo];
      if (!texto) continue;
      const parte = {fecha, texto, estado:row.Estado};
      if (tipo === "eclipse" && /^continúa\b/i.test(texto) && eclipseAnterior &&
          fecha === offset(eclipseAnterior.fin,1)) {
        eclipseAnterior.partes.push(parte);
        eclipseAnterior.fin = fecha;
        continue;
      }
      const nombre = tipo === "eclipse" ? upperFirst(texto.match(/eclipse (?:solar|lunar)(?: (?:penumbral|parcial|total|anular))?/i)?.[0] ?? "Eclipse") : texto.split(tipo === "fase" ? " (" : " ·")[0];
      const evento = {tipo, nombre, fecha, fin:fecha, partes:[parte]};
      agenda.push(evento);
      if (tipo === "eclipse") eclipseAnterior=evento;
    }
  }
  return agenda;
}

// La hoja especifica UTC−6 para las horas locales de toda la edición.
function horaUTC(fecha, hora) {
  return new Date(fecha+"T"+hora+":00-06:00").toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z/,"Z");
}
function escaparICS(texto) {
  return String(texto).replace(/\\/g,"\\\\").replace(/\r\n|\n|\r/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;");
}
function plegarICS(linea) {
  const partes=[];
  let texto="", bytes=0;
  const encoder=new TextEncoder();
  for (const letra of linea) {
    const longitud=encoder.encode(letra).length;
    if (bytes+longitud>75) { partes.push(texto); texto=" "; bytes=1; }
    texto+=letra; bytes+=longitud;
  }
  partes.push(texto);
  return partes.join("\r\n");
}
function calendarioICS(agenda, ahora=new Date()) {
  const lineas=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Almanaque Ribera//Edicion 2027//ES","CALSCALE:GREGORIAN"];
  const sello=ahora.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z/,"Z");
  for (const ev of agenda) {
    if (ev.tipo==="fase" && !/^luna llena\b/i.test(ev.nombre)) continue;
    const primera=ev.partes[0].texto, ultima=ev.partes.at(-1).texto;
    const exacta=ev.tipo==="fase" ? primera.match(/\((\d{2}:\d{2}) MX\)/i)?.[1] :
      ev.tipo==="eclipse" ? primera.match(/\binicio a las (\d{2}:\d{2})/i)?.[1] : null;
    const fin=ev.tipo==="eclipse" ? ultima.match(/\bfin a las (\d{2}:\d{2})/i)?.[1] : null;
    const detalle=ev.partes.map(p=>p.fecha+" · "+p.texto+"\nEstado: "+(p.estado??"Sin registro")).join("\n\n");
    lineas.push("BEGIN:VEVENT","UID:"+ev.tipo+"-"+ev.fecha+"@almanaque-ribera-2027","DTSTAMP:"+sello);
    if (exacta) {
      lineas.push("DTSTART:"+horaUTC(ev.fecha,exacta));
      if (fin) lineas.push("DTEND:"+horaUTC(ev.fin,fin));
    } else {
      lineas.push("DTSTART;VALUE=DATE:"+ev.fecha.replaceAll("-",""),"DTEND;VALUE=DATE:"+offset(ev.fin,1).replaceAll("-",""));
    }
    lineas.push("SUMMARY:"+escaparICS(ev.nombre),"DESCRIPTION:"+escaparICS(detalle),"TRANSP:TRANSPARENT","END:VEVENT");
  }
  lineas.push("END:VCALENDAR");
  return lineas.map(plegarICS).join("\r\n")+"\r\n";
}

function iniciarCielo(sky) {
  const vista=$("vista-cielo"), agenda=agendaDelCielo(sky);
  vista.append(cabeceraVista("Cielo","Zapopan y Ajijic · Hora de Jalisco","cieloTitle"));
  const panel=node("div",null,"filtros explorador");
  const tipo=selector("Fenómeno",[["fase","Fases lunares"],["eclipse","Eclipses"],["meteoros","Lluvias de estrellas"]],"Todos");
  const periodo=selector("Periodo",[["proximos","Desde hoy"],["edicion","Todo 2027"]]);
  const exportar=node("button","Exportar eventos (.ics)","accion primaria");
  const detalle=node("p","Descarga las lunas llenas, los eclipses y las lluvias de estrellas de todo 2027 para importar en tu calendario.","ayuda-cielo");
  exportar.onclick=()=>{
    const blob=new Blob([calendarioICS(agenda)],{type:"text/calendar;charset=utf-8"});
    const enlace=node("a"); enlace.href=URL.createObjectURL(blob); enlace.download="Almanaque-Ribera-Cielo-2027.ics";
    document.body.append(enlace); enlace.click(); enlace.remove();
    setTimeout(()=>URL.revokeObjectURL(enlace.href),60000);
  };
  panel.append(tipo.wrapper,periodo.wrapper,exportar,detalle);
  const total=node("p",null,"resultado");total.setAttribute("role","status");
  const lista=node("ol",null,"agenda-cielo");
  const mas=node("button","Ver más eventos","accion");
  vista.append(panel,total,lista,mas);
  let limite=10;
  function mostrar() {
    const hoy=realToday();
    const visibles=agenda.filter(e=>(periodo.control.value==="edicion" || e.fin>=hoy) && (!tipo.control.value || e.tipo===tipo.control.value));
    total.textContent=visibles.length ? visibles.length+(visibles.length===1?" evento":" eventos") : "Sin eventos en este periodo.";
    lista.replaceChildren();
    for (const ev of visibles.slice(0,limite)) {
      const dias=Math.round((asDate(ev.fecha)-asDate(hoy))/86400000);
      const cuando=dias>0 ? (dias===1?"Mañana":"En "+dias+" días") : ev.fin>=hoy ? "Hoy" : "Pasado";
      const li=node("li",null,"evento-cielo");
      const fecha=node("div",null,"fecha-evento");
      fecha.append(node("strong",shortDay.format(asDate(ev.fecha))),node("small",cuando));
      const cuerpo=node("div"); cuerpo.append(node("h2",ev.nombre));
      for (const parte of ev.partes) {
        const texto=(ev.partes.length>1 ? shortDay.format(asDate(parte.fecha))+" · " : "")+parte.texto;
        cuerpo.append(node("p",texto),badge(parte.estado));
      }
      li.append(fecha,cuerpo);lista.append(li);
    }
    mas.hidden=visibles.length<=limite;
  }
  for (const f of [tipo,periodo]) f.control.onchange=()=>{limite=10;mostrar();};
  mas.onclick=()=>{limite+=10;mostrar();};
  let dia=realToday();
  const revisarDia=()=>{const actual=realToday();if(actual!==dia){dia=actual;mostrar();}};
  document.addEventListener("visibilitychange",revisarDia);
  setInterval(revisarDia,60000);
  return mostrar;
}

function iniciarClima(rows) {
  const vista=$("vista-clima");
  vista.append(cabeceraVista("Clima","Normales climatológicas del SMN","climaTitle"));
  const estaciones=[...new Set(rows.map(r=>r["Estación SMN"]).filter(Boolean))];
  const estacion=selector("Estación",estaciones.map(v=>[v,v]));
  const panel=node("div",null,"panel-clima");
  const info=node("p",null,"periodo-clima");
  const bar=node("div",null,"cab-clima");bar.append(estacion.wrapper,info);
  const figura=node("figure",null,"grafica-lluvia"), titulo=node("figcaption","Precipitación media mensual (mm)");
  const grafica=node("div",null,"barras-lluvia");figura.append(titulo,grafica);
  const contenedor=node("div",null,"scroll-tabla");
  contenedor.tabIndex=0;contenedor.setAttribute("role","region");contenedor.setAttribute("aria-label","Tabla mensual por estación");
  const tabla=node("table",null,"tabla-clima");
  const caption=tabla.createCaption();const tr=tabla.createTHead().insertRow();
  for(const label of ["Mes","Máxima media (°C)","Mínima media (°C)","Lluvia media (mm)","Días con lluvia","Estado"]){
    const th=node("th",label);th.scope="col";tr.append(th);
  }
  const body=tabla.createTBody();contenedor.append(tabla);
  panel.append(bar,figura,contenedor);vista.append(panel);
  const lluvia="Precipitación media (mm)";
  const techo=Math.max(1,...rows.map(r=>typeof r[lluvia]==="number"?r[lluvia]:0));
  const formato=new Intl.NumberFormat("es-MX",{maximumFractionDigits:8});
  const valor=v=>v==null?"Sin dato":typeof v==="number"?formato.format(v):String(v);
  function mostrar() {
    const datos=rows.filter(r=>r["Estación SMN"]===estacion.control.value);
    const periodos=[...new Set(datos.map(r=>r["Periodo de la normal"]).filter(Boolean))];
    info.textContent="Periodo histórico "+periodos.join(", ");
    caption.textContent="Normales mensuales · "+estacion.control.value;
    grafica.replaceChildren();body.replaceChildren();
    for(const r of datos){
      const linea=node("div",null,"renglon-lluvia"), fondo=node("span",null,"pista"), barra=node("span");
      barra.style.width=typeof r[lluvia]==="number"?(100*r[lluvia]/techo)+"%":"0";
      fondo.setAttribute("aria-hidden","true");fondo.append(barra);
      linea.append(node("span",r.Mes),fondo,node("span",valor(r[lluvia])));grafica.append(linea);
      const fila=body.insertRow(), mes=node("th",r.Mes);mes.scope="row";fila.append(mes);
      for(const k of ["Máxima media (°C)","Mínima media (°C)",lluvia,"Días con lluvia (promedio)"])fila.insertCell().textContent=valor(r[k]);
      fila.insertCell().append(badge(r.Estado));
    }
  }
  estacion.control.onchange=mostrar;
  mostrar();
}
