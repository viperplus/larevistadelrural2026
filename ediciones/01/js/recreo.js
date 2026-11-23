/* ------------------------------------------------------------------
   Recreo: «La ovejita de Mencué».
   Un corredor de plataformas por la meseta patagónica: lomas que suben
   y bajan, bardas para treparse, cañadones para saltar, matas de
   neneo, calafates, piedras y chimangos (que se pueden pisar desde
   arriba). El salto es «a lo plataforma»: cuanto más se mantiene
   apretado, más alto llega. Hay frutos de calafate para juntar,
   ráfagas de viento que duplican los puntos, medallas y personajes
   para desbloquear. Todo se dibuja en un <canvas>, sin imágenes ni
   librerías, y el progreso queda guardado en el navegador.
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  var marco = document.querySelector('[data-juego="oveja"]');
  if (!marco) return;
  var lienzo = marco.querySelector(".juego__lienzo");
  var ctx = lienzo.getContext && lienzo.getContext("2d");
  if (!ctx) return;
  var capa = marco.querySelector(".juego__capa");
  var capaT = capa.querySelector(".juego__capa-t");
  var capaD = capa.querySelector(".juego__capa-d");
  var capaM = capa.querySelector(".juego__capa-medallas");
  var bJugar = capa.querySelector(".juego__jugar");
  var oPuntos = marco.querySelector('[data-o="puntos"]');
  var oFrutos = marco.querySelector('[data-o="frutos"]');
  var oRecord = marco.querySelector('[data-o="record"]');
  var bPausa = marco.querySelector('[data-o="pausa"]');
  var bSonido = marco.querySelector('[data-o="sonido"]');
  var bSalto = marco.querySelector(".juego__btn--salto");
  var bAbajo = marco.querySelector(".juego__btn--abajo");
  var seccion = marco.closest("section") || marco;
  var listaPj = seccion.querySelector(".juego__personajes");
  var listaMed = seccion.querySelector(".juego__medallas");

  /* ---- medidas lógicas: todo se dibuja en 800 x 300 y se escala ---- */
  var W = 800, H = 300, SUELO = 252, PX = 110;
  var GRAV = 2600, SALTO = 700, SOSTEN = 0.5, T_SOSTEN = 0.2;
  var COYOTE = 0.1, BUFFER = 0.13;
  var V0 = 360, VMAX = 900;

  var K = { rec: "recreo-oveja-record", med: "recreo-oveja-medallas",
            pj: "recreo-oveja-personaje", son: "recreo-oveja-sonido" };
  function leer(k, d) { try { var v = window.localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function guardar(k, v) { try { window.localStorage.setItem(k, String(v)); } catch (e) {} }

  var MEDALLAS = [
    { id: "bronce", nombre: "Bronce", pts: 300, color: "#c07a3a" },
    { id: "plata", nombre: "Plata", pts: 800, color: "#a9b4c2" },
    { id: "oro", nombre: "Oro", pts: 1500, color: "#e2b33c" },
    { id: "leyenda", nombre: "Leyenda de la estepa", pts: 3000, color: "#7b3fc4" }
  ];
  var PERSONAJES = [
    { id: "oveja", nombre: "Oveja", rasgo: "Equilibrada", req: null, salto: 1, grav: 1, alto: 40 },
    { id: "guanaco", nombre: "Guanaco", rasgo: "Salta más alto", req: "bronce", salto: 1.1, grav: 1, alto: 50 },
    { id: "choique", nombre: "Choique", rasgo: "Planea al caer", req: "plata", salto: 1.02, grav: .86, alto: 48 }
  ];

  var record = parseInt(leer(K.rec, "0"), 10) || 0;
  var medGanada = parseInt(leer(K.med, "-1"), 10);
  if (isNaN(medGanada)) medGanada = -1;
  var pjId = leer(K.pj, "oveja");
  var sonidoOn = leer(K.son, "1") !== "0";
  oRecord.textContent = record;

  function desbloqueado(c) {
    if (!c.req) return true;
    var idx = MEDALLAS.map(function (m) { return m.id; }).indexOf(c.req);
    return medGanada >= idx;
  }
  function pj() {
    var c = PERSONAJES.filter(function (x) { return x.id === pjId; })[0];
    if (!c || !desbloqueado(c)) c = PERSONAJES[0];
    return c;
  }

  /* ---- sonido: todo sintetizado con Web Audio ---- */
  var audio = null;
  function oido() {
    if (!sonidoOn) return null;
    if (!audio) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { audio = new AC(); } catch (e) { return null; }
    }
    if (audio.state === "suspended") audio.resume();
    return audio;
  }
  function tono(f1, f2, dur, tipo, vol, demora) {
    var a = oido(); if (!a) return;
    var t0 = a.currentTime + (demora || 0);
    var o = a.createOscillator(), g = a.createGain();
    o.type = tipo || "square";
    o.frequency.setValueAtTime(f1, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(vol || .08, t0);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t0); o.stop(t0 + dur + .02);
  }
  function ruido(dur, vol, desde, hasta) {
    var a = oido(); if (!a) return;
    var n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (var k = 0; k < n; k++) d[k] = Math.random() * 2 - 1;
    var src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf; f.type = "bandpass";
    f.frequency.setValueAtTime(desde, a.currentTime);
    f.frequency.exponentialRampToValueAtTime(hasta, a.currentTime + dur);
    g.gain.setValueAtTime(.0001, a.currentTime);
    g.gain.exponentialRampToValueAtTime(vol, a.currentTime + dur * .3);
    g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(a.destination);
    src.start(); src.stop(a.currentTime + dur);
  }
  var sfx = {
    salto: function () { tono(330, 700, .14, "square", .05); },
    fruto: function () { tono(988, 0, .07, "sine", .09); tono(1480, 0, .12, "sine", .08, .06); },
    piso: function () { tono(200, 520, .12, "triangle", .12); },
    choque: function () { ruido(.35, .25, 1200, 200); tono(320, 70, .45, "sawtooth", .07); },
    hito: function () { [523, 659, 784, 1047].forEach(function (f, k) { tono(f, 0, .1, "square", .045, k * .08); }); },
    rafaga: function () { ruido(1.3, .12, 300, 1800); },
    medalla: function () { [784, 988, 1175, 1568].forEach(function (f, k) { tono(f, 0, .16, "triangle", .08, k * .11); }); },
    caer: function () { tono(600, 90, .6, "triangle", .08); }
  };

  /* ---- azar con semilla, para que el paisaje lejano sea siempre igual ---- */
  function azar(semilla) {
    var s = semilla;
    return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function mezcla(c1, c2, u) {
    var a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
    var r = Math.round(lerp(a >> 16, b >> 16, u));
    var g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, u));
    var bl = Math.round(lerp(a & 255, b & 255, u));
    return "rgb(" + r + "," + g + "," + bl + ")";
  }

  /* ---- fondo: Andes y mesetas en bucle ---- */
  function perfil(semilla, ancho, paso, base, alto, plano) {
    var r = azar(semilla), pts = [], x = 0;
    while (x <= ancho) {
      var y = base - r() * alto;
      if (plano && r() < 0.55) { var largo = paso * (1.5 + r() * 2.5); pts.push([x, y]); x += largo; pts.push([x, y]); }
      else pts.push([x, y]);
      x += paso * (0.6 + r() * 0.8);
    }
    pts[pts.length - 1][1] = pts[0][1];
    pts[pts.length - 1][0] = ancho;
    return pts;
  }
  var ANDES = perfil(7, 1600, 70, 150, 95, false);
  var MESETA = perfil(23, 1200, 90, 205, 45, true);
  var NIEVE = 112;
  function pintarPerfil(pts, desplaz, ancho, color, base) {
    var off = -(desplaz % ancho);
    ctx.fillStyle = color;
    for (var rep = 0; rep < 2; rep++) {
      var dx = off + rep * ancho;
      if (dx > W || dx + ancho < 0) continue;
      ctx.beginPath(); ctx.moveTo(dx, base);
      for (var k = 0; k < pts.length; k++) ctx.lineTo(dx + pts[k][0], pts[k][1]);
      ctx.lineTo(dx + ancho, base); ctx.closePath(); ctx.fill();
    }
  }
  function pintarNieve(pts, desplaz, ancho, color) {
    var off = -(desplaz % ancho);
    ctx.fillStyle = color;
    for (var rep = 0; rep < 2; rep++) {
      var dx = off + rep * ancho;
      if (dx > W || dx + ancho < 0) continue;
      for (var k = 1; k < pts.length - 1; k++) {
        var q = pts[k]; if (q[1] > NIEVE) continue;
        var iz = pts[k - 1], de = pts[k + 1], prof = NIEVE - q[1];
        var t1 = Math.min(1, prof / Math.max(1, iz[1] - q[1]) * .55);
        var t2 = Math.min(1, prof / Math.max(1, de[1] - q[1]) * .55);
        ctx.beginPath();
        ctx.moveTo(dx + q[0], q[1]);
        ctx.lineTo(dx + lerp(q[0], iz[0], t1), lerp(q[1], iz[1], t1));
        ctx.lineTo(dx + lerp(q[0], iz[0], t1 * .55) + 6, lerp(q[1], iz[1], t1 * .55) + 6);
        ctx.lineTo(dx + q[0], q[1] + prof * .45);
        ctx.lineTo(dx + lerp(q[0], de[0], t2 * .5) - 5, lerp(q[1], de[1], t2 * .5) + 7);
        ctx.lineTo(dx + lerp(q[0], de[0], t2), lerp(q[1], de[1], t2));
        ctx.closePath(); ctx.fill();
      }
    }
  }
  var MATAS = (function () {
    var r = azar(99), out = [];
    for (var x = 0; x < 1600; x += 30 + r() * 90) out.push({ x: x, dy: 6 + r() * 34, s: .5 + r() * .8, piedra: r() < .3 });
    return out;
  })();
  var ESTRELLAS = (function () {
    var r = azar(5), out = [];
    for (var k = 0; k < 70; k++) out.push([r() * W, r() * 150, r() * 1.4 + .3, r() * 6]);
    return out;
  })();
  var CRUZ = [[640, 40], [646, 74], [626, 58], [660, 56], [652, 66]];

  /* ================= MUNDO =================
     Todo lo jugable vive en coordenadas de mundo (x crece hacia la
     derecha); la cámara avanza con la distancia recorrida. El terreno
     es una lista de tramos: llano, loma (una joroba suave) o cañadón
     (un pozo: si caés, se terminó). */
  var estado = "inicio"; // inicio | jugando | pausa | fin
  var t = 0, cam = 0, vel = V0, metrosHito = 0, flash = 0;
  var puntos = 0, frutos = 0, pisados = 0;
  var tramos, plataformas, obst, bayas, nubes, guanacos, viento, polvo, textos;
  var genX, rafaga, proxRafaga, medRun;
  var p; // jugador
  var tecla = { salto: false, abajo: false };

  function reiniciar() {
    cam = 0; vel = V0; metrosHito = 0; flash = 0;
    puntos = 0; frutos = 0; pisados = 0; medRun = medGanada;
    tramos = [{ x0: -400, x1: 900, tipo: "llano" }];
    genX = 900;
    plataformas = []; obst = []; bayas = []; viento = []; polvo = []; textos = []; guanacos = [];
    nubes = [];
    for (var k = 0; k < 4; k++) nubes.push(nuevaNube(Math.random() * W));
    rafaga = { fase: "nada", t: 0 };
    proxRafaga = 22 + Math.random() * 10;
    var c = pj();
    p = { y: SUELO, vy: 0, suelo: true, sobre: null, aire: 0, sosten: 0, buffer: 0,
          agachada: false, paso: 0, muerta: false, alto: c.alto, c: c };
  }
  function nuevaNube(x) {
    return { x: x, y: 30 + Math.random() * 70, w: 90 + Math.random() * 110, h: 14 + Math.random() * 10, v: .12 + Math.random() * .1 };
  }

  /* altura del suelo en una x del mundo (null = cañadón) */
  function sueloEn(wx) {
    for (var k = 0; k < tramos.length; k++) {
      var s = tramos[k];
      if (wx < s.x0 || wx >= s.x1) continue;
      if (s.tipo === "pozo") return null;
      if (s.tipo === "loma") {
        var u = (wx - s.x0) / (s.x1 - s.x0);
        return SUELO - s.alto * Math.pow(Math.sin(Math.PI * u), 1.6);
      }
      return SUELO;
    }
    return SUELO;
  }

  /* El generador arma el camino por delante, de a un tramo, con lo que
     corresponde a cada uno: obstáculos en el llano, frutos sobre las
     lomas, bardas para treparse y cañadones para saltar. Las distancias
     se estiran con la velocidad para que siempre se pueda pasar. */
  function generar() {
    while (genX < cam + W + 700) {
      var m = cam / 40, esc = vel / V0, r = Math.random();
      var x = genX;
      if (m < 25) llano(x, 260 * esc, r < .5 ? "mata" : null);
      else if (r < .3) loma(x);
      else if (r < .46 && m > 60) pozo(x);
      else if (r < .64 && m > 40) barda(x);
      else llano(x, (240 + Math.random() * 160) * esc, Math.random() < (m > 180 ? .3 : 0) ? "chimango" : "mata");
    }
  }
  function llano(x, largo, ob) {
    tramos.push({ x0: x, x1: x + largo, tipo: "llano" });
    if (ob === "mata") ponerMata(x + largo * .55);
    else if (ob === "chimango") ponerChimango(x + largo * .6);
    if (Math.random() < .35) filaBayas(x + largo * .2, SUELO - 22, 3, 26);
    genX = x + largo;
  }
  function loma(x) {
    var esc = vel / V0;
    var largo = (300 + Math.random() * 260) * Math.min(1.5, esc);
    var alto = 38 + Math.random() * 52;
    tramos.push({ x0: x, x1: x + largo, tipo: "loma", alto: alto });
    for (var k = 1; k < 6; k++) {
      var u = k / 6;
      bayas.push({ x: x + largo * u, y: SUELO - alto * Math.pow(Math.sin(Math.PI * u), 1.6) - 34, tomada: false, f: Math.random() * 6 });
    }
    genX = x + largo;
    tramos.push({ x0: genX, x1: genX + 60, tipo: "llano" });
    genX += 60;
    if (Math.random() < .35 && cam / 40 > 50) { tramos.push({ x0: genX, x1: genX + 120 * esc, tipo: "llano" }); ponerMata(genX + 40); genX += 120 * esc; }
  }
  function pozo(x) {
    var esc = vel / V0;
    tramos.push({ x0: x, x1: x + 90 * esc, tipo: "llano" });
    var a = x + 90 * esc;
    var ancho = 70 + vel * .14 + Math.random() * 30;
    tramos.push({ x0: a, x1: a + ancho, tipo: "pozo" });
    for (var k = 0; k < 5; k++) {
      var u = k / 4;
      bayas.push({ x: a - 20 + (ancho + 40) * u, y: SUELO - 40 - 70 * Math.sin(Math.PI * u), tomada: false, f: k });
    }
    genX = a + ancho;
    tramos.push({ x0: genX, x1: genX + 140 * esc, tipo: "llano" });
    genX += 140 * esc;
  }
  function barda(x) {
    var esc = vel / V0;
    var largo = (420 + Math.random() * 160) * esc;
    tramos.push({ x0: x, x1: x + largo, tipo: "llano" });
    var pw = 150 + Math.random() * 90, px = x + largo * .3;
    var py = SUELO - (78 + Math.random() * 30);
    plataformas.push({ x: px, w: pw, y: py });
    filaBayas(px + 20, py - 22, Math.floor(pw / 34), 30);
    ponerMata(px + pw * .5);
    if (Math.random() < .4 && cam / 40 > 120) {
      var p2w = 110 + Math.random() * 60, p2x = px + pw + 60 * esc;
      var p2y = Math.max(96, py - (40 + Math.random() * 30));
      plataformas.push({ x: p2x, w: p2w, y: p2y });
      filaBayas(p2x + 14, p2y - 22, Math.floor(p2w / 34), 30);
      if (p2x + p2w + 40 > x + largo) { tramos.push({ x0: x + largo, x1: p2x + p2w + 60, tipo: "llano" }); genX = p2x + p2w + 60; return; }
    }
    genX = x + largo;
  }
  function filaBayas(x, y, n, paso) {
    for (var k = 0; k < n; k++) bayas.push({ x: x + k * paso, y: y, tomada: false, f: k });
  }
  function ponerMata(wx, chica) {
    var r = Math.random(), o;
    if (r < .42) {
      var n = !chica && cam / 40 > 100 && Math.random() < .45 ? 2 : 1;
      o = { tipo: "neneo", n: n, w: 30 * n + 8, h: 30 + Math.random() * 8 };
    } else if (r < .74) o = { tipo: "calafate", w: 28, h: 44 + Math.random() * 10 };
    else o = { tipo: "piedra", w: 42 + Math.random() * 14, h: 24 + Math.random() * 6 };
    o.x = wx;
    var g = sueloEn(wx + o.w / 2);
    o.y = g == null ? SUELO : g;
    obst.push(o);
  }
  function ponerChimango(wx) {
    // bajo: hay que saltarlo · medio: agacharse o pisarlo · alto: pasa por arriba
    var alturas = [SUELO - 10, SUELO - 34, SUELO - 96];
    obst.push({ tipo: "chimango", x: wx, w: 46, h: 26, y: alturas[Math.floor(Math.random() * 3)],
                aleteo: Math.random() * 6, vivo: true, cae: 0 });
  }

  /* ---- cajas de choque (en coordenadas de mundo) ---- */
  function cajaJug() {
    var wx = cam + PX;
    if (p.agachada) return { x: wx - 30, y: p.y - 26, w: 60, h: 24 };
    return { x: wx - 24, y: p.y - p.alto, w: 48, h: p.alto - 2 };
  }
  function cajaObst(o) {
    if (o.tipo === "chimango") return { x: o.x + 6, y: o.y - o.h + 6, w: o.w - 12, h: o.h - 10 };
    return { x: o.x + 5, y: o.y - o.h + 5, w: o.w - 10, h: o.h - 5 };
  }
  function choca(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

  /* ---- controles ---- */
  var finEn = 0;
  function apretarSalto() {
    tecla.salto = true;
    if (estado === "pausa") { reanudar(); return; }
    if (estado !== "jugando") {
      // tras chocar hay una pausa: si no, el salto que venía apretado
      // reiniciaba la carrera antes de ver el resultado
      if (estado === "fin" && Date.now() - finEn < 700) return;
      empezar(); return;
    }
    p.buffer = BUFFER;
  }
  function soltarSalto() { tecla.salto = false; }
  function agachar(si) { tecla.abajo = si; }

  function empezar() {
    reiniciar();
    estado = "jugando";
    capa.hidden = true;
    marco.classList.add("es-jugando");
    oido();
    try { lienzo.focus({ preventScroll: true }); } catch (e) {}
  }
  function pausar() {
    if (estado !== "jugando") return;
    estado = "pausa";
    tecla.salto = false; tecla.abajo = false;
    capaT.textContent = "Pausa";
    capaD.textContent = "La estepa te espera. Seguí cuando quieras.";
    capaM.textContent = "";
    bJugar.textContent = "Seguir";
    capa.hidden = false;
  }
  function reanudar() {
    if (estado !== "pausa") return;
    estado = "jugando";
    capa.hidden = true;
    previo = 0;
  }
  function terminar(porCaida) {
    if (estado !== "jugando") return;
    estado = "fin";
    finEn = Date.now();
    p.muerta = true;
    if (porCaida) sfx.caer(); else sfx.choque();
    marco.classList.remove("es-jugando");
    var pts = Math.floor(puntos), m = Math.floor(cam / 40);
    oPuntos.textContent = pts;
    var nuevo = pts > record;
    if (nuevo) { record = pts; oRecord.textContent = record; guardar(K.rec, record); }
    var nuevas = MEDALLAS.filter(function (md, k) { return k > medGanada && k <= medRun; });
    if (medRun > medGanada) { medGanada = medRun; guardar(K.med, medGanada); pintarPaneles(); }
    capaT.textContent = (nuevo ? "¡Récord nuevo! " : "¡Fin del recreo! ") + pts + " puntos";
    capaD.textContent = (porCaida ? "Te caíste a un cañadón. " : "") +
      m + " metros · " + frutos + " calafates" + (pisados ? " · " + pisados + " chimangos pisados" : "") + ".";
    capaM.textContent = nuevas.length ? "Ganaste: " + nuevas.map(function (x) { return "medalla " + x.nombre.toLowerCase(); }).join(", ") +
      (nuevas.some(function (x) { return x.id === "bronce" || x.id === "plata"; }) ? ". ¡Desbloqueaste un personaje!" : ".") : "";
    bJugar.textContent = "Jugar otra vez";
    setTimeout(function () {
      if (estado !== "fin") return;
      capa.hidden = false;
      try { bJugar.focus({ preventScroll: true }); } catch (e) {}
    }, 600);
  }

  var aLaVista = true;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      aLaVista = es[0].isIntersecting;
      if (!aLaVista) pausar();
    }, { threshold: 0.4 }).observe(marco);
  }
  function esSalto(k) { return k === " " || k === "Spacebar" || k === "ArrowUp" || k === "w" || k === "W"; }
  function esAbajo(k) { return k === "ArrowDown" || k === "s" || k === "S"; }
  document.addEventListener("keydown", function (e) {
    if (!aLaVista || !marco.offsetParent) return;
    var tg = e.target;
    if (tg && /^(INPUT|SELECT|TEXTAREA)$/.test(tg.tagName)) return;
    if (tg && tg.tagName === "BUTTON" && !marco.contains(tg)) return;
    if (document.querySelector("dialog[open]")) return;
    var k = e.key;
    if (esSalto(k)) {
      e.preventDefault();
      if (e.repeat) return;
      if (tg && tg.tagName === "BUTTON" && estado !== "jugando") return; // el botón hace su clic
      apretarSalto();
    } else if (esAbajo(k)) {
      if (estado === "jugando") { e.preventDefault(); agachar(true); }
    } else if (k === "p" || k === "P" || (k === "Escape" && estado === "jugando")) {
      e.preventDefault();
      if (estado === "jugando") pausar(); else if (estado === "pausa") reanudar();
    } else if (k === "m" || k === "M") {
      alternarSonido();
    } else if (k === "Enter" && (estado === "fin" || estado === "inicio") && tg !== bJugar) {
      e.preventDefault(); apretarSalto(); soltarSalto();
    }
  });
  document.addEventListener("keyup", function (e) {
    if (esSalto(e.key)) soltarSalto();
    else if (esAbajo(e.key)) agachar(false);
  });
  bJugar.addEventListener("click", function () {
    if (estado === "pausa") reanudar(); else empezar();
  });
  lienzo.addEventListener("pointerdown", function (e) { e.preventDefault(); apretarSalto(); });
  lienzo.addEventListener("pointerup", soltarSalto);
  lienzo.addEventListener("pointercancel", soltarSalto);
  lienzo.addEventListener("pointerleave", soltarSalto);
  function boton(b, abajoFn, arribaFn) {
    if (!b) return;
    b.addEventListener("pointerdown", function (e) { e.preventDefault(); abajoFn(); });
    ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { b.addEventListener(ev, arribaFn); });
    b.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  }
  boton(bSalto, apretarSalto, soltarSalto);
  boton(bAbajo, function () { agachar(true); }, function () { agachar(false); });
  if (bPausa) bPausa.addEventListener("click", function () {
    if (estado === "jugando") pausar(); else if (estado === "pausa") reanudar();
  });
  function alternarSonido() {
    sonidoOn = !sonidoOn;
    guardar(K.son, sonidoOn ? "1" : "0");
    if (bSonido) bSonido.setAttribute("aria-pressed", sonidoOn ? "true" : "false");
    if (sonidoOn) sfx.fruto();
  }
  if (bSonido) {
    bSonido.setAttribute("aria-pressed", sonidoOn ? "true" : "false");
    bSonido.addEventListener("click", alternarSonido);
  }
  if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) {
    capaD.textContent = "Tocá «Saltar» (mantenelo para llegar más alto) y mantené «Agacharse» para pasar por abajo.";
  }

  /* ---- paneles: personajes y medallas ---- */
  function pintarPaneles() {
    if (listaPj) {
      listaPj.innerHTML = "";
      PERSONAJES.forEach(function (c) {
        var ok = desbloqueado(c), elegido = pj().id === c.id;
        var b = document.createElement("button");
        b.type = "button";
        b.className = "juego__pj" + (ok ? "" : " es-bloqueado");
        b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", elegido ? "true" : "false");
        b.disabled = !ok;
        var req = c.req ? MEDALLAS.filter(function (m) { return m.id === c.req; })[0] : null;
        b.innerHTML = '<span class="juego__pj-n">' + c.nombre + '</span><span class="juego__pj-r">' +
          (ok ? c.rasgo : "Se gana con la medalla de " + req.nombre.toLowerCase()) + "</span>";
        var cv = document.createElement("canvas");
        cv.width = 120; cv.height = 90; cv.setAttribute("aria-hidden", "true");
        b.insertBefore(cv, b.firstChild);
        var c2 = cv.getContext("2d");
        c2.translate(58, 82);
        dibujarPj(c2, c.id, { paso: 1.2, suelo: true, agachada: false, muerta: false, t: .3 });
        if (!ok) {
          c2.setTransform(1, 0, 0, 1, 0, 0);
          c2.globalCompositeOperation = "source-atop";
          c2.fillStyle = "rgba(35,35,48,.88)"; c2.fillRect(0, 0, 120, 90);
        }
        b.addEventListener("click", function () {
          pjId = c.id; guardar(K.pj, pjId); pintarPaneles();
          if (estado !== "jugando") { p.c = pj(); p.alto = p.c.alto; }
        });
        listaPj.appendChild(b);
      });
    }
    if (listaMed) {
      listaMed.innerHTML = "";
      MEDALLAS.forEach(function (m, k) {
        var li = document.createElement("li");
        li.className = "juego__med" + (k <= medGanada ? " es-ganada" : "");
        li.style.setProperty("--m", m.color);
        li.innerHTML = '<span class="juego__med-ico" aria-hidden="true"></span><span class="juego__med-n">' + m.nombre +
          '</span><span class="juego__med-p">' + (k <= medGanada ? "¡Ganada!" : m.pts + " puntos") + "</span>";
        listaMed.appendChild(li);
      });
    }
  }

  /* ================= ACTUALIZACIÓN ================= */
  function avanzar(dt) {
    t += dt;
    var jugando = estado === "jugando";
    var factor = rafaga.fase === "sopla" ? 1.3 : 1;
    var mov = jugando ? vel * factor * dt : (estado === "inicio" ? 34 * dt : 0);

    nubes.forEach(function (n) {
      n.x -= mov * n.v + (rafaga.fase === "sopla" ? 60 : 6) * dt;
      if (n.x + n.w < -20) { var nn = nuevaNube(W + 40 + Math.random() * 200); n.x = nn.x; n.y = nn.y; n.w = nn.w; n.h = nn.h; n.v = nn.v; }
    });
    if (Math.random() < dt * .12 && guanacos.length < 3) guanacos.push({ x: W + 30, y: 196 + Math.random() * 8, s: .55 + Math.random() * .25, paso: Math.random() * 6 });
    guanacos = guanacos.filter(function (g) { g.x -= mov * .28 + 8 * dt; g.paso += dt * 8; return g.x > -40; });
    textos = textos.filter(function (x) { x.y -= 40 * dt; x.v -= dt; return x.v > 0; });

    if (!jugando) {
      if (estado === "inicio") {
        // en la portada camina despacito por un llano sin peligros
        cam += mov; p.paso += dt * 5;
        if (genX < cam + W + 700) { tramos.push({ x0: genX, x1: genX + 800, tipo: "llano" }); genX += 800; }
      }
      return;
    }

    cam += mov;
    generar();
    vel = Math.min(VMAX, V0 + cam / 40 * .8);
    var mult = rafaga.fase === "sopla" ? 2 : 1;
    puntos += mov / 40 * mult;

    var metros = Math.floor(cam / 40);
    if (metros >= metrosHito + 100) { metrosHito = metros - metros % 100; flash = 1.2; sfx.hito(); }
    if (flash > 0) flash -= dt;

    // ráfagas de viento
    rafaga.t += dt;
    if (rafaga.fase === "nada" && metros > 80 && rafaga.t > proxRafaga) { rafaga = { fase: "aviso", t: 0 }; sfx.rafaga(); }
    else if (rafaga.fase === "aviso" && rafaga.t > 1.3) rafaga = { fase: "sopla", t: 0 };
    else if (rafaga.fase === "sopla" && rafaga.t > 4.5) { rafaga = { fase: "nada", t: 0 }; proxRafaga = 18 + Math.random() * 14; }
    var nv = rafaga.fase === "sopla" ? 14 : vel / 160;
    if (Math.random() < dt * nv) viento.push({ x: W + 10, y: 30 + Math.random() * 200, l: 30 + Math.random() * (rafaga.fase === "sopla" ? 120 : 60) });
    viento = viento.filter(function (v) { v.x -= vel * (rafaga.fase === "sopla" ? 2.6 : 1.6) * dt; return v.x + v.l > 0; });

    // medalla en carrera
    for (var k = MEDALLAS.length - 1; k > medRun; k--) {
      if (puntos >= MEDALLAS[k].pts) {
        medRun = k;
        textos.push({ x: W / 2, y: 110, txt: "¡Medalla " + MEDALLAS[k].nombre.toLowerCase() + "!", v: 2.2, c: MEDALLAS[k].color, grande: true });
        sfx.medalla();
        break;
      }
    }

    fisica(dt);
    if (estado !== "jugando") return;

    polvo = polvo.filter(function (q) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 120 * dt; q.v -= dt; return q.v > 0; });

    // frutos
    var caja = cajaJug();
    bayas.forEach(function (b) {
      if (b.tomada) return;
      if (choca(caja, { x: b.x - 9, y: b.y - 9, w: 18, h: 18 })) {
        b.tomada = true; frutos++; puntos += 10 * mult; sfx.fruto();
        textos.push({ x: b.x - cam, y: b.y - 10, txt: "+" + 10 * mult, v: .8, c: "#5b2a7a" });
      }
    });

    // obstáculos
    for (var j = 0; j < obst.length; j++) {
      var o = obst[j];
      if (o.tipo === "chimango") {
        o.aleteo += dt * 9;
        if (o.vivo) o.x -= 60 * dt;
        else { o.cae += dt; o.y += 260 * dt; continue; }
      }
      if (!choca(caja, cajaObst(o))) continue;
      // pisotón: cayendo y con los pies por encima del medio del chimango
      if (o.tipo === "chimango" && p.vy > 0 && p.y - 6 < o.y - o.h / 2) {
        o.vivo = false; pisados++; puntos += 50 * mult;
        p.vy = -520; p.suelo = false; p.sobre = null; p.sosten = tecla.salto ? T_SOSTEN * .6 : 0;
        sfx.piso();
        textos.push({ x: o.x - cam + 20, y: o.y - 30, txt: "¡Pisotón! +" + 50 * mult, v: .9, c: "#7a3d1d" });
        continue;
      }
      terminar(false);
      return;
    }

    // limpiar lo que quedó atrás
    var atras = cam - 200;
    obst = obst.filter(function (o) { return o.x + o.w > atras && o.y < H + 60; });
    bayas = bayas.filter(function (b) { return b.x > atras; });
    plataformas = plataformas.filter(function (q) { return q.x + q.w > atras; });
    tramos = tramos.filter(function (s) { return s.x1 > atras - 400; });

    oPuntos.textContent = Math.floor(puntos);
    oFrutos.textContent = frutos;
  }

  /* Salto «de plataforma»: si se mantiene apretado sube más (la gravedad
     pesa menos durante un instante), hay un respiro al borde de una
     barda (coyote) y el salto se recuerda si se aprieta justo antes de
     tocar el suelo (buffer). */
  function fisica(dt) {
    var c = p.c, wx = cam + PX;
    if (p.buffer > 0) p.buffer -= dt;
    var puede = p.suelo || p.aire < COYOTE;
    if (p.buffer > 0 && puede) {
      p.vy = -SALTO * c.salto; p.suelo = false; p.sobre = null; p.aire = COYOTE; p.sosten = T_SOSTEN; p.buffer = 0;
      sfx.salto();
      for (var k = 0; k < 5; k++) polvo.push({ x: PX - 10 + Math.random() * 20, y: p.y, vx: -60 - Math.random() * 80, vy: -40 - Math.random() * 60, v: .5 });
    }
    p.agachada = tecla.abajo && p.suelo;

    if (p.suelo) {
      p.paso += dt * (vel / 40);
      if (p.sobre) {
        if (wx < p.sobre.x - 14 || wx > p.sobre.x + p.sobre.w + 14) { p.suelo = false; p.sobre = null; p.aire = 0; }
        else p.y = p.sobre.y;
      } else {
        var g = sueloEn(wx);
        if (g == null) { p.suelo = false; p.aire = 0; }
        else if (g > p.y + 22) { p.suelo = false; p.aire = 0; }
        else p.y = g;
      }
      if (p.suelo && Math.random() < dt * 8) polvo.push({ x: PX - 30, y: p.y, vx: -vel * .3 - Math.random() * 40, vy: -10 - Math.random() * 30, v: .35 });
      return;
    }

    p.aire += dt;
    var grav = GRAV * c.grav;
    if (p.vy < 0 && tecla.salto && p.sosten > 0) { grav *= SOSTEN; p.sosten -= dt; }
    else p.sosten = 0;
    if (tecla.abajo) grav *= 1.6;
    if (c.id === "choique" && p.vy > 0 && tecla.salto) grav *= .55; // planea
    var antes = p.y;
    p.vy = Math.min(p.vy + grav * dt, 1400);
    p.y += p.vy * dt;

    if (p.vy >= 0) {
      for (var j = 0; j < plataformas.length; j++) {
        var q = plataformas[j];
        if (wx < q.x - 14 || wx > q.x + q.w + 14) continue;
        if (antes <= q.y + 2 && p.y >= q.y) { aterrizar(q.y, q); return; }
      }
    }
    var g2 = sueloEn(wx);
    if (g2 != null && p.y >= g2 && (p.vy >= 0 || p.y - g2 < 30)) { aterrizar(g2, null); return; }
    if (p.y > H + 60) terminar(true);
  }
  function aterrizar(y, sobre) {
    p.y = y; p.vy = 0; p.suelo = true; p.sobre = sobre; p.aire = 0;
    for (var k = 0; k < 4; k++) polvo.push({ x: PX - 20 + Math.random() * 40, y: y, vx: -40 - Math.random() * 120, vy: -30 - Math.random() * 40, v: .45 });
  }

  /* ================= DIBUJO ================= */
  function cielo(noche) {
    var g = ctx.createLinearGradient(0, 0, 0, SUELO);
    var arriba = noche < .5 ? mezcla("#5fa7dc", "#2b4a7d", noche * 2) : mezcla("#2b4a7d", "#0b1430", (noche - .5) * 2);
    var abajoC = noche < .5 ? mezcla("#cfe6f5", "#f2a65a", noche * 2) : mezcla("#f2a65a", "#1d2a4d", (noche - .5) * 2);
    g.addColorStop(0, arriba); g.addColorStop(1, abajoC);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (noche > .45) {
      var a = Math.min(1, (noche - .45) * 3);
      ESTRELLAS.forEach(function (s) {
        ctx.globalAlpha = a * (.55 + .45 * Math.sin(t * 2 + s[3]));
        ctx.fillStyle = "#fff"; ctx.fillRect(s[0], s[1], s[2], s[2]);
      });
      ctx.globalAlpha = a; ctx.fillStyle = "#fffbe8";
      CRUZ.forEach(function (c, k) { ctx.beginPath(); ctx.arc(c[0], c[1], k < 4 ? 1.9 : 1.2, 0, 7); ctx.fill(); });
      ctx.globalAlpha = 1;
    }
    var sx = 560, sy = lerp(60, 230, Math.min(1, noche * 1.6));
    if (noche < .7) {
      ctx.fillStyle = mezcla("#fff4c2", "#ff9a3d", Math.min(1, noche * 1.8));
      ctx.globalAlpha = .35; ctx.beginPath(); ctx.arc(sx, sy, 34, 0, 7); ctx.fill();
      ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(sx, sy, 22, 0, 7); ctx.fill();
    }
    if (noche > .55) {
      var my = lerp(200, 52, Math.min(1, (noche - .55) * 2.5));
      ctx.fillStyle = "#f4f1e3"; ctx.beginPath(); ctx.arc(170, my, 16, 0, 7); ctx.fill();
      ctx.fillStyle = arriba; ctx.beginPath(); ctx.arc(177, my - 4, 14, 0, 7); ctx.fill();
    }
  }
  function pintarNube(n, noche) {
    ctx.fillStyle = noche > .5 ? "rgba(170,180,210,.35)" : mezcla("#ffffff", "#ffd2a8", Math.min(1, noche * 2));
    ctx.globalAlpha = noche > .5 ? 1 : .9;
    ctx.beginPath(); ctx.ellipse(n.x + n.w / 2, n.y, n.w / 2, n.h / 2, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = .55;
    ctx.beginPath(); ctx.ellipse(n.x + n.w / 2, n.y - n.h * .45, n.w * .36, n.h * .35, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }
  function pintarGuanacoFondo(g, noche) {
    ctx.save(); ctx.translate(g.x, g.y); ctx.scale(g.s, g.s);
    ctx.fillStyle = noche > .5 ? "#3a3550" : "#9a6b3f";
    ctx.beginPath(); ctx.ellipse(0, -22, 16, 8, 0, 0, 7); ctx.fill();
    ctx.fillRect(10, -46, 5, 24);
    ctx.beginPath(); ctx.ellipse(16, -46, 6, 3.5, 0, 0, 7); ctx.fill();
    ctx.fillRect(10, -52, 2, 6);
    var q = Math.sin(g.paso) * 4;
    ctx.fillRect(-12 + q, -16, 2.5, 16); ctx.fillRect(-7 - q, -16, 2.5, 16);
    ctx.fillRect(7 + q, -16, 2.5, 16); ctx.fillRect(11 - q, -16, 2.5, 16);
    ctx.restore();
  }

  /* El terreno: se recorre la pantalla de a pasos y se corta en los cañadones. */
  function pintarTerreno(noche) {
    var g = ctx.createLinearGradient(0, 180, 0, H);
    g.addColorStop(0, mezcla("#c9a96b", "#3d3a4a", noche)); g.addColorStop(1, mezcla("#a8874f", "#2a2838", noche));
    var x, y, dentro = false, pozos = [];
    ctx.fillStyle = g;
    for (x = 0; x <= W + 6; x += 6) {
      y = sueloEn(cam + x);
      if (y == null) {
        if (dentro) { ctx.lineTo(x, H); ctx.closePath(); ctx.fill(); dentro = false; }
        if (!pozos.length || pozos[pozos.length - 1].fin != null) pozos.push({ ini: x, fin: null });
      } else {
        if (pozos.length && pozos[pozos.length - 1].fin == null) pozos[pozos.length - 1].fin = x;
        if (!dentro) { ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x, y); dentro = true; }
        else ctx.lineTo(x, y);
      }
    }
    if (dentro) { ctx.lineTo(W + 6, H); ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle = mezcla("#8a6c3c", "#24222f", noche); ctx.lineWidth = 2.2;
    ctx.beginPath();
    var trazando = false;
    for (x = 0; x <= W + 6; x += 6) {
      y = sueloEn(cam + x);
      if (y == null) { trazando = false; continue; }
      if (!trazando) { ctx.moveTo(x, y); trazando = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
    pozos.forEach(function (pz) {
      var a = pz.ini - 3, b = (pz.fin == null ? W + 6 : pz.fin) + 3;
      var gg = ctx.createLinearGradient(0, SUELO, 0, H);
      gg.addColorStop(0, mezcla("#5a3f28", "#1c1a26", noche)); gg.addColorStop(1, "#140f0c");
      ctx.fillStyle = gg;
      ctx.fillRect(a, SUELO, b - a, H - SUELO);
      ctx.fillStyle = mezcla("#7c5a3a", "#2a2634", noche);
      for (var k = 0; k < 4; k++) {
        ctx.fillRect(a, SUELO + k * 12, 6 - k, 10);
        ctx.fillRect(b - 6 + k, SUELO + k * 12, 6 - k, 10);
      }
    });
    var off = -(cam % 1600);
    for (var rep = 0; rep < 2; rep++) {
      for (var k2 = 0; k2 < MATAS.length; k2++) {
        var m = MATAS[k2], sx = off + rep * 1600 + m.x;
        if (sx < -30 || sx > W + 30) continue;
        var base = sueloEn(cam + sx);
        if (base == null) continue;
        var yy = base + m.dy;
        if (yy > H - 2) continue;
        if (m.piedra) {
          ctx.fillStyle = mezcla("#8d8576", "#46435a", noche);
          ctx.beginPath(); ctx.ellipse(sx, yy, 5 * m.s, 3 * m.s, 0, 0, 7); ctx.fill();
        } else {
          var inclina = rafaga.fase === "sopla" ? -4 : 0;
          ctx.strokeStyle = mezcla("#e0bf62", "#5b5670", noche); ctx.lineWidth = 1.6;
          ctx.beginPath();
          for (var h = -3; h <= 3; h++) {
            ctx.moveTo(sx, yy);
            ctx.lineTo(sx + h * 3 * m.s + inclina + Math.sin(t * 3 + m.x) * 1.5, yy - (10 + Math.abs(3 - Math.abs(h)) * 3) * m.s);
          }
          ctx.stroke();
        }
      }
    }
  }

  function pintarPlataforma(q, noche) {
    var x = q.x - cam;
    if (x > W + 20 || x + q.w < -20) return;
    ctx.fillStyle = mezcla("#a2714a", "#3a3044", noche);
    ctx.beginPath();
    ctx.moveTo(x, q.y); ctx.lineTo(x + q.w, q.y);
    ctx.lineTo(x + q.w - 8, q.y + 16); ctx.lineTo(x + q.w * .7, q.y + 24);
    ctx.lineTo(x + q.w * .35, q.y + 20); ctx.lineTo(x + 6, q.y + 17);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = mezcla("#c08a5a", "#4a3e56", noche); ctx.fillRect(x + 2, q.y + 4, q.w - 6, 4);
    ctx.fillStyle = mezcla("#8a5d3a", "#2f2738", noche); ctx.fillRect(x + 4, q.y + 10, q.w - 12, 3);
    ctx.fillStyle = mezcla("#c9b25a", "#4f4a62", noche); ctx.fillRect(x, q.y - 3, q.w, 4);
  }

  function pintarBaya(b, noche) {
    if (b.tomada) return;
    var x = b.x - cam, y = b.y + Math.sin(t * 4 + b.f) * 3;
    if (x < -20 || x > W + 20) return;
    ctx.fillStyle = "#3f6b34";
    ctx.beginPath(); ctx.ellipse(x + 5, y - 9, 5, 2.4, -.6, 0, 7); ctx.fill();
    ctx.fillStyle = noche > .5 ? "#8a5bb8" : "#5b2a7a";
    ctx.beginPath(); ctx.arc(x - 3, y, 5.2, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 4, y + 1, 5.2, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y - 5, 5.2, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.beginPath(); ctx.arc(x - 1.5, y - 7, 1.6, 0, 7); ctx.fill();
  }

  /* ---- personajes (se dibujan con los pies en 0,0, mirando a la derecha) ---- */
  function ojo(c, x, y, muerta) {
    if (muerta) {
      c.strokeStyle = "#fff"; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(x - 2.5, y - 2.5); c.lineTo(x + 2.5, y + 2.5); c.moveTo(x + 2.5, y - 2.5); c.lineTo(x - 2.5, y + 2.5); c.stroke();
    } else {
      c.fillStyle = "#fff"; c.beginPath(); c.arc(x, y, 2.6, 0, 7); c.fill();
      c.fillStyle = "#111"; c.beginPath(); c.arc(x + .7, y, 1.3, 0, 7); c.fill();
    }
  }
  function dibujarPj(c, id, e) {
    var tt = e.t != null ? e.t : t;
    var ag = e.agachada, sy = ag ? .72 : 1;
    c.lineCap = "round";
    function pata(px, desf, largo, ancho, color) {
      var a = e.suelo && !e.muerta ? Math.sin(e.paso + desf) * 6 : (e.muerta ? 0 : 4);
      c.strokeStyle = color; c.lineWidth = ancho;
      c.beginPath(); c.moveTo(px, -largo * sy); c.lineTo(px + a, e.suelo ? 0 : -5); c.stroke();
    }
    if (id === "guanaco") {
      pata(-16, 0, 24, 3.6, "#6e4a2b"); pata(-9, Math.PI, 24, 3.6, "#6e4a2b");
      pata(10, Math.PI, 24, 3.6, "#6e4a2b"); pata(17, 0, 24, 3.6, "#6e4a2b");
      c.save(); c.scale(ag ? 1.1 : 1, sy);
      c.fillStyle = "#b9824f"; c.beginPath(); c.ellipse(0, -32, 24, 11, 0, 0, 7); c.fill();
      c.fillStyle = "#f1e3c8"; c.beginPath(); c.ellipse(2, -26, 18, 5, 0, 0, 7); c.fill();
      c.fillStyle = "#8f5f37"; c.beginPath(); c.ellipse(-24, -34 + Math.sin(tt * 10) * 1.2, 4, 6, -.4, 0, 7); c.fill();
      c.restore();
      var hx = ag ? 36 : 26, hy = ag ? -30 : -64;
      c.strokeStyle = "#b9824f"; c.lineWidth = 8;
      c.beginPath(); c.moveTo(14, -36 * sy); c.lineTo(hx - 3, hy + 3); c.stroke();
      c.fillStyle = "#b9824f"; c.beginPath(); c.ellipse(hx, hy, 10, 6, .25, 0, 7); c.fill();
      c.fillStyle = "#4a4a4a"; c.beginPath(); c.ellipse(hx + 6, hy + 2, 4, 3.4, .2, 0, 7); c.fill();
      c.fillStyle = "#8f5f37"; c.beginPath(); c.ellipse(hx - 6, hy - 7, 2.2, 5, -.3, 0, 7); c.fill();
      ojo(c, hx + 2, hy - 2, e.muerta);
    } else if (id === "choique") {
      pata(-4, 0, 34, 3, "#b08d5a"); pata(6, Math.PI, 34, 3, "#b08d5a");
      c.save(); c.scale(ag ? 1.15 : 1, sy);
      c.fillStyle = "#8d8276"; c.beginPath(); c.ellipse(0, -42, 20, 15, -.1, 0, 7); c.fill();
      c.fillStyle = "#a99d8f";
      for (var k = 0; k < 6; k++) { c.beginPath(); c.arc(-12 + k * 5, -44 + (k % 2) * 6, 3, 0, 7); c.fill(); }
      c.fillStyle = "#6f655a"; c.beginPath(); c.moveTo(-18, -46); c.lineTo(-30, -52 + Math.sin(tt * 12) * 2); c.lineTo(-20, -38); c.fill();
      c.restore();
      var cx = ag ? 30 : 18, cy = ag ? -36 : -74;
      c.strokeStyle = "#9c9085"; c.lineWidth = 5;
      c.beginPath(); c.moveTo(12, -48 * sy); c.quadraticCurveTo(cx - 6, (cy - 48 * sy) / 2, cx, cy); c.stroke();
      c.fillStyle = "#9c9085"; c.beginPath(); c.ellipse(cx + 2, cy, 6, 5, 0, 0, 7); c.fill();
      c.fillStyle = "#e3c15b"; c.beginPath(); c.moveTo(cx + 6, cy - 1); c.lineTo(cx + 13, cy + 1); c.lineTo(cx + 6, cy + 3); c.fill();
      ojo(c, cx + 3, cy - 1.5, e.muerta);
    } else {
      pata(-14, 0, 12, 4.2, "#2f2622"); pata(-7, Math.PI, 12, 4.2, "#2f2622");
      pata(9, Math.PI, 12, 4.2, "#2f2622"); pata(16, 0, 12, 4.2, "#2f2622");
      c.save(); c.scale(ag ? 1.15 : 1, sy);
      var bolas = [[-18, -26, 11], [-6, -32, 12], [8, -31, 12], [18, -24, 10], [-12, -18, 11], [4, -17, 12], [16, -16, 9], [-22, -18, 8]];
      c.fillStyle = "#ddd3c1"; bolas.forEach(function (b) { c.beginPath(); c.arc(b[0] + 1.5, b[1] + 2, b[2], 0, 7); c.fill(); });
      c.fillStyle = "#f6f1e6"; bolas.forEach(function (b) { c.beginPath(); c.arc(b[0], b[1], b[2], 0, 7); c.fill(); });
      c.beginPath(); c.arc(-29, -26 + Math.sin(tt * 12) * 1.2, 5, 0, 7); c.fill();
      c.restore();
      var ox = ag ? 34 : 27, oy = ag ? -16 : -30;
      if (!e.suelo && !e.muerta) oy -= 2;
      c.fillStyle = "#3a2d27"; c.beginPath(); c.ellipse(ox, oy, 10, 8, .35, 0, 7); c.fill();
      c.beginPath(); c.ellipse(ox - 7, oy - 6, 6, 2.8, -.5 + Math.sin(tt * 9) * .15, 0, 7); c.fill();
      c.fillStyle = "#f6f1e6"; c.beginPath(); c.arc(ox - 4, oy - 8, 5, 0, 7); c.fill();
      ojo(c, ox + 3.5, oy - 2, e.muerta);
    }
  }

  function pintarJugador() {
    ctx.save();
    var piso = p.sobre ? p.sobre.y : sueloEn(cam + PX);
    if (piso != null && piso >= p.y - 1) {
      var alto = Math.max(0, piso - p.y);
      ctx.fillStyle = "rgba(0,0,0,.18)";
      ctx.beginPath(); ctx.ellipse(PX - 2, piso + 1, 24 * Math.max(.3, 1 - alto / 250), 4, 0, 0, 7); ctx.fill();
    }
    ctx.translate(PX, p.y);
    if (p.suelo && !p.sobre) {
      var a = sueloEn(cam + PX - 10), b = sueloEn(cam + PX + 10);
      if (a != null && b != null) ctx.rotate(Math.atan2(b - a, 20) * .8);
    } else if (!p.suelo) {
      ctx.rotate(Math.max(-.25, Math.min(.3, p.vy / 2400)));
    }
    dibujarPj(ctx, p.c.id, p);
    ctx.restore();
  }

  function pintarObst(o, noche) {
    var x = o.x - cam;
    if (x > W + 40 || x + o.w < -40) return;
    ctx.save();
    var osc = noche * .55;
    if (o.tipo === "neneo") {
      for (var k = 0; k < o.n; k++) {
        var cx = x + 4 + k * 30 + 15, r = o.h / 2;
        ctx.fillStyle = mezcla("#6f7f32", "#2f3a2a", osc);
        ctx.beginPath(); ctx.ellipse(cx, o.y - r + 2, 17, r, 0, Math.PI, 0); ctx.lineTo(cx + 17, o.y + 3); ctx.lineTo(cx - 17, o.y + 3); ctx.fill();
        ctx.fillStyle = mezcla("#8fa244", "#3b4834", osc);
        for (var d = 0; d < 7; d++) { ctx.beginPath(); ctx.arc(cx - 11 + (d * 37 % 22), o.y - 6 - (d * 13 % (o.h - 12)), 2.6, 0, 7); ctx.fill(); }
      }
    } else if (o.tipo === "calafate") {
      var c2 = x + o.w / 2;
      ctx.strokeStyle = mezcla("#5a3d25", "#2a2230", osc); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(c2, o.y + 3); ctx.lineTo(c2, o.y - o.h + 8); ctx.stroke();
      ctx.fillStyle = mezcla("#3f6b34", "#26352a", osc);
      ctx.beginPath(); ctx.moveTo(x - 2, o.y - 6);
      ctx.quadraticCurveTo(x - 6, o.y - o.h, c2, o.y - o.h);
      ctx.quadraticCurveTo(x + o.w + 6, o.y - o.h, x + o.w + 2, o.y - 6);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#5b2a7a";
      for (var b = 0; b < 6; b++) { ctx.beginPath(); ctx.arc(x + 5 + (b * 11 % (o.w - 6)), o.y - 12 - (b * 17 % (o.h - 20)), 2.4, 0, 7); ctx.fill(); }
    } else if (o.tipo === "piedra") {
      ctx.fillStyle = mezcla("#8a8578", "#44425a", osc);
      ctx.beginPath(); ctx.moveTo(x, o.y + 3); ctx.lineTo(x + 6, o.y - o.h * .7); ctx.lineTo(x + o.w * .4, o.y - o.h);
      ctx.lineTo(x + o.w * .8, o.y - o.h * .85); ctx.lineTo(x + o.w, o.y + 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.18)";
      ctx.beginPath(); ctx.moveTo(x + 8, o.y - o.h * .65); ctx.lineTo(x + o.w * .4, o.y - o.h + 2); ctx.lineTo(x + o.w * .45, o.y - o.h * .6); ctx.fill();
    } else {
      var ala = o.vivo ? Math.sin(o.aleteo) : -.6;
      var bx = x + o.w / 2, by = o.y - o.h / 2;
      if (!o.vivo) { ctx.translate(bx, by); ctx.rotate(o.cae * 6); ctx.translate(-bx, -by); }
      ctx.fillStyle = "#6b4a2f"; ctx.beginPath(); ctx.ellipse(bx, by, 16, 6.5, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(bx + 12, by); ctx.lineTo(bx + 26, by - 4); ctx.lineTo(bx + 26, by + 5); ctx.fill();
      ctx.fillStyle = "#57391f"; ctx.beginPath(); ctx.moveTo(bx - 4, by - 2); ctx.lineTo(bx + 8, by - 2); ctx.lineTo(bx + 4, by - 2 - 16 * ala); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#c9ae86"; ctx.beginPath(); ctx.arc(bx - 15, by - 2, 5.5, 0, 7); ctx.fill();
      ctx.fillStyle = "#e3c15b"; ctx.beginPath(); ctx.moveTo(bx - 20, by - 3); ctx.lineTo(bx - 25, by); ctx.lineTo(bx - 19, by); ctx.fill();
      ctx.fillStyle = "#111"; ctx.fillRect(bx - 17, by - 4, 1.6, 1.6);
    }
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill();
  }

  function dibujar() {
    var metros = cam / 40;
    var ciclo = (metros % 1400) / 1400;
    var noche = ciclo < .4 ? 0 : ciclo < .55 ? (ciclo - .4) / .15 * .5 : ciclo < .8 ? .5 + Math.min(.5, (ciclo - .55) / .1 * .5) : Math.max(0, 1 - (ciclo - .8) / .2);

    ctx.clearRect(0, 0, W, H);
    cielo(noche);
    nubes.forEach(function (n) { pintarNube(n, noche); });
    pintarPerfil(ANDES, cam * .08, 1600, mezcla("#7d93b5", "#2c3552", noche), H);
    pintarNieve(ANDES, cam * .08, 1600, mezcla("#f4f7fb", "#8f9ab8", noche));
    pintarPerfil(MESETA, cam * .25, 1200, mezcla("#c08a5a", "#3b3348", noche), H);
    ctx.globalAlpha = .25;
    pintarPerfil(MESETA.map(function (q) { return [q[0], q[1] + 9]; }), cam * .25, 1200, mezcla("#e6b886", "#5a4f66", noche), H);
    ctx.globalAlpha = 1;
    guanacos.forEach(function (g) { pintarGuanacoFondo(g, noche); });
    pintarTerreno(noche);
    plataformas.forEach(function (q) { pintarPlataforma(q, noche); });

    ctx.strokeStyle = noche > .5 ? "rgba(200,210,240,.4)" : "rgba(255,255,255,.6)";
    ctx.lineWidth = rafaga.fase === "sopla" ? 2 : 1.4;
    viento.forEach(function (v) { ctx.beginPath(); ctx.moveTo(v.x, v.y); ctx.quadraticCurveTo(v.x + v.l / 2, v.y - 4, v.x + v.l, v.y); ctx.stroke(); });

    bayas.forEach(function (b) { pintarBaya(b, noche); });
    obst.forEach(function (o) { pintarObst(o, noche); });

    ctx.fillStyle = mezcla("#d9bf8c", "#56526a", noche);
    polvo.forEach(function (q) { ctx.globalAlpha = Math.max(0, q.v * 2); ctx.beginPath(); ctx.arc(q.x, q.y, 2.4, 0, 7); ctx.fill(); });
    ctx.globalAlpha = 1;

    pintarJugador();

    ctx.textAlign = "center";
    textos.forEach(function (x) {
      ctx.globalAlpha = Math.min(1, x.v * 2);
      ctx.font = (x.grande ? "800 26px" : "800 15px") + " Archivo, system-ui, sans-serif";
      ctx.lineWidth = 4; ctx.strokeStyle = "rgba(255,255,255,.85)";
      ctx.strokeText(x.txt, x.x, x.y);
      ctx.fillStyle = x.c; ctx.fillText(x.txt, x.x, x.y);
    });
    ctx.globalAlpha = 1;

    if (estado === "jugando" || estado === "pausa") {
      if (flash > 0) {
        ctx.globalAlpha = Math.min(1, flash);
        ctx.fillStyle = noche > .5 ? "#fff" : "#1d3a66";
        ctx.font = "800 22px Archivo, system-ui, sans-serif";
        ctx.fillText(metrosHito + " m", W / 2, 72);
        ctx.globalAlpha = 1;
      }
      if (rafaga.fase !== "nada") {
        ctx.globalAlpha = rafaga.fase === "aviso" ? (Math.sin(t * 18) > 0 ? 1 : .35) : 1;
        var anchoR = rafaga.fase === "aviso" ? 196 : 170;
        ctx.fillStyle = "#1d3a66";
        roundRect(W / 2 - anchoR / 2, 14, anchoR, 30, 15);
        ctx.fillStyle = "#f4d78e";
        ctx.font = "800 14px Archivo, system-ui, sans-serif";
        ctx.fillText(rafaga.fase === "aviso" ? "¡Se viene una ráfaga!" : "Ráfaga · puntos x2", W / 2, 34);
        ctx.globalAlpha = 1;
      }
    }
  }

  /* ---- tamaño real del lienzo (nítido en pantallas de alta densidad) ---- */
  function ajustar() {
    var ancho = lienzo.clientWidth || W;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    lienzo.width = Math.round(ancho * dpr);
    lienzo.height = Math.round(ancho * H / W * dpr);
    var e = lienzo.width / W;
    ctx.setTransform(e, 0, 0, e, 0, 0);
  }

  /* ---- bucle ---- */
  var previo = 0, anchoVisto = -1;
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) pausar();
    previo = 0;
  });
  function cuadro(ms) {
    // Si el juego está oculto (otra pestaña del Recreo) no se calcula nada.
    if (marco.offsetParent && !document.hidden) {
      if (lienzo.clientWidth !== anchoVisto) { anchoVisto = lienzo.clientWidth; ajustar(); }
      var dt = previo ? Math.min(.04, (ms - previo) / 1000) : 0;
      previo = ms;
      if (estado !== "pausa") avanzar(dt);
      dibujar();
    } else {
      previo = 0;
      if (estado === "jugando") pausar();
    }
    window.requestAnimationFrame(cuadro);
  }

  reiniciar();
  pintarPaneles();
  window.requestAnimationFrame(cuadro);
})();
