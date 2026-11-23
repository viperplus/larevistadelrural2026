/* ------------------------------------------------------------------
   Recreo: menú de juegos, Memotest del Rural, Trivia de la revista y
   Sopa patagónica. Sin librerías; los récords quedan en el navegador.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  function leer(k, d) { try { var v = window.localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function guardar(k, v) { try { window.localStorage.setItem(k, String(v)); } catch (e) {} }
  function mezclar(a) {
    for (var k = a.length - 1; k > 0; k--) { var j = Math.floor(Math.random() * (k + 1)); var x = a[k]; a[k] = a[j]; a[j] = x; }
    return a;
  }
  function reloj(s) { s = Math.floor(s); return Math.floor(s / 60) + ":" + ("0" + s % 60).slice(-2); }
  function datos(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  }
  var muevase = !window.matchMedia || window.matchMedia("(prefers-reduced-motion: no-preference)").matches;

  /* Sonidos cortitos, compartidos por los tres juegos */
  var audio = null;
  function tono(f, dur, tipo, vol, demora) {
    if (leer("recreo-oveja-sonido", "1") === "0") return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      if (!audio) audio = new AC();
      if (audio.state === "suspended") audio.resume();
      var t0 = audio.currentTime + (demora || 0);
      var o = audio.createOscillator(), g = audio.createGain();
      o.type = tipo || "sine"; o.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(vol || .07, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
      o.connect(g); g.connect(audio.destination); o.start(t0); o.stop(t0 + dur + .02);
    } catch (e) {}
  }
  var son = {
    bien: function () { tono(784, .1, "triangle", .08); tono(1175, .16, "triangle", .07, .08); },
    mal: function () { tono(220, .22, "sawtooth", .05); },
    clic: function () { tono(660, .05, "square", .03); },
    fiesta: function () { [523, 659, 784, 1047, 1319].forEach(function (f, k) { tono(f, .14, "triangle", .07, k * .09); }); }
  };

  function confeti(cont) {
    if (!muevase || !cont) return;
    var capa = document.createElement("div");
    capa.className = "rc-confeti"; capa.setAttribute("aria-hidden", "true");
    var col = ["#6d2ab0", "#f4d78e", "#3fb596", "#e0679b", "#75aadb", "#d9a441"];
    for (var k = 0; k < 70; k++) {
      var s = document.createElement("span");
      s.style.left = Math.random() * 100 + "%";
      s.style.setProperty("--c", col[k % col.length]);
      s.style.setProperty("--x", (Math.random() * 12 - 6) + "rem");
      s.style.setProperty("--r", (Math.random() * 900 - 450) + "deg");
      s.style.animationDelay = Math.random() * .4 + "s";
      capa.appendChild(s);
    }
    cont.appendChild(capa);
    setTimeout(function () { capa.remove(); }, 3600);
  }

  /* ================= MENÚ DE JUEGOS =================
     Las cuatro tarjetas funcionan como pestañas: se ve un juego por vez
     y la dirección (#oveja, #memotest...) recuerda cuál estaba abierto. */
  (function menu() {
    var ops = Array.prototype.slice.call(document.querySelectorAll(".recreo__op[data-tab]"));
    if (!ops.length) return;
    var secciones = ops.map(function (o) { return document.getElementById(o.dataset.tab); });
    document.documentElement.classList.add("recreo-js");
    function abrir(id, foco) {
      if (!document.getElementById(id)) id = ops[0].dataset.tab;
      ops.forEach(function (o, k) {
        var si = o.dataset.tab === id;
        o.setAttribute("aria-current", si ? "true" : "false");
        if (secciones[k]) secciones[k].hidden = !si;
      });
      document.dispatchEvent(new CustomEvent("recreo:abierto", { detail: id }));
      if (foco) {
        var s = document.getElementById(id);
        var t = s && s.querySelector(".juego__t");
        if (t) { t.setAttribute("tabindex", "-1"); t.focus({ preventScroll: true }); }
        if (s && s.getBoundingClientRect().top < 0) s.scrollIntoView({ behavior: muevase ? "smooth" : "auto", block: "start" });
      }
    }
    ops.forEach(function (o) {
      o.addEventListener("click", function (e) {
        e.preventDefault();
        if (history.replaceState) history.replaceState(null, "", "#" + o.dataset.tab);
        abrir(o.dataset.tab, true);
      });
    });
    window.addEventListener("hashchange", function () { abrir(location.hash.slice(1), false); });
    abrir(location.hash.slice(1) || ops[0].dataset.tab, false);
  })();

  /* ================= MEMOTEST ================= */
  (function memotest() {
    var sec = document.querySelector('[data-juego="memotest"]');
    var figus = datos("datos-memotest");
    if (!sec || !figus || !figus.length) return;
    var tablero = sec.querySelector(".mm__tablero");
    var aviso = sec.querySelector(".mm__aviso");
    var oMov = sec.querySelector('[data-m="mov"]'), oTiempo = sec.querySelector('[data-m="tiempo"]'), oMejor = sec.querySelector('[data-m="mejor"]');
    var niveles = Array.prototype.slice.call(sec.querySelectorAll(".mm__niv"));
    var pares = parseInt(leer("recreo-memo-nivel", "8"), 10) || 8;
    var abiertas = [], bloqueado = false, mov = 0, hechos = 0, inicio = 0, intervalo = null;

    function mejorClave() { return "recreo-memo-mejor-" + pares; }
    function pintarMejor() {
      var m = leer(mejorClave(), "");
      oMejor.textContent = m ? m.split("|")[0] + " mov · " + reloj(+m.split("|")[1]) : "—";
    }
    function armar() {
      clearInterval(intervalo); intervalo = null;
      abiertas = []; bloqueado = false; mov = 0; hechos = 0; inicio = 0;
      oMov.textContent = "0"; oTiempo.textContent = "0:00"; aviso.textContent = "";
      niveles.forEach(function (b) { b.setAttribute("aria-pressed", +b.dataset.pares === pares ? "true" : "false"); });
      pintarMejor();
      var elegidas = mezclar(figus.slice()).slice(0, pares);
      var cartas = mezclar(elegidas.concat(elegidas).map(function (f, k) { return { f: f, id: elegidas.indexOf(f) }; }));
      tablero.innerHTML = "";
      tablero.style.setProperty("--cols", pares <= 6 ? 4 : pares <= 8 ? 4 : 6);
      tablero.dataset.pares = pares;
      cartas.forEach(function (c, k) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "mm__carta";
        b.dataset.id = c.id;
        b.style.setProperty("--k", k);
        b.setAttribute("aria-label", "Carta " + (k + 1) + ", boca abajo");
        b.innerHTML = '<span class="mm__in"><span class="mm__cara mm__cara--dorso" aria-hidden="true"></span>' +
          '<span class="mm__cara mm__cara--frente"><img alt="" loading="lazy" src="' + c.f.s + '">' +
          '<span class="mm__nom">' + c.f.n + '</span></span></span>';
        b._f = c.f;
        b.addEventListener("click", function () { voltear(b); });
        tablero.appendChild(b);
      });
    }
    function voltear(b) {
      if (bloqueado || b.classList.contains("es-vista") || b.classList.contains("es-par")) return;
      if (!inicio) {
        inicio = Date.now();
        intervalo = setInterval(function () { oTiempo.textContent = reloj((Date.now() - inicio) / 1000); }, 500);
      }
      son.clic();
      b.classList.add("es-vista");
      b.setAttribute("aria-label", b._f.n + ", de " + b._f.g);
      abiertas.push(b);
      if (abiertas.length < 2) return;
      mov++; oMov.textContent = mov;
      var a = abiertas[0], c = abiertas[1];
      abiertas = [];
      if (a.dataset.id === c.dataset.id) {
        hechos++;
        setTimeout(function () {
          a.classList.add("es-par"); c.classList.add("es-par");
          son.bien();
          aviso.textContent = "¡Pareja! " + a._f.n + " · " + a._f.g;
          if (hechos === pares) ganar();
        }, 380);
      } else {
        bloqueado = true;
        setTimeout(function () {
          a.classList.add("es-error"); c.classList.add("es-error");
          son.mal();
        }, 420);
        setTimeout(function () {
          [a, c].forEach(function (x) { x.classList.remove("es-vista", "es-error"); x.setAttribute("aria-label", "Carta boca abajo"); });
          bloqueado = false;
        }, 1100);
      }
    }
    function ganar() {
      clearInterval(intervalo);
      var seg = (Date.now() - inicio) / 1000;
      var m = leer(mejorClave(), "");
      var record = !m || mov < +m.split("|")[0] || (mov === +m.split("|")[0] && seg < +m.split("|")[1]);
      if (record) guardar(mejorClave(), mov + "|" + Math.round(seg));
      pintarMejor();
      aviso.textContent = (record ? "¡Récord! " : "¡Completaste el memotest! ") + mov + " movimientos en " + reloj(seg) + ".";
      son.fiesta();
      confeti(sec);
    }
    niveles.forEach(function (b) {
      b.addEventListener("click", function () { pares = +b.dataset.pares; guardar("recreo-memo-nivel", pares); armar(); });
    });
    sec.querySelector(".mm__nuevo").addEventListener("click", armar);
    armar();
  })();

  /* ================= TRIVIA ================= */
  (function trivia() {
    var sec = document.querySelector('[data-juego="trivia"]');
    var banco = datos("datos-trivia");
    if (!sec || !banco || !banco.length) return;
    var caja = sec.querySelector(".tv");
    var RONDA = Math.min(10, banco.length), TIEMPO = 20;
    var preguntas, n, puntos, aciertos, racha, mejorRacha, reloj_, t0, respondida;

    function portada() {
      var mejor = parseInt(leer("recreo-trivia-mejor", "0"), 10) || 0;
      caja.innerHTML =
        '<div class="tv__portada"><p class="tv__grande">¿Cuánto sabés de la revista?</p>' +
        '<p class="tv__texto">' + RONDA + ' preguntas al azar sobre las notas de esta edición. Tenés ' + TIEMPO +
        ' segundos por pregunta: cuanto más rápido, más puntos. Las rachas suman extra.</p>' +
        (mejor ? '<p class="tv__mejor">Tu mejor puntaje: <b>' + mejor + '</b></p>' : '') +
        '<button type="button" class="tv__btn tv__btn--grande">Empezar</button></div>';
      caja.querySelector("button").addEventListener("click", empezar);
    }
    function empezar() {
      preguntas = mezclar(banco.slice()).slice(0, RONDA);
      n = 0; puntos = 0; aciertos = 0; racha = 0; mejorRacha = 0;
      mostrar();
    }
    function mostrar() {
      respondida = false;
      var q = preguntas[n];
      var orden = mezclar(q.o.map(function (_, k) { return k; }));
      caja.innerHTML =
        '<div class="tv__cab"><span class="tv__n">Pregunta ' + (n + 1) + ' de ' + RONDA + '</span>' +
        '<span class="tv__pts">' + puntos + ' pts' + (racha > 1 ? ' · racha x' + racha : '') + '</span></div>' +
        '<div class="tv__tiempo" aria-hidden="true"><span></span></div>' +
        '<p class="tv__p" tabindex="-1">' + q.p + '</p>' +
        '<div class="tv__ops">' + orden.map(function (k, i) {
          return '<button type="button" class="tv__op" data-k="' + k + '"><span class="tv__letra">' + "ABCD"[i] + '</span>' + q.o[k] + '</button>';
        }).join("") + '</div>' +
        '<div class="tv__fb" aria-live="polite"></div>';
      var barra = caja.querySelector(".tv__tiempo span");
      Array.prototype.forEach.call(caja.querySelectorAll(".tv__op"), function (b) {
        b.addEventListener("click", function () { responder(+b.dataset.k); });
      });
      caja.querySelector(".tv__p").focus({ preventScroll: true });
      t0 = Date.now();
      clearInterval(reloj_);
      reloj_ = setInterval(function () {
        var resta = Math.max(0, 1 - (Date.now() - t0) / (TIEMPO * 1000));
        barra.style.transform = "scaleX(" + resta + ")";
        barra.classList.toggle("es-poco", resta < .3);
        if (resta <= 0) responder(-1);
      }, 80);
    }
    function responder(k) {
      if (respondida) return;
      respondida = true;
      clearInterval(reloj_);
      var q = preguntas[n], ok = k === q.ok;
      var seg = (Date.now() - t0) / 1000;
      Array.prototype.forEach.call(caja.querySelectorAll(".tv__op"), function (b) {
        var bk = +b.dataset.k;
        b.disabled = true;
        if (bk === q.ok) b.classList.add("es-bien");
        else if (bk === k) b.classList.add("es-mal");
      });
      var gana = 0;
      if (ok) {
        racha++; mejorRacha = Math.max(mejorRacha, racha); aciertos++;
        gana = 100 + Math.round(Math.max(0, TIEMPO - seg) * 5) + (racha > 1 ? (racha - 1) * 20 : 0);
        puntos += gana; son.bien();
      } else { racha = 0; son.mal(); }
      var fb = caja.querySelector(".tv__fb");
      fb.innerHTML = '<p class="tv__veredicto ' + (ok ? "es-bien" : "es-mal") + '">' +
        (ok ? "¡Bien! +" + gana : k === -1 ? "¡Se acabó el tiempo!" : "No era esa.") + '</p>' +
        '<p class="tv__dato">' + q.dato + ' <a href="' + q.nota + '/index.html" target="_blank" rel="noopener">Leer «' + q.t + '»</a></p>' +
        '<button type="button" class="tv__btn">' + (n + 1 < RONDA ? "Siguiente" : "Ver resultado") + '</button>';
      var b = fb.querySelector(".tv__btn");
      b.addEventListener("click", function () { n++; if (n < RONDA) mostrar(); else final(); });
      b.focus({ preventScroll: true });
    }
    function final() {
      var mejor = parseInt(leer("recreo-trivia-mejor", "0"), 10) || 0;
      var nuevo = puntos > mejor;
      if (nuevo) guardar("recreo-trivia-mejor", puntos);
      var titulo = aciertos === RONDA ? "¡Perfecto! Te leíste toda la revista" :
        aciertos >= RONDA * .7 ? "¡Muy bien! Sos de leer cada nota" :
        aciertos >= RONDA * .4 ? "¡Nada mal! Hay notas por descubrir" : "¡A leer la revista y volvé a intentar!";
      caja.innerHTML =
        '<div class="tv__portada"><p class="tv__grande">' + titulo + '</p>' +
        '<p class="tv__resultado"><b>' + aciertos + '</b> de ' + RONDA + ' correctas · <b>' + puntos + '</b> puntos' +
        (mejorRacha > 1 ? ' · mejor racha x' + mejorRacha : '') + '</p>' +
        (nuevo ? '<p class="tv__mejor">¡Nuevo récord!</p>' : '<p class="tv__mejor">Tu mejor puntaje: <b>' + mejor + '</b></p>') +
        '<button type="button" class="tv__btn tv__btn--grande">Jugar otra ronda</button></div>';
      caja.querySelector("button").addEventListener("click", empezar);
      if (aciertos >= RONDA * .7) { son.fiesta(); confeti(sec); }
    }
    portada();
  })();

  /* ================= SOPA DE LETRAS ================= */
  (function sopa() {
    var sec = document.querySelector('[data-juego="sopa"]');
    if (!sec) return;
    var grilla = sec.querySelector(".sp__grilla"), lista = sec.querySelector(".sp__lista");
    var aviso = sec.querySelector(".sp__aviso");
    var oOk = sec.querySelector('[data-s="ok"]'), oTiempo = sec.querySelector('[data-s="tiempo"]');
    var PALABRAS = ["GUANACO", "CHOIQUE", "CALAFATE", "MESETA", "VIENTO", "COIRON", "NENEO", "CHIMANGO",
      "ESTEPA", "MARA", "CONDOR", "BARDA", "JARILLA", "PIEDRA", "LAGUNA", "OVEJA", "ZORRO", "PICHE", "TORDO", "MATE"];
    var N = 12, CANT = 8;
    var letras, palabras, encontradas, sel = null, inicio = 0, intervalo = null, celdas = [];
    var DIRS = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [1, -1]];
    var COLORES = ["#6d2ab0", "#0a6693", "#086f64", "#b01a5c", "#8a5c07", "#456f0d", "#1d5aa8", "#b3202f"];

    function armar() {
      clearInterval(intervalo); intervalo = null; inicio = 0;
      oTiempo.textContent = "0:00"; aviso.textContent = "";
      for (var intento = 0; intento < 30; intento++) { if (intentar()) break; }
      pintar();
    }
    function intentar() {
      letras = []; for (var f = 0; f < N; f++) { letras.push([]); for (var c = 0; c < N; c++) letras[f].push(""); }
      palabras = [];
      var pool = mezclar(PALABRAS.slice());
      for (var k = 0; k < pool.length && palabras.length < CANT; k++) {
        var w = pool[k], puesta = false;
        for (var t = 0; t < 120 && !puesta; t++) {
          var d = DIRS[Math.floor(Math.random() * DIRS.length)];
          var f0 = Math.floor(Math.random() * N), c0 = Math.floor(Math.random() * N);
          var f1 = f0 + d[0] * (w.length - 1), c1 = c0 + d[1] * (w.length - 1);
          if (f1 < 0 || f1 >= N || c1 < 0 || c1 >= N) continue;
          var ok = true;
          for (var i = 0; i < w.length; i++) { var l = letras[f0 + d[0] * i][c0 + d[1] * i]; if (l && l !== w[i]) { ok = false; break; } }
          if (!ok) continue;
          for (i = 0; i < w.length; i++) letras[f0 + d[0] * i][c0 + d[1] * i] = w[i];
          palabras.push({ w: w, f0: f0, c0: c0, f1: f1, c1: c1, ok: false });
          puesta = true;
        }
      }
      if (palabras.length < CANT) return false;
      var ABC = "ABCDEFGHIJLMNOPRSTUVZ";
      for (f = 0; f < N; f++) for (c = 0; c < N; c++) if (!letras[f][c]) letras[f][c] = ABC[Math.floor(Math.random() * ABC.length)];
      return true;
    }
    function pintar() {
      encontradas = 0; oOk.textContent = "0 / " + palabras.length;
      grilla.innerHTML = ""; celdas = [];
      grilla.style.setProperty("--n", N);
      for (var f = 0; f < N; f++) {
        var fila = document.createElement("div"); fila.setAttribute("role", "row"); fila.className = "sp__fila";
        celdas.push([]);
        for (var c = 0; c < N; c++) {
          var b = document.createElement("button");
          b.type = "button"; b.className = "sp__celda"; b.textContent = letras[f][c];
          b.dataset.f = f; b.dataset.c = c;
          b.setAttribute("role", "gridcell");
          b.setAttribute("aria-label", letras[f][c] + ", fila " + (f + 1) + ", columna " + (c + 1));
          fila.appendChild(b); celdas[f].push(b);
        }
        grilla.appendChild(fila);
      }
      lista.innerHTML = palabras.slice().sort(function (a, b) { return a.w < b.w ? -1 : 1; }).map(function (p) {
        return '<li data-w="' + p.w + '">' + p.w.charAt(0) + p.w.slice(1).toLowerCase() + '</li>';
      }).join("");
    }
    function celdaDe(e) {
      var el = document.elementFromPoint(e.clientX, e.clientY);
      return el && el.classList && el.classList.contains("sp__celda") ? el : null;
    }
    function linea(a, b) {
      var f0 = +a.dataset.f, c0 = +a.dataset.c, f1 = +b.dataset.f, c1 = +b.dataset.c;
      var df = f1 - f0, dc = c1 - c0;
      if (df !== 0 && dc !== 0 && Math.abs(df) !== Math.abs(dc)) return null;
      var largo = Math.max(Math.abs(df), Math.abs(dc));
      var sf = Math.sign(df), sc = Math.sign(dc), out = [];
      for (var i = 0; i <= largo; i++) out.push(celdas[f0 + sf * i][c0 + sc * i]);
      return out;
    }
    function marcar(desde, hasta) {
      grilla.querySelectorAll(".es-sel").forEach(function (x) { x.classList.remove("es-sel"); });
      var l = hasta ? linea(desde, hasta) : [desde];
      (l || [desde]).forEach(function (x) { x.classList.add("es-sel"); });
      return l;
    }
    function probar(l) {
      grilla.querySelectorAll(".es-sel").forEach(function (x) { x.classList.remove("es-sel"); });
      if (!l || l.length < 2) return false;
      var txt = l.map(function (x) { return x.textContent; }).join("");
      var inv = txt.split("").reverse().join("");
      var p = palabras.filter(function (q) { return !q.ok && (q.w === txt || q.w === inv); })[0];
      if (!p) { son.mal(); l.forEach(function (x) { x.classList.add("es-mal"); setTimeout(function () { x.classList.remove("es-mal"); }, 400); }); return false; }
      p.ok = true; encontradas++;
      var color = COLORES[(encontradas - 1) % COLORES.length];
      l.forEach(function (x, i) {
        x.classList.add("es-ok"); x.style.setProperty("--c", color); x.style.setProperty("--i", i);
      });
      var li = lista.querySelector('[data-w="' + p.w + '"]');
      if (li) { li.classList.add("es-ok"); li.style.setProperty("--c", color); }
      oOk.textContent = encontradas + " / " + palabras.length;
      son.bien();
      aviso.textContent = "¡Encontraste " + p.w.toLowerCase() + "!";
      if (encontradas === palabras.length) {
        clearInterval(intervalo);
        var seg = (Date.now() - inicio) / 1000;
        var mejor = parseFloat(leer("recreo-sopa-mejor", "0")) || 0;
        var nuevo = !mejor || seg < mejor;
        if (nuevo) guardar("recreo-sopa-mejor", Math.round(seg));
        aviso.textContent = (nuevo ? "¡Récord! " : "¡Completaste la sopa! ") + "Tardaste " + reloj(seg) +
          (!nuevo ? " (tu mejor: " + reloj(mejor) + ")" : "") + ".";
        son.fiesta(); confeti(sec);
      }
      return true;
    }
    function arrancarReloj() {
      if (inicio) return;
      inicio = Date.now();
      intervalo = setInterval(function () { oTiempo.textContent = reloj((Date.now() - inicio) / 1000); }, 500);
    }
    // Arrastrar de la primera a la última letra, o tocar una y después la otra.
    var arrastre = null, primera = null;
    grilla.addEventListener("pointerdown", function (e) {
      var c = celdaDe(e); if (!c) return;
      e.preventDefault();
      arrancarReloj();
      arrastre = { desde: c, movido: false };
      marcar(c);
      try { grilla.setPointerCapture(e.pointerId); } catch (err) {}
    });
    grilla.addEventListener("pointermove", function (e) {
      if (!arrastre) return;
      var c = celdaDe(e); if (!c) return;
      if (c !== arrastre.desde) arrastre.movido = true;
      marcar(arrastre.desde, c);
      arrastre.hasta = c;
    });
    grilla.addEventListener("pointerup", function (e) {
      if (!arrastre) return;
      var a = arrastre; arrastre = null;
      if (a.movido && a.hasta) { primera = null; probar(linea(a.desde, a.hasta)); return; }
      // toque sin arrastre: modo «una y después la otra»
      if (!primera) { primera = a.desde; marcar(primera); primera.classList.add("es-inicio"); return; }
      var l = linea(primera, a.desde);
      primera.classList.remove("es-inicio");
      primera = null;
      probar(l);
    });
    // Con teclado: Enter/Espacio en una letra y después en la otra.
    grilla.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var c = e.target.closest(".sp__celda"); if (!c) return;
      e.preventDefault(); arrancarReloj();
      if (!primera) { primera = c; marcar(c); c.classList.add("es-inicio"); return; }
      var l = linea(primera, c); primera.classList.remove("es-inicio"); primera = null; probar(l);
    });
    sec.querySelector(".sp__nueva").addEventListener("click", armar);
    armar();
  })();
})();
