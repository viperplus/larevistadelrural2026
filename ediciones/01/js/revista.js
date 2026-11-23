/* Visor de fotos: al clickear una imagen se abre en grande.
   Sin dependencias. Usa <dialog>, que ya trae Escape y foco atrapado. */
(function () {
  "use strict";
  if (typeof HTMLDialogElement === "undefined") return;

  var SEL = "figure.fig img, figure.collage__item img, figure.pres__foto img";
  var SEL_FIG = "figure.fig, figure.collage__item, figure.pres__foto";

  var dlg = document.createElement("dialog");
  dlg.className = "visor";
  dlg.setAttribute("aria-label", "Foto en grande");
  dlg.innerHTML =
    '<img class="visor__img" alt="">' +
    '<p class="visor__pie" hidden></p>' +
    '<button class="visor__btn visor__cerrar" type="button" aria-label="Cerrar">&#10005;</button>' +
    '<button class="visor__btn visor__ant" type="button" aria-label="Foto anterior" hidden>&#8249;</button>' +
    '<button class="visor__btn visor__sig" type="button" aria-label="Foto siguiente" hidden>&#8250;</button>';
  document.body.appendChild(dlg);

  var vImg = dlg.querySelector(".visor__img");
  var vPie = dlg.querySelector(".visor__pie");
  var vAnt = dlg.querySelector(".visor__ant");
  var vSig = dlg.querySelector(".visor__sig");
  var lista = [];
  var i = 0;

  function util(img) {
    // Un hueco del álbum (figurita todavía sin pegar) no se amplía.
    return img && !img.closest("a") && !img.closest(".album__ficha--vacia");
  }

  /* En el álbum sólo se mira el pliego que está abierto: las demás
     hojas están ocultas y pasar de foto tendría que saltar de página. */
  function a_la_vista(img) {
    var v = img.closest(".album__vista");
    if (!v) return true;
    if (v.classList.contains("saliendo")) return false;
    return v.classList.contains("es-actual");
  }

  function recuento(cont) {
    return Array.prototype.filter.call(cont.querySelectorAll(SEL), function (i) {
      return util(i) && a_la_vista(i);
    });
  }

  function pie(fig) {
    var fc = fig && fig.querySelector("figcaption");
    if (!fc) return "";
    var st = fc.querySelector("strong");
    var sp = fc.querySelector("span");
    if (st && sp) return st.textContent.trim() + " · " + sp.textContent.trim();
    return fc.textContent.replace(/\s+/g, " ").trim();
  }

  function pintar() {
    var o = lista[i];
    if (!o) return;
    vImg.src = o.currentSrc || o.src;
    vImg.alt = o.alt || "";
    var t = pie(o.closest("figure"));
    vPie.textContent = t;
    vPie.hidden = !t;
    vAnt.hidden = vSig.hidden = lista.length < 2;
  }

  function abrir(n) {
    if (n < 0 || n >= lista.length) return;
    i = n;
    pintar();
    if (!dlg.open) {
      dlg.showModal();
      document.documentElement.classList.add("visor-on");
    }
  }

  function paso(d) {
    if (lista.length) abrir((i + d + lista.length) % lista.length);
  }

  function abrirDesde(img) {
    if (!util(img)) return false;
    var cont = img.closest(".articulo__cuerpo, .collage") || img.closest("figure").parentNode;
    if (!cont) return false;
    lista = recuento(cont);
    var n = lista.indexOf(img);
    if (n < 0) return false;
    abrir(n);
    return true;
  }

  document.addEventListener("click", function (e) {
    if (!e.target.closest) return;
    var o = e.target.closest(SEL);
    if (!o) {
      // El pie de la ficha también abre el visor: el cursor ya avisa que sí.
      var fig = e.target.closest(SEL_FIG);
      if (fig) o = fig.querySelector("img");
    }
    if (abrirDesde(o)) e.preventDefault();
  });

  /* El visor también se abre con teclado: las fotos son botones de facto. */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
    if (!e.target.matches || !e.target.matches(SEL)) return;
    if (abrirDesde(e.target)) e.preventDefault();
  });

  function marcarFocables() {
    Array.prototype.forEach.call(document.querySelectorAll(SEL), function (img) {
      if (!util(img) || img.hasAttribute("tabindex")) return;
      img.setAttribute("tabindex", "0");
      img.setAttribute("role", "button");
      img.setAttribute("aria-label", "Ampliar foto: " + (img.alt || "imagen"));
    });
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", marcarFocables);
  else marcarFocables();

  dlg.querySelector(".visor__cerrar").addEventListener("click", function () {
    dlg.close();
  });
  vAnt.addEventListener("click", function () { paso(-1); });
  vSig.addEventListener("click", function () { paso(1); });

  dlg.addEventListener("click", function (e) {
    if (e.target === dlg) dlg.close();
  });

  dlg.addEventListener("close", function () {
    document.documentElement.classList.remove("visor-on");
    vImg.removeAttribute("src");
  });

  document.addEventListener("keydown", function (e) {
    if (!dlg.open) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); paso(-1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); paso(1); }
  });

  /* ------------------------------------------------------------------
     Álbum de figuritas: páginas que se pasan con los botones, el
     deslizador, las flechas del teclado o un gesto horizontal.
     ------------------------------------------------------------------ */
  /* ------------------------------------------------------------------
     Álbum de figuritas: pliegos de dos hojas que se pasan como en un
     libro. La hoja derecha gira sobre el lomo y en su dorso viaja la
     página que viene; la izquierda gira al revés. En pantallas angostas
     se ve una hoja por vez, con el mismo gesto sin el giro completo.
     ------------------------------------------------------------------ */
  (function album() {
    var alb = document.querySelector(".album");
    if (!alb) return;
    var pant = alb.querySelector(".album__pantalla");
    var pags = Array.prototype.slice.call(alb.querySelectorAll(".album__pagina"));
    if (!pant || !pags.length) return;

    var ant = alb.querySelector('.album__btn[data-paso="-1"]');
    var sig = alb.querySelector('.album__btn[data-paso="1"]');
    var nom = alb.querySelector(".album__estado-t");
    var num = alb.querySelector(".album__estado-n");
    var punto = alb.querySelector(".album__punto");
    var rango = alb.querySelector(".album__rango");
    var ir = alb.querySelector(".album__ir");
    var progN = alb.querySelector(".album__progreso-n");
    var progI = alb.querySelector(".album__progreso-i");

    var GIRO = 820;
    var vistas = [];     // { v, paginas, hojas }
    var vistaDe = [];    // número de página -> número de vista
    var primera = {};    // sede -> número de su primera página
    var fichasPag = [];  // figuritas que trae cada página
    var totalFichas = 0;
    var vistasPag = {};  // páginas que ya se miraron: el álbum se va llenando
    var doble = true;
    var anima = false;
    var i = 0;
    var reloj = null;
    var espera = null;
    var guardaReloj = null;

    try {
      vistasPag = JSON.parse(window.localStorage.getItem("album-vistas") || "{}") || {};
    } catch (e) { vistasPag = {}; }

    function malla(q) {
      return !!(window.matchMedia && window.matchMedia(q).matches);
    }

    pags.forEach(function (p, n) {
      if (p.dataset.sede && !(p.dataset.sede in primera)) primera[p.dataset.sede] = n;
    });

    function hoja(lado) {
      var h = document.createElement("div");
      h.className = "album__hoja album__hoja--" + lado;
      var f = document.createElement("div");
      f.className = "album__cara album__cara--frente";
      var a = document.createElement("div");
      a.className = "album__cara album__cara--atras";
      h.appendChild(f);
      h.appendChild(a);
      return h;
    }

    /* La guarda de la tapa (el reverso de la portada) explica cómo se usa
       el álbum; las demás son papel con la marca. */
    function guarda(instrucciones) {
      var g = document.createElement("div");
      g.className = "album__guarda";
      if (!instrucciones) {
        g.setAttribute("aria-hidden", "true");
        g.innerHTML = '<span class="album__guarda-s">La Revista<br>del Rural</span>';
        return g;
      }
      g.classList.add("album__guarda--uso");
      g.innerHTML =
        '<div class="album__uso">' +
        '<p class="album__uso-t">Cómo se juega</p>' +
        '<ol class="album__uso-l">' +
        '<li><b>Abrí un sobre:</b> trae 5 figuritas al azar.</li>' +
        '<li><b>Pegalas:</b> las nuevas van solas a su lugar; las repetidas se cuentan aparte.</li>' +
        '<li><b>Pasá las páginas</b> con las flechas o deslizando la hoja, y tocá una figurita para verla en grande.</li>' +
        '<li><b>¿No querés esperar?</b> «Ver todas» muestra el álbum completo.</li>' +
        '</ol></div>';
      return g;
    }

    /* Junta las páginas en pliegos. Con doble página la portada y el
       índice van solos del lado derecho, sobre una guarda, y el resto
       se agrupa de a dos: así el dorso de cada hoja es justamente la
       página siguiente, igual que en un libro encuadernado. A partir de
       46rem de ancho; debajo se ve una hoja por vez, pero la hoja gira
       igual que en un libro. */
    function armar() {
      finalizar(false);
      doble = !window.matchMedia || malla("(min-width: 46rem)");

      pags.forEach(function (p) { pant.appendChild(p); });
      Array.prototype.slice.call(pant.querySelectorAll(".album__vista"))
        .forEach(function (v) { pant.removeChild(v); });

      var plan = [], lados, n;
      if (doble) {
        plan.push([null, pags[0]]);
        if (pags[1]) plan.push([null, pags[1]]);
        for (n = pags[1] ? 2 : 1; n < pags.length; n += 2) {
          plan.push([pags[n], pags[n + 1] || null]);
        }
        lados = ["izq", "der"];
      } else {
        for (n = 0; n < pags.length; n++) plan.push([pags[n]]);
        lados = ["der"];
      }

      var frag = document.createDocumentFragment();
      vistas = [];
      vistaDe = [];
      plan.forEach(function (par, v) {
        var vista = document.createElement("div");
        vista.className = "album__vista";
        vista.setAttribute("data-v", v);
        if (!doble) vista.setAttribute("data-simple", "");
        var hs = [];
        lados.forEach(function (lado, li) {
          var h = hoja(lado);
          h.firstChild.appendChild(par[li] || guarda(v === 0));
          vista.appendChild(h);
          hs.push(h);
        });
        par.forEach(function (p) {
          if (p) vistaDe[pags.indexOf(p)] = v;
        });
        frag.appendChild(vista);
        vistas.push({ v: vista, paginas: par, hojas: hs });
      });
      pant.appendChild(frag);

      fichasPag = pags.map(function (p) {
        return p.querySelectorAll(".album__ficha").length;
      });
      totalFichas = fichasPag.reduce(function (a, b) { return a + b; }, 0);
    }

    /* El álbum se va completando a medida que se miran las páginas.
       Las que ya se vieron quedan guardadas, así que al volver se
       sigue de donde estaba. */
    function pintarProgreso() {
      if (!progN || !progI) return;
      /* Cuenta las figuritas pegadas (el juego de sobres, más abajo). */
      var vistas_ = juego.cuantas();
      progN.textContent = vistas_ + " / " + totalFichas;
      var pct = totalFichas ? Math.round(vistas_ / totalFichas * 100) : 0;
      progI.style.width = pct + "%";
      if (pct > 0) progI.setAttribute("data-lleno", "1");
      else progI.removeAttribute("data-lleno");
    }

    function marcarVista(v) {
      if (!v) return;
      var cambia = false;
      v.paginas.forEach(function (p) {
        if (!p) return;
        var clave = p.dataset.pag;
        var n = parseInt(clave, 10);
        if (!fichasPag[n]) return;
        if (!vistasPag[clave]) { vistasPag[clave] = 1; cambia = true; }
      });
      if (!cambia) return;
      pintarProgreso();
      if (guardaReloj) clearTimeout(guardaReloj);
      guardaReloj = setTimeout(function () {
        guardaReloj = null;
        try {
          window.localStorage.setItem("album-vistas", JSON.stringify(vistasPag));
        } catch (e) {}
      }, 400);
    }

    function titulo(v) {
      var ts = [];
      v.paginas.forEach(function (p) {
        if (!p) return;
        var t;
        if (p.classList.contains("album__pagina--portada")) t = "Portada";
        else if (p.classList.contains("album__pagina--indice")) t = "Índice";
        else if (p.classList.contains("album__pagina--fin")) t = "Fin del álbum";
        else {
          var h = p.querySelector(".album__cab-t");
          t = h ? h.textContent.replace(/\s+/g, " ").trim() : "";
        }
        if (t && ts.indexOf(t) < 0) ts.push(t);
      });
      return ts.join(" · ");
    }

    /* Las páginas están ocultas hasta que se abren, así que el navegador
       no bajaba las fotos y al pasar de hoja aparecían en vacío. Se marcan
       como urgentes las del pliego actual y de los dos vecinos: con eso
       alcanza para que el giro no se vea pelado. */
    function alistar(n) {
      if (n < 0 || n >= vistas.length) return;
      var imgs = vistas[n].v.querySelectorAll('img[loading="lazy"]');
      for (var k = 0; k < imgs.length; k++) imgs[k].setAttribute("loading", "eager");
    }

    /* Las figuritas miden todas igual (las postales del lugar ocupan el
       lugar de dos, pero miden lo mismo de alto), y el alto que hay para
       dos filas depende de la pantalla y del encabezado de la sede. En vez
       de dejar un hueco abajo, se mide lo que hay y se calcula el ancho
       de la ficha que llena justamente esas dos filas; si por ancho no
       se puede llenar entero, se acorta el pliego hasta que sobre
       exactamente lo mismo de un lado que del otro. El alto de la foto
       sale de su proporción, así que ninguna se deforma. */
    var figLista = false;
    function ajustarFig(forzar) {
      if (!alb) return;
      /* Un resize fuerza la medición: aunque la vista actual no tenga
         grilla (portada, índice o cierre) hay que soltar la marca, para
         que la próxima hoja con figuritas vuelva a medir. */
      if (forzar) figLista = false;
      else if (figLista) return;
      var v = vistas[mostrada];
      if (!v) return;
      var pag = null;
      for (var j = 0; j < v.paginas.length && !pag; j++) {
        if (v.paginas[j] && v.paginas[j].querySelector(".album__grilla")) pag = v.paginas[j];
      }
      if (!pag) return;
      var grilla = pag.querySelector(".album__grilla");
      /* Se mide una figurita común: la postal es el doble de ancha y
         tiraría el cálculo. Siempre hay alguna en la primera hoja. */
      var card = grilla && (grilla.querySelector(".album__ficha:not(.album__ficha--doble)")
                            || grilla.querySelector(".album__ficha"));
      var img = card && card.querySelector("img");
      if (!img || !img.offsetWidth || !img.offsetHeight) return;

      /* Se mide contra el alto que manda el CSS, no contra el que ya se
         ajustó: si no, cada medición achicaría el pliego un poco más. */
      alb.style.removeProperty("--alto");
      void pant.offsetHeight;

      var cs = getComputedStyle(pag);
      var cromo = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      var cab = pag.querySelector(".album__cab");
      if (cab && cab.offsetHeight) {
        cromo += cab.offsetHeight + (parseFloat(getComputedStyle(cab).marginBottom) || 0);
      }
      var pie = pag.querySelector(".album__pie");
      if (pie && pie.offsetHeight) {
        cromo += pie.offsetHeight + (parseFloat(getComputedStyle(pie).marginTop) || 0);
      }
      var alto = pag.clientHeight - cromo;

      var gs = getComputedStyle(grilla);
      /* La grilla tiene dos subcolumnas por figurita (cuatro por postal). */
      var sub = (gs.gridTemplateColumns || "").trim().split(/\s+/).length;
      var col = Math.round(sub / 2);
      if (col < 1) return;
      var dobles = grilla.querySelectorAll(".album__ficha--doble").length;
      var casillas = grilla.children.length + dobles;
      var filas = Math.max(1, Math.ceil(casillas / col));
      var ritmoF = parseFloat(gs.rowGap) || 0;
      var altFicha = (alto - ritmoF * (filas - 1)) / filas;

      /* De la ficha ya dibujada se saca todo lo que no es la foto
         (borde, relleno y pie) y la proporción real de la imagen. */
      var ratio = img.offsetHeight / img.offsetWidth;
      var resto = card.offsetHeight - img.offsetHeight;
      var lado = card.offsetWidth - img.offsetWidth;
      var fig = (altFicha - resto) / ratio + lado;

      var ancho = pag.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      var tope = (ancho - (parseFloat(gs.columnGap) || 0) * (col - 1)) / col;
      /* En celular (una hoja por vez) manda el ancho: con el alto de la
         pantalla las tres filas quedaban en figuritas de 70 px. La hoja
         se alarga y se recorre bajando, como cualquier página. */
      if (tope > 0) fig = doble ? Math.min(fig, tope) : tope;
      if (!isFinite(fig) || fig < 24) return;

      var altReal = (fig - lado) * ratio + resto;
      var altoNecesario = altReal * filas + ritmoF * (filas - 1) + cromo;
      alb.style.setProperty("--fig", fig.toFixed(1) + "px");
      alb.style.setProperty("--alto", Math.max(altoNecesario, 352).toFixed(1) + "px");
      figLista = true;
    }

    function pintarBarra() {
      var v = vistas[i];
      if (!v) return;
      if (nom) nom.textContent = titulo(v);
      if (num) num.textContent = (i + 1) + " / " + vistas.length;
      if (ant) ant.disabled = i === 0;
      if (sig) sig.disabled = i >= vistas.length - 1;
      if (rango) {
        if (String(i + 1) !== rango.value) rango.value = i + 1;
        rango.setAttribute("aria-valuetext",
          titulo(v) + ", página " + (i + 1) + " de " + vistas.length);
      }
      if (punto) {
        var c = "";
        v.paginas.forEach(function (p) {
          if (c || !p || !p.style || !p.style.getPropertyValue) return;
          c = p.style.getPropertyValue("--sede");
        });
        // Si el pliego no tiene color (portada, índice, cierre) se saca la
        // propiedad: dejarla vacía anularía el color de relleno del CSS.
        if (c) punto.style.setProperty("--sede", c);
        else punto.style.removeProperty("--sede");
      }
      if (ir) {
        var propio = "";
        // En pliego doble manda la cara derecha: es la hoja recién abierta.
        // La cara izquierda puede ser la última página de la sede anterior.
        v.paginas.forEach(function (p, k) {
          if (!p || !p.dataset || !p.dataset.sede) return;
          if (!propio || (doble && k === 1)) propio = p.dataset.sede;
        });
        ir.value = propio && primera[propio] != null ? String(primera[propio]) : "";
      }
    }

    /* Marca la vista que se está mirando. La que viene puede estar
       asomando debajo mientras la hoja gira, pero eso lo maneja
       abrirGiro: acá sólo se limpia. */
    function pintar() {
      if (!vistas.length) return;
      if (!vistas[mostrada]) mostrada = 0;
      alistar(mostrada - 1);
      alistar(mostrada);
      alistar(mostrada + 1);
      vistas.forEach(function (x, n) {
        var ves = n === mostrada;
        x.v.classList.toggle("es-actual", ves);
        x.v.classList.remove("es-debajo");
        // Las hojas ocultas no deben recibir el foco (índice, cierre,
        // figuritas de otros pliegos). inert es gradual: si el navegador
        // no lo soporta, aria-hidden sigue haciendo su parte.
        x.v.inert = !ves;
        x.v.setAttribute("aria-hidden", ves ? "false" : "true");
      });
      pintarBarra();
      marcarVista(vistas[mostrada]);
      ajustarFig();
    }

    /* ---- pasaje de hojas ------------------------------------------------
       La hoja gira alrededor del lomo, con el mouse o el dedo si se la
       agarra y se la arrastra. El dorso de la hoja que gira lleva la
       página que viene y, debajo, ya asoma el resto del pliego que viene:
       al levantar la página se descubre lo que hay atrás, como en un
       libro de verdad. La vista no cambia hasta que la hoja terminó. */
    var giros = { dir: null, n: -1, hoja: null, origen: null, hijo: null,
                  bajo: -1, ang: 0, p: 0, anim: null };
    var mostrada = 0;      // vista que se está mirando
    var trago = false;     // hubo un arrastre: el clic que sigue no cuenta

    function abrirGiro(n, dir) {
      if (n < 0 || n >= vistas.length) return false;
      var v = vistas[mostrada], w = vistas[n];
      var ladoGira = doble ? (dir === "adelante" ? 1 : 0) : 0;
      var ladoViaje = doble ? (dir === "adelante" ? 0 : 1) : 0;
      var hoja = v.hojas[ladoGira];
      var dorso = hoja.querySelector(".album__cara--atras");
      var frente = w.hojas[ladoViaje].querySelector(".album__cara--frente");
      if (!hoja || !dorso || !frente || !frente.firstElementChild) return false;
      /* En doble página lo que se descubre es el pliego que viene, con
         la hoja que viaja ya vacía. En hoja sola viaja la página entera,
         así que debajo queda la que sigue a la del dorso. */
      var bajo = doble ? n : n + (dir === "adelante" ? 1 : -1);
      if (bajo < 0 || bajo >= vistas.length) bajo = -1;
      giros = {
        dir: dir, n: n, hoja: hoja, origen: dorso, hijo: frente,
        bajo: bajo, ang: 0, p: 0, anim: null
      };
      dorso.appendChild(frente.firstElementChild);
      hoja.style.transformOrigin = dir === "adelante" ? "left center" : "right center";
      hoja.classList.add("girando");
      if (bajo >= 0) {
        alistar(bajo);
        vistas[bajo].v.classList.add("es-debajo");
      }
      return true;
    }

    /* La hoja no gira rígida: se dobla un toque al medio del recorrido,
       como una hoja de papel que alguien levanta de la esquina. El
       doblez va y viene solo, así que en los extremos queda plana. */
    function transformar(grados) {
      var doblez = Math.sin(grados * Math.PI / 180);
      var lado = grados < 0 ? -1 : 1;
      return "rotateY(" + grados + "deg)"
        + " skewY(" + (lado * doblez * 2.4).toFixed(2) + "deg)"
        + " rotateX(" + (doblez * 2.1).toFixed(2) + "deg)";
    }

    function ponerAngulo(grados, ms) {
      var g = giros;
      if (!g.hoja) return;
      var de = g.ang;
      g.ang = grados;
      // La luz y la sombra de la hoja siguen el doblez (0 en los extremos,
      // 1 justo al medio): el CSS lee --giro.
      g.hoja.style.setProperty(
        "--giro", Math.abs(Math.sin(grados * Math.PI / 180)).toFixed(3));
      if (g.anim) { try { g.anim.cancel(); } catch (e) {} g.anim = null; }
      if (!ms || !g.hoja.animate) {
        g.hoja.style.transform = transformar(grados);
        return null;
      }
      // Tres tiempos para que el doblez aparezca y se aplane adentro
      // del movimiento: si fuera de a dos la hoja se iría torcida.
      var anim = g.hoja.animate(
        [{ transform: transformar(de) },
         { transform: transformar((de + grados) / 2), offset: 0.5 },
         { transform: transformar(grados) }],
        { duration: ms, easing: "cubic-bezier(.32,.72,.3,1)", fill: "forwards" });
      g.anim = anim;
      return anim;
    }

    /* Devuelve la página que prestó, saca las marcas de giro y, si
       cerró, recién ahí se pasa a la vista que viene. Se llama también
       si se salta de página a mitad de un giro: ahí no se avanza. */
    function finalizar(cerrar) {
      if (reloj) { clearTimeout(reloj); reloj = null; }
      var g = giros;
      giros = { dir: null, n: -1, hoja: null, origen: null, hijo: null,
                bajo: -1, ang: 0, p: 0, anim: null };
      if (g.anim) { try { g.anim.cancel(); } catch (e) {} }
      if (g.hoja) {
        g.hoja.style.transform = "";
        g.hoja.style.transformOrigin = "";
        g.hoja.style.removeProperty("--giro");
        g.hoja.classList.remove("girando");
      }
      if (g.origen && g.origen.firstElementChild) {
        g.hijo.appendChild(g.origen.firstElementChild);
      }
      if (g.bajo >= 0 && vistas[g.bajo]) vistas[g.bajo].v.classList.remove("es-debajo");
      if (cerrar && g.n >= 0) { mostrada = g.n; i = g.n; }
      if (vistas.length) pintar();
    }

    function irA(n, dir) {
      n = Math.max(0, Math.min(vistas.length - 1, n));
      finalizar(false);
      if (n === i) return;
      dir = dir || (n > i ? "adelante" : "atras");
      alb.dataset.dir = dir;
      i = n;
      pintarBarra();
      if (!anima || !abrirGiro(n, dir)) { mostrada = i; pintar(); return; }
      ponerAngulo(dir === "adelante" ? -180 : 180, GIRO);
      var fin = function () { finalizar(true); };
      if (giros.anim) giros.anim.onfinish = fin;
      reloj = setTimeout(fin, GIRO + 160);
    }

    /* Arrastre: se agarra la hoja y se la lleva con el mouse o el dedo.
       Si llega más de la mitad del camino, la hoja termina de pasar;
       si no, vuelve para atrás. */
    var arr = null;
    function anchoPliego() {
      return (pant.getBoundingClientRect().width || 640);
    }
    pant.addEventListener("pointerdown", function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target.closest && e.target.closest("button, a, select, input, .fig")) return;
      if (giros.hoja) return;
      arr = { id: e.pointerId, x0: e.clientX, y0: e.clientY, activo: false, dir: null };
    });
    pant.addEventListener("pointermove", function (e) {
      if (!arr || e.pointerId !== arr.id) return;
      var dx = e.clientX - arr.x0, dy = e.clientY - arr.y0;
      if (!arr.activo) {
        if (Math.abs(dx) < 14 || Math.abs(dx) < Math.abs(dy)) return;
        var dir = dx < 0 ? "adelante" : "atras";
        var hacia = mostrada + (dir === "adelante" ? 1 : -1);
        if (!abrirGiro(hacia, dir)) { arr = null; return; }
        arr.activo = true;
        arr.dir = dir;
        if (pant.setPointerCapture) {
          try { pant.setPointerCapture(e.pointerId); } catch (err) {}
        }
      }
      var p = Math.min(1, Math.abs(dx) / (anchoPliego() * (doble ? .42 : .55)));
      giros.p = p;
      ponerAngulo((arr.dir === "adelante" ? -180 : 180) * p, 0);
      if (e.cancelable) e.preventDefault();
    });
    function soltar(e) {
      if (!arr || (e && e.pointerId !== arr.id)) return;
      var a = arr; arr = null;
      if (!a.activo) return;
      /* El clic que cierra el arrastre no debe abrir el visor: se lo
         traga un instante, nada más. */
      trago = true;
      setTimeout(function () { trago = false; }, 260);
      var p = giros.p || 0;
      var pasar = p > .45;
      var ms = Math.max(200, Math.round(GIRO * (pasar ? 1 - p : .35 + p)));
      ponerAngulo(pasar ? (a.dir === "adelante" ? -180 : 180) : 0, ms);
      var fin = function () { finalizar(pasar); };
      if (giros.anim) giros.anim.onfinish = fin;
      reloj = setTimeout(fin, ms + 160);
    }
    pant.addEventListener("pointerup", soltar);
    pant.addEventListener("pointercancel", soltar);
    /* El clic que cierra un arrastre no debe abrir el visor de fotos. */
    pant.addEventListener("click", function (e) {
      if (!trago) return;
      trago = false;
      e.stopPropagation();
      e.preventDefault();
    }, true);

    Array.prototype.forEach.call(alb.querySelectorAll("[data-paso]"), function (b) {
      b.addEventListener("click", function () {
        irA(i + parseInt(b.dataset.paso, 10));
      });
    });
    alb.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("[data-ir]") : null;
      if (!b || !alb.contains(b)) return;
      e.preventDefault();
      var pag = parseInt(b.getAttribute("data-ir"), 10) || 0;
      irA(vistaDe[pag] != null ? vistaDe[pag] : 0);
    });
    if (rango) rango.addEventListener("input", function () {
      irA(parseInt(rango.value, 10) - 1);
    });
    if (ir) ir.addEventListener("change", function () {
      if (!ir.value) return;
      var pag = parseInt(ir.value, 10);
      if (vistaDe[pag] != null) irA(vistaDe[pag]);
    });

    document.addEventListener("keydown", function (e) {
      if (dlg.open || document.querySelector("dialog.sobre[open]")) return;
      var t = e.target;
      if (t && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(t.tagName)) return;
      if (e.key === "ArrowRight") { e.preventDefault(); irA(i + 1, "adelante"); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); irA(i - 1, "atras"); }
      else if (e.key === "Home") { e.preventDefault(); irA(0, "atras"); }
      else if (e.key === "End") { e.preventDefault(); irA(vistas.length - 1, "adelante"); }
    });

    /* Al cambiar de ancho se vuelve a armar: el mismo álbum, pero con
       una o dos hojas por pliego. Se conserva la página que se miraba. */
    window.addEventListener("resize", function () {
      if (espera) clearTimeout(espera);
      espera = setTimeout(function () {
        espera = null;
        var quiere = !window.matchMedia || malla("(min-width: 46rem)");
        if (quiere !== doble) {
          var abierta = vistas[mostrada].paginas.filter(Boolean)[0] || pags[0];
          var cual = pags.indexOf(abierta);
          armar();
          i = vistaDe[cual] != null ? vistaDe[cual] : 0;
          mostrada = i;
          pintar();
        }
        ajustarFig(true);
      }, 240);
    });

    /* ---- juego de sobres ------------------------------------------------
       Como un álbum de verdad: arranca con los huecos numerados y se llena
       abriendo sobres de 5 figuritas. Las nuevas se pegan solas en su
       lugar (con la página que se pasa y la figurita que cae), las
       repetidas se cuentan aparte. «Ver todas» muestra el álbum completo
       para quien sólo quiere buscar a alguien. Todo queda guardado en el
       navegador de quien lo mira. */
    var juego = (function () {
      var K_PEG = "album-pegadas", K_MODO = "album-modo", K_EST = "album-stats";
      var POR_SOBRE = 5;
      var fichas = Array.prototype.slice.call(alb.querySelectorAll(".album__ficha[data-n]"));
      var porN = {}, nums = [];
      fichas.forEach(function (f) {
        var n = f.getAttribute("data-n");
        if (porN[n]) return;
        porN[n] = f;
        nums.push(n);
        var pag = f.closest(".album__pagina");
        f._pag = pags.indexOf(pag);
        f._sede = pag && pag.dataset.sede;
        var fc = f.querySelector("figcaption");
        var h = document.createElement("span");
        h.className = "album__hueco";
        h.setAttribute("aria-hidden", "true");
        h.innerHTML = "<b>" + n + "</b><span>" +
          (f.classList.contains("album__ficha--doble") ? "Postal" : "Figurita") + "</span>";
        f.insertBefore(h, f.firstChild);
        f._nombre = fc ? fc.textContent.replace(/\s+/g, " ").trim() : "";
      });
      // Sello de sede completa, uno por página de sede.
      pags.forEach(function (p) {
        if (!p.dataset.sede) return;
        var s = document.createElement("span");
        s.className = "album__sello";
        s.setAttribute("aria-hidden", "true");
        s.textContent = "¡Completa!";
        p.appendChild(s);
      });

      function leer(k, def) {
        try { var v = JSON.parse(window.localStorage.getItem(k)); return v == null ? def : v; }
        catch (e) { return def; }
      }
      function escribir(k, v) {
        try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
      }
      var peg = {};
      (leer(K_PEG, []) || []).forEach(function (n) { if (porN[n]) peg[n] = 1; });
      var modo = leer(K_MODO, "coleccion") === "todas" ? "todas" : "coleccion";
      var est = leer(K_EST, { sobres: 0, repetidas: 0 }) || { sobres: 0, repetidas: 0 };

      function cuantas() {
        return nums.reduce(function (a, n) { return a + (peg[n] ? 1 : 0); }, 0);
      }
      function sedeCompleta(sede) {
        return fichas.every(function (f) { return f._sede !== sede || peg[f.getAttribute("data-n")]; });
      }

      /* ---- barra del juego ---- */
      var barra = document.createElement("div");
      barra.className = "album__juego";
      barra.innerHTML =
        '<button type="button" class="album__sobre-btn"><span class="album__sobre-ico" aria-hidden="true"></span>Abrir un sobre</button>' +
        '<p class="album__juego-dato"><span>Sobres <b data-j="sobres">0</b></span>' +
        '<span>Repetidas <b data-j="rep">0</b></span></p>' +
        '<span class="album__juego-sep" aria-hidden="true"></span>' +
        '<button type="button" class="album__modo" aria-pressed="false">Ver todas</button>' +
        '<button type="button" class="album__reset">Empezar de nuevo</button>' +
        '<p class="album__juego-aviso" aria-live="polite"></p>';
      pant.parentNode.insertBefore(barra, pant);
      var bSobre = barra.querySelector(".album__sobre-btn");
      var bModo = barra.querySelector(".album__modo");
      var bReset = barra.querySelector(".album__reset");
      var aviso = barra.querySelector(".album__juego-aviso");
      var avisoReloj = null;
      function avisar(t) {
        aviso.textContent = t;
        aviso.classList.add("es-visible");
        if (avisoReloj) clearTimeout(avisoReloj);
        avisoReloj = setTimeout(function () { aviso.classList.remove("es-visible"); }, 4200);
      }
      var tPeg = alb.querySelector(".album__progreso-t");
      if (tPeg) tPeg.textContent = "Figuritas pegadas";

      function aplicar() {
        var col = modo === "coleccion";
        alb.classList.toggle("album--coleccion", col);
        fichas.forEach(function (f) {
          var vacia = col && !peg[f.getAttribute("data-n")];
          f.classList.toggle("album__ficha--vacia", vacia);
          var img = f.querySelector("img");
          if (img) {
            if (vacia) { img.setAttribute("aria-hidden", "true"); img.setAttribute("tabindex", "-1"); }
            else { img.removeAttribute("aria-hidden"); if (img.getAttribute("role") === "button") img.setAttribute("tabindex", "0"); }
          }
          f.title = vacia ? "Te falta la N.º " + f.getAttribute("data-n") : "";
        });
        pags.forEach(function (p) {
          if (!p.dataset.sede) return;
          p.classList.toggle("album__pagina--completa", col && sedeCompleta(p.dataset.sede));
        });
        bModo.textContent = col ? "Ver todas" : "Volver a mi colección";
        bModo.setAttribute("aria-pressed", col ? "false" : "true");
        bSobre.disabled = !col;
        bReset.hidden = !col;
        barra.querySelector('[data-j="sobres"]').textContent = est.sobres;
        barra.querySelector('[data-j="rep"]').textContent = est.repetidas;
        pintarProgreso();
      }

      bModo.addEventListener("click", function () {
        modo = modo === "coleccion" ? "todas" : "coleccion";
        escribir(K_MODO, modo);
        aplicar();
        avisar(modo === "todas" ? "Mostrando las " + nums.length + " figuritas." :
          "Volviste a tu colección: " + cuantas() + " de " + nums.length + " pegadas.");
      });
      bReset.addEventListener("click", function () {
        if (!window.confirm("¿Empezar el álbum de cero? Se despegan todas las figuritas.")) return;
        peg = {}; est = { sobres: 0, repetidas: 0 };
        escribir(K_PEG, []); escribir(K_EST, est);
        aplicar();
        irA(0, "atras");
        avisar("Álbum vacío. ¡A abrir sobres!");
      });

      /* Tocar un hueco: tiembla y avisa qué número falta. */
      alb.addEventListener("click", function (e) {
        var f = e.target.closest ? e.target.closest(".album__ficha--vacia") : null;
        if (!f || trago) return;
        f.classList.remove("album__ficha--falta");
        void f.offsetWidth;
        f.classList.add("album__ficha--falta");
        avisar("Te falta la N.º " + f.getAttribute("data-n") +
          (f._nombre ? " (" + f._nombre + ")" : "") + ". Abrí un sobre para conseguirla.");
      });

      /* ---- el sobre ---- */
      var sob = document.createElement("dialog");
      sob.className = "sobre";
      sob.setAttribute("aria-label", "Sobre de figuritas");
      sob.innerHTML =
        '<button type="button" class="sobre__cerrar" aria-label="Cerrar">&#10005;</button>' +
        '<div class="sobre__escena">' +
        '<button type="button" class="sobre__paquete" aria-label="Abrir el sobre">' +
        '<span class="sobre__tira" aria-hidden="true"></span>' +
        '<span class="sobre__cuerpo" aria-hidden="true">' +
        '<span class="sobre__marca">La Revista del Rural</span>' +
        '<span class="sobre__balon"></span>' +
        '<span class="sobre__t">Figuritas</span>' +
        '<span class="sobre__ed">Edición 2026</span>' +
        '<span class="sobre__trae">Trae ' + POR_SOBRE + ' figuritas</span>' +
        '</span></button>' +
        '<div class="sobre__cartas" aria-live="polite"></div>' +
        '</div>' +
        '<p class="sobre__msg">Tocá el sobre para abrirlo</p>' +
        '<div class="sobre__acciones" hidden>' +
        '<button type="button" class="sobre__pegar">Pegar en el álbum</button>' +
        '<button type="button" class="sobre__otro">Abrir otro</button>' +
        '</div>' +
        '<div class="sobre__confeti" aria-hidden="true"></div>';
      alb.appendChild(sob);
      var paquete = sob.querySelector(".sobre__paquete");
      var cartas = sob.querySelector(".sobre__cartas");
      var msg = sob.querySelector(".sobre__msg");
      var acciones = sob.querySelector(".sobre__acciones");
      var confe = sob.querySelector(".sobre__confeti");
      var actual = null;   // { nums, nuevas, abierto, pegado }
      var relojes = [];
      function luego(fn, ms) { relojes.push(setTimeout(fn, anima ? ms : 0)); }
      function limpiarRelojes() { relojes.forEach(clearTimeout); relojes = []; }

      function sortear() {
        var faltan = nums.filter(function (n) { return !peg[n]; });
        var sale = [];
        for (var k = 0; k < POR_SOBRE; k++) {
          var n;
          // Siete de cada diez salen de las que faltan: así el álbum se
          // completa en un rato y no en cientos de sobres.
          if (faltan.length && Math.random() < 0.7) {
            n = faltan.splice(Math.floor(Math.random() * faltan.length), 1)[0];
          } else {
            var libres = nums.filter(function (x) { return sale.indexOf(x) < 0; });
            n = libres[Math.floor(Math.random() * libres.length)];
            var q = faltan.indexOf(n);
            if (q >= 0) faltan.splice(q, 1);
          }
          sale.push(n);
        }
        return sale;
      }

      function carta(n, nueva, k) {
        var f = porN[n];
        var img = f.querySelector("img");
        var c = document.createElement("div");
        c.className = "sobre__carta" + (f.classList.contains("album__ficha--doble") ? " sobre__carta--postal" : "");
        c.style.setProperty("--k", k);
        var sede = f.closest(".album__pagina");
        var color = sede && sede.style.getPropertyValue("--sede");
        if (color) c.style.setProperty("--sede", color);
        c.innerHTML =
          '<div class="sobre__carta-in">' +
          '<div class="sobre__cara sobre__cara--dorso"></div>' +
          '<div class="sobre__cara sobre__cara--frente">' +
          '<span class="sobre__num">' + n + '</span>' +
          '<img alt="" src="' + (img ? (img.currentSrc || img.getAttribute("src")) : "") + '">' +
          '<span class="sobre__nom">' + (f._nombre || "") + '</span>' +
          '</div></div>' +
          '<span class="sobre__etq ' + (nueva ? "es-nueva" : "es-repe") + '">' +
          (nueva ? "¡Nueva!" : "Repetida") + '</span>';
        c.setAttribute("aria-label", "Figurita " + n + (f._nombre ? ", " + f._nombre : "") +
          (nueva ? ", nueva" : ", repetida"));
        return c;
      }

      function abrirSobre() {
        if (modo !== "coleccion") return;
        limpiarRelojes();
        var sale = sortear();
        var vistasYa = {};
        var nuevas = sale.filter(function (n) {
          if (peg[n] || vistasYa[n]) return false;
          vistasYa[n] = 1; return true;
        });
        actual = { nums: sale, nuevas: nuevas, abierto: false, pegado: false };
        cartas.innerHTML = "";
        confe.innerHTML = "";
        sob.classList.remove("sobre--abierto", "sobre--abriendo");
        paquete.hidden = false;
        acciones.hidden = true;
        msg.textContent = "Tocá el sobre para abrirlo";
        if (!sob.open) {
          sob.showModal();
          document.documentElement.classList.add("visor-on");
        }
        paquete.focus();
        if (!anima) romper();
      }

      function romper() {
        if (!actual || actual.abierto) return;
        actual.abierto = true;
        // Recién al romperlo cuenta como sobre abierto.
        est.sobres += 1;
        est.repetidas += actual.nums.length - actual.nuevas.length;
        escribir(K_EST, est);
        sob.classList.add("sobre--abriendo");
        msg.textContent = "";
        luego(function () {
          sob.classList.add("sobre--abierto");
          paquete.hidden = true;
          actual.nums.forEach(function (n, k) {
            cartas.appendChild(carta(n, actual.nuevas.indexOf(n) >= 0 &&
              actual.nums.indexOf(n) === k, k));
          });
          var cs = cartas.querySelectorAll(".sobre__carta");
          Array.prototype.forEach.call(cs, function (c, k) {
            luego(function () { c.classList.add("es-vista"); }, 650 + k * 380);
          });
          luego(function () {
            var nn = actual.nuevas.length;
            msg.textContent = nn === 0 ? "Todas repetidas… ¡a la próxima!" :
              nn === 1 ? "¡Una figurita nueva!" : "¡" + nn + " figuritas nuevas!";
            acciones.hidden = false;
            sob.querySelector(nn ? ".sobre__pegar" : ".sobre__otro").focus();
          }, 650 + cs.length * 380 + 250);
        }, 620);
      }

      function confeti(cuantos) {
        if (!anima) return;
        var colores = ["#75aadb", "#003087", "#f4d78e", "#d9a441", "#ffffff", "#e0679b", "#3fb596"];
        for (var k = 0; k < cuantos; k++) {
          var s = document.createElement("span");
          s.style.left = (Math.random() * 100) + "%";
          s.style.setProperty("--c", colores[k % colores.length]);
          s.style.setProperty("--x", (Math.random() * 16 - 8) + "rem");
          s.style.setProperty("--r", (Math.random() * 900 - 450) + "deg");
          s.style.animationDelay = (Math.random() * .5) + "s";
          s.style.animationDuration = (2 + Math.random() * 1.4) + "s";
          confe.appendChild(s);
        }
      }

      /* Pega las nuevas: pasa a la página de la primera y las hace caer
         en su lugar. Si con esto se completa una sede (o el álbum), lo
         festeja. */
      function pegar() {
        if (!actual || actual.pegado) return [];
        actual.pegado = true;
        var antes = {};
        actual.nuevas.forEach(function (n) {
          var s = porN[n]._sede;
          if (s && !(s in antes)) antes[s] = sedeCompleta(s);
        });
        actual.nuevas.forEach(function (n) { peg[n] = 1; });
        escribir(K_PEG, Object.keys(peg));
        var completas = Object.keys(antes).filter(function (s) { return !antes[s] && sedeCompleta(s); });
        aplicar();
        return completas;
      }

      function nombreSede(s) {
        var p = pags[primera[s]];
        var h = p && p.querySelector(".album__cab-t");
        return h ? h.textContent.trim() : s;
      }

      function cerrarSobre(irAlAlbum) {
        limpiarRelojes();
        var nuevas = actual ? actual.nuevas.slice() : [];
        var hubo = actual && actual.abierto && !actual.pegado;
        var completas = hubo ? pegar() : [];
        if (sob.open) sob.close();
        if (!irAlAlbum || !nuevas.length || !hubo) {
          if (hubo && nuevas.length) avisar("Se pegaron " + nuevas.length + " figuritas nuevas.");
          return;
        }
        var ordenadas = nuevas.slice().sort(function (a, b) { return porN[a]._pag - porN[b]._pag; });
        var destino = vistaDe[porN[ordenadas[0]]._pag];
        var demora = 0;
        if (destino != null && destino !== i) {
          irA(destino);
          demora = anima ? GIRO + 220 : 0;
        }
        setTimeout(function () {
          // La primera figurita que cae tiene que quedar a la vista.
          var prim = porN[ordenadas[0]];
          var r = prim.getBoundingClientRect();
          var tapa = 260; // cabecera + controles fijos arriba
          var fuera = r.top < tapa || r.bottom > window.innerHeight;
          if (fuera && prim.scrollIntoView) {
            prim.scrollIntoView({ behavior: anima ? "smooth" : "auto", block: "center" });
          }
          setTimeout(caer, fuera && anima ? 420 : 0);
        }, demora);
        function caer() {
          ordenadas.forEach(function (n, k) {
            var f = porN[n];
            f.style.setProperty("--k", k);
            f.classList.remove("album__ficha--pegando");
            void f.offsetWidth;
            f.classList.add("album__ficha--pegando");
            setTimeout(function () { f.classList.remove("album__ficha--pegando"); }, 1600 + k * 160);
          });
          completas.forEach(function (s) {
            pags.forEach(function (p) {
              if (p.dataset.sede !== s) return;
              p.classList.remove("album__pagina--sellando");
              void p.offsetWidth;
              p.classList.add("album__pagina--sellando");
            });
          });
        }
        var resto = nuevas.length - nuevas.filter(function (n) {
          return vistas[destino] && vistas[destino].paginas.indexOf(pags[porN[n]._pag]) >= 0;
        }).length;
        var t = nuevas.length === 1 ? "Se pegó 1 figurita nueva." : "Se pegaron " + nuevas.length + " figuritas nuevas.";
        if (resto > 0) t += " " + (resto === 1 ? "Otra está" : resto + " están") + " en otras páginas.";
        if (completas.length) t += " ¡Completaste " + completas.map(nombreSede).join(" y ") + "!";
        if (cuantas() === nums.length) t = "¡Completaste el álbum! Las " + nums.length + " figuritas están pegadas.";
        avisar(t);
      }

      paquete.addEventListener("click", romper);
      sob.querySelector(".sobre__pegar").addEventListener("click", function () { cerrarSobre(true); });
      sob.querySelector(".sobre__otro").addEventListener("click", function () {
        var completas = pegar();
        if (cuantas() === nums.length) {
          msg.textContent = "¡Completaste el álbum!";
          confeti(90);
          acciones.hidden = true;
          luego(function () { cerrarSobre(false); }, 2600);
          return;
        }
        if (completas.length) {
          avisar("¡Completaste " + completas.map(nombreSede).join(" y ") + "!");
        }
        abrirSobre();
      });
      sob.querySelector(".sobre__cerrar").addEventListener("click", function () { cerrarSobre(false); });
      sob.addEventListener("cancel", function (e) { e.preventDefault(); cerrarSobre(false); });
      sob.addEventListener("close", function () {
        document.documentElement.classList.remove("visor-on");
      });
      bSobre.addEventListener("click", function () {
        if (cuantas() === nums.length) { avisar("¡Ya tenés el álbum completo!"); return; }
        abrirSobre();
      });
      /* Si al pegar se completa el álbum, el sobre festeja antes de cerrar. */
      sob.querySelector(".sobre__pegar").addEventListener("click", function () {
        if (cuantas() === nums.length) confetiAlbum();
      });
      function confetiAlbum() {
        var capa = document.createElement("div");
        capa.className = "album__fiesta";
        capa.setAttribute("aria-hidden", "true");
        alb.appendChild(capa);
        var guardado = confe;
        confe = capa;
        confeti(110);
        confe = guardado;
        setTimeout(function () { capa.remove(); }, 4200);
      }

      return { aplicar: aplicar, cuantas: cuantas };
    })();

    anima = malla("(prefers-reduced-motion: no-preference)");
    armar();
    if (rango) rango.max = vistas.length;
    juego.aplicar();
    pintar();
    pintarProgreso();
  })();
})();

/* ------------------------------------------------------------------
   Barra de secciones: marca la sección activa con aria-current y, si
   la fila no entra en la pantalla, la deja deslizable en horizontal
   (el CSS dibuja los degradados de los costados con data-desborde).
   En las páginas de artículo se toma la sección desde el pie de firma.
   ------------------------------------------------------------------ */
(function nav() {
  "use strict";
  var lista = document.querySelector(".nav-ed__lista");
  if (!lista) return;
  var enlaces = Array.prototype.slice.call(lista.querySelectorAll("a[data-sec]"));
  if (!enlaces.length) return;

  function ruta(u) {
    try {
      return new URL(u, location.href).pathname
        .replace(/\/index\.html$/, "/").replace(/\/+$/, "");
    } catch (e) { return ""; }
  }

  var aqui = ruta(location.pathname);
  var cual = null;
  enlaces.forEach(function (a) {
    if (ruta(a.getAttribute("href")) === aqui) cual = a;
  });
  if (!cual) {
    var meta = document.querySelector(".articulo__meta a[href*='secciones/']");
    if (meta) {
      var sec = ruta(meta.getAttribute("href"));
      enlaces.forEach(function (a) {
        if (ruta(a.getAttribute("href")) === sec) cual = a;
      });
    }
  }
  if (cual) cual.setAttribute("aria-current", "page");

  function medir() {
    if (lista.scrollWidth - lista.clientWidth > 4) {
      lista.setAttribute("data-desborde", "1");
    } else {
      lista.removeAttribute("data-desborde");
      lista.scrollLeft = 0;
    }
  }
  medir();
  /* la sección activa queda a la vista, sin mover la página */
  if (cual) {
    lista.scrollLeft = cual.offsetLeft - (lista.clientWidth - cual.offsetWidth) / 2;
  }
  var reloj = null;
  window.addEventListener("resize", function () {
    if (reloj) clearTimeout(reloj);
    reloj = setTimeout(function () { reloj = null; medir(); }, 180);
  });
})();

/* ============ Herramientas de accesibilidad ============
   Un botón fijo abre un panel con ajustes que el lector prende o
   apaga: tamaño de letra, contraste alto, modo nocturno, enlaces
   subrayados, movimiento calmo y letras más claras para dislexia.
   Cada ajuste se guarda en localStorage y un script chico del
   <head> lo reaplica antes del primer pintado, así no hay
   destello del tema anterior al entrar en la página. */
(function () {
  "use strict";
  if (!document.body) return;

  var CLAVE = "rev.acc";
  var ESCALAS = [
    { v: "90",  txt: "A\u2212" },
    { v: "",    txt: "Normal" },
    { v: "112", txt: "A+" },
    { v: "125", txt: "A++" },
    { v: "140", txt: "A+++" }
  ];
  var AJUSTES = [
    { k: "escala",     etq: "Tamaño de letra",     tipo: "escala",
      ic: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><text x="12" y="17" text-anchor="middle" font-family="Archivo,system-ui,sans-serif" font-size="13" font-weight="800" fill="currentColor">Aa</text></svg>' },
    { k: "contraste",  etq: "Contraste alto",      v: "1",
      ic: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor"/></svg>' },
    { k: "tema",       etq: "Modo nocturno",       v: "oscuro",
      ic: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
    { k: "subrayar",   etq: "Enlaces subrayados",  v: "1",
      ic: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><text x="12" y="15" text-anchor="middle" font-family="Archivo,system-ui,sans-serif" font-size="13" font-weight="800" fill="currentColor">A</text><line x1="4" y1="20" x2="20" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' },
    { k: "calma",      etq: "Movimiento calmo",    v: "1",
      ic: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M12 3c-4 4-6 8-6 12a6 6 0 0 0 12 0c0-4-2-8-6-12z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>' },
    { k: "dislexia",   etq: "Letras más claras",   v: "1",
      ic: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><text x="12" y="17" text-anchor="middle" font-family="Archivo,system-ui,sans-serif" font-size="12" font-weight="800" fill="currentColor" letter-spacing="2">Ab</text></svg>' },
    { k: "mayusculas", etq: "Textos en mayúsculas", v: "1",
      ic: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><text x="12" y="17" text-anchor="middle" font-family="Archivo,system-ui,sans-serif" font-size="12" font-weight="800" fill="currentColor">AA</text></svg>' },
    { k: "voz",        etq: "Leer en voz alta",    v: "1",
      ic: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M3 9h4l5-4v14l-5-4H3zM16 8a4 4 0 0 1 0 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' }
  ];

  function leer() {
    try { return JSON.parse(localStorage.getItem(CLAVE) || "{}"); }
    catch (e) { return {}; }
  }
  var estado = leer();

  function guardar() {
    try { localStorage.setItem(CLAVE, JSON.stringify(estado)); }
    catch (e) {}
  }

  function aplicar() {
    var h = document.documentElement, i, v;
    for (i = 0; i < AJUSTES.length; i++) {
      v = estado[AJUSTES[i].k] || "";
      if (v) h.setAttribute("data-" + AJUSTES[i].k, v);
      else h.removeAttribute("data-" + AJUSTES[i].k);
    }
  }

  function boton(k, v, txt, escala) {
    return '<button type="button" class="acc__t' +
      (escala ? " acc__t--escala" : " acc__t--fila") + '" data-k="' + k +
      '" data-v="' + v + '" aria-pressed="false">' + txt + "</button>";
  }

  function grupo(a) {
    var i, h;
    if (a.tipo === "escala") {
      h = '<span class="acc__etq" id="acc-etq-' + a.k + '"><span class="acc__icon">' +
        (a.ic || "") + "</span>" + a.etq +
        '</span><div class="acc__fila" role="group" aria-labelledby="acc-etq-' +
        a.k + '">';
      for (i = 0; i < ESCALAS.length; i++) {
        h += boton(a.k, ESCALAS[i].v, ESCALAS[i].txt, true);
      }
      return h + "</div>";
    }
    /* Los demás son una fila entera: ícono y nombre a la izquierda y el
       estado a la derecha, para que se lea prendido/apagado */
    return boton(a.k, a.v, '<span class="acc__icon">' + (a.ic || "") +
      "</span>" + a.etq + '<span class="acc__estado">Apagado</span>', false);
  }

  var html = '<button type="button" class="acc__btn" aria-expanded="false"' +
    ' aria-controls="acc-panelo" aria-label="Herramientas de accesibilidad">' +
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"' +
    ' focusable="false"><circle cx="12" cy="4.3" r="2.1"/>' +
    '<path d="M3.6 8.3h16.8M12 8.3v6.5M12 14.8l-3.5 6.5M12 14.8l3.5 6.5"' +
    ' fill="none" stroke="currentColor" stroke-width="2"' +
    ' stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
    '<div class="acc__panelo" id="acc-panelo" role="group"' +
    ' aria-label="Herramientas de accesibilidad" hidden>' +
    '<p class="acc__titulo">Accesibilidad</p>';
  var i;
  for (i = 0; i < AJUSTES.length; i++) html += grupo(AJUSTES[i]);
  html += '<div class="acc__fila"><button type="button"' +
    ' class="acc__t acc__t--reset" data-reset="1">Restablecer todo' +
    "</button></div></div>";

  var cont = document.createElement("div");
  cont.className = "acc";
  cont.innerHTML = html;
  document.body.appendChild(cont);

  var btn = cont.querySelector(".acc__btn");
  var panelo = cont.querySelector(".acc__panelo");

  /* "Normal" es el único con data-v vacío: prendido cuando no hay
     escala guardada, y al apagarlo se borra el atributo. */
  function sincronizar() {
    var bs = cont.querySelectorAll("[data-k]"), n, b, k, v, on, est;
    for (n = 0; n < bs.length; n++) {
      b = bs[n];
      k = b.getAttribute("data-k");
      v = b.getAttribute("data-v");
      on = v === "" ? !estado[k] : estado[k] === v;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      est = b.querySelector(".acc__estado");
      if (est) est.textContent = on ? "Prendido" : "Apagado";
    }
  }

  function abrir(si) {
    panelo.hidden = !si;
    btn.setAttribute("aria-expanded", si ? "true" : "false");
    if (si) {
      var on = panelo.querySelector('[aria-pressed="true"]') ||
        panelo.querySelector("[data-k]");
      if (on) on.focus();
    } else {
      btn.focus();
    }
  }

  cont.addEventListener("click", function (ev) {
    var b = ev.target.closest ? ev.target.closest("[data-k],[data-reset]") : null;
    if (!b || !cont.contains(b)) return;
    if (b.hasAttribute("data-reset")) {
      estado = {};
    } else {
      var k = b.getAttribute("data-k");
      var v = b.getAttribute("data-v");
      if (estado[k] === v) delete estado[k];
      else estado[k] = v;
    }
    aplicar();
    sincronizar();
    guardar();
    /* los demás módulos (lectura en voz alta) escuchan este aviso */
    if (document.dispatchEvent) {
      document.dispatchEvent(new CustomEvent("rev:acc", { detail: estado }));
    }
  });

  btn.addEventListener("click", function () { abrir(panelo.hidden); });

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && !panelo.hidden) abrir(false);
  });

  document.addEventListener("click", function (ev) {
    if (!panelo.hidden && !cont.contains(ev.target)) abrir(false);
  });

  aplicar();
  sincronizar();
})();

/* ============ Lectura en voz alta ============
   Se prende desde la barra de accesibilidad ("Leer en voz alta").
   Toma los bloques legibles de la página, los lee uno por uno con
   la voz del navegador y pinta el bloque que está sonando: así
   quien no puede seguir con los ojos igual sabe dónde va el texto.
   El panel flota abajo a la izquierda, del lado opuesto a la
   barra de accesibilidad, para no pisarse. */
(function () {
  "use strict";
  var CLAVE = "rev.acc";
  var CLAVE_VOZ = "rev.voz";

  /* Navegador sin Web Speech: el interruptor no tiene sentido,
     se borra del panel y no se ofrece nada que no funcione. */
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
    var mord = document.querySelector('.acc [data-k="voz"]');
    if (mord && mord.parentNode) mord.parentNode.removeChild(mord);
    return;
  }

  function leerJSON(clave, porDefecto) {
    try { return JSON.parse(localStorage.getItem(clave) || "null") || porDefecto; }
    catch (e) { return porDefecto; }
  }

  var bloques = [];
  var actual = -1;
  var corriendo = false;
  var pausado = false;
  var activo = false;
  var gen = 0;              /* invalida los onend de un ciclo viejo */
  var voces = [];
  var vozElegida = leerJSON(CLAVE_VOZ, null);
  var relojCromo = null;
  var fallos = 0;

  function texto(el) {
    return (el.textContent || "").replace(/\s+/g, " ").trim();
  }

  /* Ruido que no aporta al oído: firma, fecha, "volver", rótulos */
  function sirve(el) {
    return !el.closest(".articulo__meta, .articulo__fin, .articulo__sec, .salto, .masthead, .pie, .volver, .todos__enlace, .sumario__item");
  }

  function reunir() {
    var cuerpo = document.querySelector(".articulo__cuerpo");
    var sel = cuerpo
      ? ".articulo__cuerpo > p, .articulo__cuerpo > h2, .articulo__cuerpo > h3," +
        " .articulo__cuerpo > h4, .articulo__cuerpo > blockquote," +
        " .articulo__cuerpo > ul, .articulo__cuerpo > ol," +
        " .articulo__cuerpo > figure figcaption"
      : "main h1, main h2, main h3, main h4, main p, main figcaption, main li";
    var lista = document.querySelectorAll(sel), i, out = [];
    for (i = 0; i < lista.length; i++) {
      if (texto(lista[i]) && sirve(lista[i])) out.push(lista[i]);
    }
    return out;
  }

  /* ---------- panel flotante ---------- */
  var voz = document.createElement("div");
  voz.className = "voz";
  voz.hidden = true;
  voz.innerHTML =
    '<p class="voz__cab"><span>Leer en voz alta</span>' +
    '<span class="voz__n" data-n>0 / 0</span></p>' +
    '<div class="voz__fila">' +
    '<button type="button" class="acc__t voz__b" data-act="ant" aria-label="Parte anterior">&lsaquo;</button>' +
    '<button type="button" class="acc__t voz__b voz__prin" data-act="play" aria-label="Empezar a leer">&#9654;</button>' +
    '<button type="button" class="acc__t voz__b" data-act="sig" aria-label="Parte siguiente">&rsaquo;</button>' +
    '<button type="button" class="acc__t voz__b" data-act="stop" aria-label="Detener la lectura">&#9632;</button>' +
    '<select class="voz__voz" data-voz aria-label="Voz para leer"></select>' +
    '</div>';
  document.body.appendChild(voz);

  var bPlay = voz.querySelector('[data-act="play"]');
  var bAnt = voz.querySelector('[data-act="ant"]');
  var bSig = voz.querySelector('[data-act="sig"]');
  var bStop = voz.querySelector('[data-act="stop"]');
  var caja = voz.querySelector("[data-n]");
  var selVoz = voz.querySelector("[data-voz]");

  function cuenta() {
    caja.textContent = (actual >= 0 ? actual + 1 : 0) + " / " + bloques.length;
  }

  function marcar() {
    var i, previo = voz.querySelectorAll(".voz-leyendo");
    for (i = 0; i < previo.length; i++) previo[i].classList.remove("voz-leyendo");
    if (actual < 0 || !bloques[actual]) { cuenta(); return; }
    var el = bloques[actual];
    el.classList.add("voz-leyendo");
    var r = el.getBoundingClientRect();
    var lejos = r.top < 8 || r.bottom > window.innerHeight - 8;
    if (lejos) {
      var calmo = document.documentElement.hasAttribute("data-calma");
      try {
        el.scrollIntoView({ block: "center", behavior: calmo ? "auto" : "smooth" });
      } catch (e) { el.scrollIntoView(); }
    }
    cuenta();
  }

  function icono_play(si) {
    bPlay.innerHTML = si ? "&#10074;&#10074;" : "&#9654;";
    bPlay.setAttribute("aria-label", si ? "Pausar la lectura" : "Empezar a leer");
    bPlay.setAttribute("aria-pressed", si ? "true" : "false");
  }

  /* Chrome pausa la síntesis después de un rato: un refresco
     periódico mientras se está leyendo lo mantiene despierto */
  function despertar() {
    if (relojCromo) clearInterval(relojCromo);
    relojCromo = setInterval(function () {
      if (!corriendo) { clearInterval(relojCromo); relojCromo = null; return; }
      if (!speechSynthesis.paused) speechSynthesis.resume();
    }, 9000);
  }

  function decir(i) {
    if (!corriendo) return;
    if (i < 0 || i >= bloques.length) { detener(); return; }
    actual = i;
    marcar();
    var miGen = gen;
    var u = new SpeechSynthesisUtterance(texto(bloques[i]));
    u.lang = (vozElegida && vozElegida.lang) || "es-AR";
    if (vozElegida) u.voice = vozElegida;
    u.rate = 1;
    u.pitch = 1;
    /* una frase que arranca bien reinicia el conteo de fallos */
    u.onstart = function () { fallos = 0; };
    u.onend = function () {
      if (miGen !== gen || !corriendo) return;
      decir(i + 1);
    };
    u.onerror = function (ev) {
      if (miGen !== gen || !corriendo) return;
      var r = ev && ev.error;
      /* "interrupted"/"canceled" son nuestras propias órdenes de
         parar: no cuentan como fallo de la voz */
      if (r === "interrupted" || r === "canceled" || r === "aborted") return;
      fallos++;
      if (fallos >= 2) { detener("No se pudo leer en voz alta"); return; }
      if (i + 1 < bloques.length) decir(i + 1); else detener();
    };
    speechSynthesis.speak(u);
  }

  function arrancar(desde) {
    if (!bloques.length) bloques = reunir();
    if (!bloques.length) return;
    corriendo = true;
    pausado = false;
    gen++;
    fallos = 0;
    speechSynthesis.cancel();
    icono_play(true);
    despertar();
    decir(typeof desde === "number" ? desde : (actual >= 0 ? actual : 0));
  }

  function pausar() {
    if (corriendo) {
      speechSynthesis.pause();
      pausado = true;
      corriendo = false;
      icono_play(false);
    } else if (pausado) {
      speechSynthesis.resume();
      pausado = false;
      corriendo = true;
      icono_play(true);
      /* si el navegador se comió la frase mientras estaba en pausa,
         seguimos por la siguiente */
      if (!speechSynthesis.speaking) decir(actual + 1);
      else despertar();
    }
  }

  function detener(msg) {
    gen++;
    corriendo = false;
    pausado = false;
    fallos = 0;
    speechSynthesis.cancel();
    if (relojCromo) { clearInterval(relojCromo); relojCromo = null; }
    icono_play(false);
    actual = -1;
    marcar();
    if (msg) caja.textContent = msg;
  }

  function irA(i) {
    if (i < 0 || i >= bloques.length) return;
    if (corriendo || pausado) {
      arrancar(i);
    } else {
      actual = i;
      marcar();
    }
  }

  /* ---------- voces ---------- */
  function rellenar() {
    var i, op, actualSel = vozElegida ? vozElegida.name : null;
    selVoz.innerHTML = "";
    if (!voces.length) {
      selVoz.hidden = true;
      return;
    }
    selVoz.hidden = false;
    for (i = 0; i < voces.length; i++) {
      op = document.createElement("option");
      op.value = String(i);
      op.textContent = (voces[i].name || "Voz " + (i + 1)).replace(/\s*\(.*?\)\s*$/, "");
      if (actualSel && voces[i].name === actualSel) op.selected = true;
      selVoz.appendChild(op);
    }
    if (!actualSel) {
      vozElegida = voces[0];
      selVoz.value = "0";
    }
  }

  function cargarVoces() {
    var todas = speechSynthesis.getVoices() || [], i, es = [];
    for (i = 0; i < todas.length; i++) {
      if (/^es/i.test(todas[i].lang)) es.push(todas[i]);
    }
    /* si el sistema no trae castellano, mostramos lo que haya:
       el navegador igual puede sintetizar con lang es-AR */
    voces = es.length ? es : todas;
    if (vozElegida) {
      var esta = false;
      for (i = 0; i < voces.length; i++) if (voces[i].name === vozElegida.name) esta = true;
      if (!esta) vozElegida = voces[0] || null;
    } else {
      vozElegida = voces[0] || null;
    }
    rellenar();
  }

  if (typeof speechSynthesis.addEventListener === "function") {
    speechSynthesis.addEventListener("voiceschanged", cargarVoces);
  }
  cargarVoces();

  selVoz.addEventListener("change", function () {
    var n = parseInt(selVoz.value, 10);
    vozElegida = voces[n] || null;
    try { localStorage.setItem(CLAVE_VOZ, JSON.stringify(vozElegida ? vozElegida.name : null)); }
    catch (e) {}
    if (corriendo || pausado) arrancar(actual >= 0 ? actual : 0);
  });

  /* ---------- controles ---------- */
  voz.addEventListener("click", function (ev) {
    var b = ev.target.closest ? ev.target.closest("[data-act]") : null;
    if (!b) return;
    var a = b.getAttribute("data-act");
    if (a === "play") {
      if (corriendo || pausado) pausar();
      else arrancar(actual >= 0 ? actual : 0);
    }
    else if (a === "stop") detener();
    else if (a === "ant") irA(Math.max(0, (actual >= 0 ? actual : 0) - 1));
    else if (a === "sig") irA(Math.min(bloques.length - 1, (actual >= 0 ? actual : 0) + 1));
  });

  /* Saltar a un párrafo con el mouse mientras se escucha. Los enlaces
     y botones del texto siguen siendo enlaces y botones. */
  document.addEventListener("click", function (ev) {
    if (!activo || !corriendo) return;
    var t = ev.target;
    if (!t.closest) return;
    if (t.closest("a, button, select, input, textarea, label")) return;
    var el = t.closest("p, h1, h2, h3, h4, li, blockquote, figcaption");
    if (!el) return;
    var i = bloques.indexOf(el);
    if (i >= 0) { ev.preventDefault(); irA(i); }
  });

  /* ---------- encendido desde la barra de accesibilidad ---------- */
  function encender() {
    activo = true;
    voz.hidden = false;
    bloques = reunir();
    actual = -1;
    cuenta();
    if (bPlay) bPlay.focus();
  }

  function apagar() {
    activo = false;
    detener();
    voz.hidden = true;
  }

  document.addEventListener("rev:acc", function (ev) {
    var on = !!(ev.detail && ev.detail.voz === "1");
    if (on === activo) return;
    if (on) encender(); else apagar();
  });

  /* Al entrar con la preferencia guardada se muestra el panel, pero
     no se habla solo: los navegadores cortan la voz sin un gesto. */
  if (leerJSON(CLAVE, {}).voz === "1") {
    activo = true;
    voz.hidden = false;
    bloques = reunir();
    cuenta();
  }
})();

/* ------------------------------------------------------------------ */
/* Galería deslizable: <figure class="slides" data-slides>             */
/* ------------------------------------------------------------------ */
(function () {
  var figs = document.querySelectorAll("[data-slides]");
  if (!figs.length) return;

  Array.prototype.forEach.call(figs, function (fig) {
    var img = fig.querySelector("[data-slides-img]");
    var num = fig.querySelector("[data-slides-num]");
    var datos = fig.querySelector("[data-slides-datos]");
    var prev = fig.querySelector(".slides__nav--prev");
    var next = fig.querySelector(".slides__nav--next");
    if (!img || !datos) return;

    var fotos;
    try { fotos = JSON.parse(datos.textContent || "[]"); } catch (e) { return; }
    if (!fotos.length) return;

    var total = fotos.length;
    var actual = 0;
    var cache = {};

    function precargar(n) {
      n = ((n % total) + total) % total;
      var f = fotos[n];
      if (cache[f]) return;
      cache[f] = 1;
      var p = new Image();
      p.src = f;
    }

    function pintar(n) {
      actual = ((n % total) + total) % total;
      var f = fotos[actual];
      if (num) num.textContent = (actual + 1) + " / " + total;
      precargar(actual + 1);
      precargar(actual - 1);
      if (img.getAttribute("src") === f) return;
      img.setAttribute("data-cambiando", "1");
      var prox = new Image();
      prox.onload = function () {
        img.src = f;
        img.removeAttribute("data-cambiando");
      };
      prox.onerror = function () {
        img.src = f;
        img.removeAttribute("data-cambiando");
      };
      prox.src = f;
    }

    function ir(n) { pintar(n); }

    if (prev) prev.addEventListener("click", function () { ir(actual - 1); });
    if (next) next.addEventListener("click", function () { ir(actual + 1); });

    fig.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowLeft") { ir(actual - 1); ev.preventDefault(); }
      else if (ev.key === "ArrowRight") { ir(actual + 1); ev.preventDefault(); }
      else if (ev.key === "Home") { ir(0); ev.preventDefault(); }
      else if (ev.key === "End") { ir(total - 1); ev.preventDefault(); }
    });

    /* Deslizar con el dedo o el mouse */
    var x0 = null, y0 = null, activo = false;
    fig.addEventListener("pointerdown", function (ev) {
      if (ev.target.closest("button")) return;
      x0 = ev.clientX; y0 = ev.clientY; activo = true;
    });
    fig.addEventListener("pointerup", function (ev) {
      if (!activo) return;
      activo = false;
      if (x0 === null) return;
      var dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        ir(actual + (dx < 0 ? 1 : -1));
      }
      x0 = null;
    });
    fig.addEventListener("pointercancel", function () { activo = false; x0 = null; });

    precargar(1);
    if (num) num.textContent = "1 / " + total;
  });
})();

/* ============ Tutorial de navegación ============
   Recorrido guiado para la primera visita. En vez de pasar
   pantallas de texto, oscurece la página y recorta un halo sobre
   el elemento real del que habla (el menú, el sumario, el artículo
   o el botón de accesibilidad); el cartel se apoya al lado con una
   flecha y se reubica solo al cambiar de paso, al scrollear o al
   redimensionar. Se cierra con Escape, con la cruz o tocando
   afuera, y no vuelve a aparecer. Para recuperarlo hay un enlace
   en el pie y un botón en el panel de accesibilidad. */
(function () {
  "use strict";
  if (!document.body) return;

  var CLAVE = "rev.tuto";
  var ICONO =
    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"' +
    ' focusable="false"><circle cx="12" cy="4.3" r="2.1"/>' +
    '<path d="M3.6 8.3h16.8M12 8.3v6.5M12 14.8l-3.5 6.5M12 14.8l3.5 6.5"' +
    ' fill="none" stroke="currentColor" stroke-width="2"' +
    ' stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* Cada paso apunta a un elemento de la página (sel). Sin sel es
     la bienvenida, que va centrada y sin halo. Los pasos se arman
     según la página: la portada tiene sumario, el artículo tiene
     cuerpo, la sección tiene listado. */
  var PASOS = [{
    t: "Cómo navegar la revista",
    v: "Un recorrido corto por el menú, el contenido y las herramientas " +
       "de accesibilidad. Te muestro dónde está cada cosa.",
    p: "Podés salir cuando quieras con Escape."
  }, {
    sel: ".nav-ed",
    t: "El menú de arriba",
    v: "<strong>Índice</strong> te devuelve a la portada. Al lado, las " +
       "secciones agrupan los artículos: Escuela, Ciencia y tecnología, " +
       "Territorio, Voces, Estudiantes, Cultura y Proyectos.",
    p: "En el celular, el menú se desliza de costado."
  }];

  if (document.querySelector(".sumario")) {
    PASOS.push({
      sel: ".sumario",
      t: "El sumario",
      v: "Cada línea es una sección con su número, su nombre y una " +
         "descripción. Tocá una para entrar: adentro están todos sus " +
         "artículos.",
      p: "Al final del sumario está el enlace con todos los artículos de la edición."
    });
  } else if (document.querySelector(".articulo__cuerpo")) {
    PASOS.push({
      sel: ".articulo__cuerpo",
      t: "El artículo",
      v: "Acá está el texto con sus fotos y videos. Al final de " +
         "cada nota, <strong>Volver</strong> te deja en la sección de " +
         "donde viniste.",
      p: "Si la nota tiene galería, tocá una foto para verla en grande."
    });
  } else if (document.querySelector(".sec-listado")) {
    PASOS.push({
      sel: ".sec-listado",
      t: "Los artículos de la sección",
      v: "Cada tarjeta es un artículo: la foto, el título y la bajada. " +
         "Tocá cualquiera para leerlo completo.",
      p: "El número junto al título indica la sección dentro de la edición."
    });
  }

  PASOS.push({
    sel: ".acc__btn",
    t: "Si te cuesta leer",
    v: "El botón verde de la esquina abre las <strong>herramientas de " +
       "accesibilidad</strong>: tamaño de letra, contraste alto, modo " +
       "nocturno, enlaces subrayados, movimiento calmo, letras para " +
       "dislexia, textos en mayúsculas y lectura en voz alta.",
    p: "La revista recuerda tus ajustes la próxima vez que entres.",
    acc: true
  });

  var mapaHtml = ["Portada", "Secciones", "Artículos", "Accesibilidad"]
    .map(function (t) { return "<span>" + t + "</span>"; })
    .join("<i aria-hidden=\"true\">\u2192</i>");

  var puntosHtml = "";
  for (var i = 0; i < PASOS.length; i++) {
    puntosHtml += '<span class="tuto__punto" data-punto="' + i + '"></span>';
  }

  var capa = document.createElement("div");
  capa.className = "tuto";
  capa.hidden = true;
  capa.innerHTML =
    '<div class="tuto__anillo" aria-hidden="true"></div>' +
    '<div class="tuto__flecha" aria-hidden="true" hidden></div>' +
    '<div class="tuto__caja" role="dialog" aria-modal="true"' +
    ' aria-labelledby="tuto-t" aria-describedby="tuto-v" tabindex="-1">' +
    '<button type="button" class="tuto__cerrar" aria-label="Cerrar el tutorial">' +
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"' +
    ' focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none"' +
    ' stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>' +
    '<p class="tuto__marca">La Revista del Rural</p>' +
    '<div class="tuto__texto" aria-live="polite">' +
    '<p class="tuto__prog" data-prog>Paso 1 de ' + PASOS.length + "</p>" +
    '<h2 class="tuto__t" id="tuto-t"></h2>' +
    '<div class="tuto__mapa" data-mapa>' + mapaHtml + "</div>" +
    '<p class="tuto__v" id="tuto-v"></p>' +
    '<p class="tuto__demo" data-demo hidden><span class="tuto__demo-btn">' +
    ICONO + "</span><span>Herramientas de accesibilidad</span></p>" +
    '<button type="button" class="tuto__probar" data-probar="acc" hidden>' +
    "Abrir las herramientas</button>" +
    '<p class="tuto__pista" data-pista></p>' +
    "</div>" +
    '<div class="tuto__pie">' +
    '<span class="tuto__puntos" aria-hidden="true">' + puntosHtml + "</span>" +
    '<span class="tuto__acciones">' +
    '<button type="button" class="tuto__b" data-nav="-1">Anterior</button>' +
    '<button type="button" class="tuto__b tuto__b--prin" data-nav="1">Siguiente</button>' +
    "</span></div></div>";
  document.body.appendChild(capa);

  var caja = capa.querySelector(".tuto__caja");
  var anillo = capa.querySelector(".tuto__anillo");
  var flecha = capa.querySelector(".tuto__flecha");
  var tTitulo = capa.querySelector(".tuto__t");
  var tTexto = capa.querySelector(".tuto__v");
  var tPista = capa.querySelector("[data-pista]");
  var tMapa = capa.querySelector("[data-mapa]");
  var tDemo = capa.querySelector("[data-demo]");
  var tProbar = capa.querySelector("[data-probar]");
  var prog = capa.querySelector("[data-prog]");
  var bAnt = capa.querySelector('[data-nav="-1"]');
  var bSig = capa.querySelector('[data-nav="1"]');
  var puntos = capa.querySelectorAll(".tuto__punto");
  var indice = 0;
  var previo = null;

  function calma() {
    return document.documentElement.hasAttribute("data-calma");
  }

  function objetivo() {
    var p = PASOS[indice];
    var el = p && p.sel ? document.querySelector(p.sel) : null;
    if (!el) return null;
    /* Si el elemento es más alto que media pantalla (el sumario o el
       cuerpo de un artículo), el halo cubriría todo el viewport y el
       cartel quedaría encima del contenido. En ese caso se recorta a
       una parte representativa: la cabecera del sumario, el título del
       artículo o el título de la sección. */
    var vh = window.innerHeight;
    if (el.getBoundingClientRect().height > vh * 0.4) {
      var alt = el.querySelector(".sumario__cabecera, .articulo__h1");
      if (!alt && p.sel === ".articulo__cuerpo") alt = document.querySelector(".articulo__h1");
      if (!alt) alt = document.querySelector(".sec-portada__h1");
      if (alt) el = alt;
    }
    return el;
  }

  /* Deja el elemento a la vista antes de medir: si está fuera de
     pantalla (el sumario en la portada, el cuerpo en un artículo),
     lo lleva al centro. */
  function centrar(el) {
    if (!el || el.classList.contains("acc__btn")) return;
    var r = el.getBoundingClientRect();
    if (r.top >= 8 && r.bottom <= window.innerHeight - 8) return;
    try {
      el.scrollIntoView({ block: "center", behavior: calma() ? "auto" : "smooth" });
    } catch (e) {
      el.scrollIntoView();
    }
  }

  function ubicar() {
    if (capa.hidden) return;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var tw = caja.offsetWidth;
    var th = caja.offsetHeight;
    var el = objetivo();

    if (!el) {
      caja.style.left = Math.round((vw - tw) / 2) + "px";
      caja.style.top = Math.round((vh - th) / 2) + "px";
      caja.classList.remove("tuto__caja--arriba");
      anillo.hidden = true;
      flecha.hidden = true;
      return;
    }

    var r = el.getBoundingClientRect();
    var pad = 8;
    var x = Math.max(6, r.left - pad);
    var y = Math.max(6, r.top - pad);
    var w = Math.min(vw - 12, r.width + pad * 2);
    var h = Math.min(vh - 12, r.height + pad * 2);

    anillo.hidden = false;
    anillo.style.left = x + "px";
    anillo.style.top = y + "px";
    anillo.style.width = w + "px";
    anillo.style.height = h + "px";

    var m = 12;
    var abajo = y + h + m + th <= vh - 8;
    var arriba = y - m - th >= 8;
    var top, conFlecha = true;
    if (abajo) top = y + h + m;
    else if (arriba) top = y - m - th;
    else { top = 8; conFlecha = false; }

    var left = Math.min(Math.max(8, r.left + r.width / 2 - tw / 2), vw - tw - 8);
    caja.style.left = left + "px";
    caja.style.top = top + "px";
    caja.classList.toggle("tuto__caja--arriba", !abajo && arriba);

    if (!conFlecha) { flecha.hidden = true; return; }
    var ax = Math.min(Math.max(16, r.left + r.width / 2 - left), tw - 16);
    flecha.hidden = false;
    flecha.style.left = (left + ax - 7) + "px";
    flecha.style.top = (abajo ? top - 7 : top + th - 7) + "px";
    flecha.classList.toggle("tuto__flecha--abajo", !abajo);
  }

  function ir(n) {
    if (n < 0) n = 0;
    if (n > PASOS.length - 1) n = PASOS.length - 1;
    indice = n;
    var p = PASOS[n];

    capa.classList.toggle("tuto--intro", !p.sel);
    anillo.hidden = !p.sel;
    flecha.hidden = true;
    tTitulo.textContent = p.t;
    tTexto.innerHTML = p.v;
    tPista.textContent = p.p || "";
    tPista.hidden = !p.p;
    tMapa.hidden = !!p.sel;
    tDemo.hidden = !p.acc;
    tProbar.hidden = !p.acc;
    prog.textContent = "Paso " + (n + 1) + " de " + PASOS.length;
    bAnt.disabled = n === 0;
    bSig.textContent = n === PASOS.length - 1
      ? "Listo, a leer" : (n === 0 ? "Empezar" : "Siguiente");
    for (var j = 0; j < puntos.length; j++) {
      if (j === n) puntos[j].setAttribute("aria-current", "step");
      else puntos[j].removeAttribute("aria-current");
    }

    var el = objetivo();
    if (el) centrar(el);
    ubicar();
  }

  function abrir() {
    if (!capa.hidden) return;
    /* si el panel de accesibilidad estaba abierto, se cierra */
    var accBtn = document.querySelector(".acc__btn");
    if (accBtn && accBtn.getAttribute("aria-expanded") === "true") accBtn.click();
    previo = document.activeElement;
    capa.hidden = false;
    ir(0);
    caja.focus();
  }

  function cerrar() {
    if (capa.hidden) return;
    capa.hidden = true;
    capa.classList.remove("tuto--intro");
    try { localStorage.setItem(CLAVE, "1"); } catch (e) {}
    try { sessionStorage.setItem(CLAVE, "1"); } catch (e) {}
    if (previo && previo.focus && document.contains(previo)) previo.focus();
  }

  function visto() {
    try { if (localStorage.getItem(CLAVE) === "1") return true; } catch (e) {}
    try { if (sessionStorage.getItem(CLAVE) === "1") return true; } catch (e) {}
    return false;
  }

  capa.addEventListener("click", function (ev) {
    var b = ev.target.closest ? ev.target.closest("[data-nav]") : null;
    if (b) {
      var d = parseInt(b.getAttribute("data-nav"), 10);
      if (d > 0 && indice === PASOS.length - 1) { cerrar(); return; }
      ir(indice + d);
      return;
    }
    var pr = ev.target.closest ? ev.target.closest("[data-probar]") : null;
    if (pr) {
      cerrar();
      window.setTimeout(function () {
        var a = document.querySelector(".acc__btn");
        if (a) a.click();
      }, 160);
      return;
    }
    if (ev.target === capa) cerrar();
  });
  capa.querySelector(".tuto__cerrar").addEventListener("click", cerrar);

  document.addEventListener("keydown", function (ev) {
    if (capa.hidden) return;
    if (ev.key === "Escape") { ev.preventDefault(); cerrar(); return; }
    if (ev.key === "ArrowRight") { ev.preventDefault(); ir(indice + 1); return; }
    if (ev.key === "ArrowLeft") { ev.preventDefault(); ir(indice - 1); return; }
    if (ev.key !== "Tab") return;
    var f = caja.querySelectorAll('button:not([disabled]):not([hidden]), [href],' +
      ' input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    var prim = f[0], ult = f[f.length - 1];
    if (ev.shiftKey && (document.activeElement === prim || document.activeElement === caja)) {
      ev.preventDefault(); ult.focus();
    } else if (!ev.shiftKey && document.activeElement === ult) {
      ev.preventDefault(); prim.focus();
    }
  });

  /* Al scrollear o redimensionar, el halo y el cartel siguen al
     elemento; se recalcula una vez por cuadro. */
  var pendiente = false;
  function reubicar() {
    if (pendiente) return;
    pendiente = true;
    window.requestAnimationFrame(function () {
      pendiente = false;
      ubicar();
    });
  }
  window.addEventListener("scroll", reubicar, { passive: true });
  window.addEventListener("resize", reubicar);

  /* lanzadores: enlace del pie y botón del panel de accesibilidad */
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest ? ev.target.closest("[data-tuto]") : null;
    if (!b) return;
    ev.preventDefault();
    abrir();
  });

  var panelo = document.querySelector(".acc__panelo");
  if (panelo) {
    var lanzador = document.createElement("button");
    lanzador.type = "button";
    lanzador.className = "acc__t acc__t--reset";
    lanzador.setAttribute("data-tuto", "1");
    lanzador.innerHTML = '<span class="acc__icon">' +
      '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">' +
      '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/>' +
      '<path d="M12 8v.01M10 12h2v4h2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
      "</span>Ver el tutorial";
    panelo.appendChild(lanzador);
  }

  /* ?tuto=1 permite volver a verlo sin borrar los datos del navegador */
  var forzar = /[?&]tuto=1(?:&|$)/.test(window.location.search);
  if (!visto() || forzar) {
    window.setTimeout(function () { abrir(); }, 700);
  }
})();

/* ------------------------------------------------------------------
   Buzón de mensajes: el botón «Escribir un mensaje» abre una ventanita
   propia de la revista (nombre, sede, mensaje) y manda las respuestas
   al Formulario de Google por detrás, sin mostrar la página de Google.
   Nada se publica solo: le llega al equipo docente, que modera. Si el
   navegador no puede enviar, se ofrece abrir el formulario de siempre.
   ------------------------------------------------------------------ */
(function buzon() {
  "use strict";
  var btn = document.querySelector(".mensajes__btn[data-envio]");
  if (!btn || typeof HTMLDialogElement === "undefined" || !window.fetch) return;
  var envio;
  try { envio = JSON.parse(btn.getAttribute("data-envio")); } catch (e) { return; }
  var campos = envio.campos || {};
  var nota = btn.getAttribute("data-nota") || document.title;
  var MAX = 1000;
  // Con la hoja publicada, los mensajes salen solos al pie de la nota.
  var auto = !!document.querySelector(".mensajes[data-hoja]");
  var AVISO = auto
    ? "Tu mensaje se publica al pie de esta nota. Escribí con respeto: el equipo docente quita los que no cuiden a la comunidad."
    : "El equipo docente de la revista lee cada mensaje antes de compartirlo.";
  var GRACIAS = auto
    ? "Ya aparece al pie de la nota para vos; el resto lo va a ver en unos minutos."
    : "Le llegó al equipo de la revista. Si lo eligen para publicar, va a aparecer al pie de esta nota.";

  var dlg = document.createElement("dialog");
  dlg.className = "buzon";
  dlg.setAttribute("aria-labelledby", "buzon-t");
  dlg.innerHTML =
    '<form class="buzon__form" novalidate>' +
    '<button type="button" class="buzon__cerrar" aria-label="Cerrar">&#10005;</button>' +
    '<p class="buzon__kicker">Mensaje para la nota</p>' +
    '<h2 id="buzon-t" class="buzon__t"></h2>' +
    '<label class="buzon__campo"><span>Tu nombre</span>' +
    '<input name="nombre" required maxlength="80" autocomplete="name"></label>' +
    '<label class="buzon__campo"><span>Tu sede o localidad <i>(opcional)</i></span>' +
    '<input name="sede" maxlength="80"></label>' +
    '<label class="buzon__campo"><span>Tu mensaje</span>' +
    '<textarea name="mensaje" required maxlength="' + MAX + '" rows="5"></textarea>' +
    '<small class="buzon__cuenta" aria-live="polite">0 / ' + MAX + '</small></label>' +
    // trampa para robots: una persona no la ve ni la completa
    '<label class="buzon__trampa" aria-hidden="true">No completar<input name="web" tabindex="-1" autocomplete="off"></label>' +
    '<p class="buzon__error" role="alert" hidden></p>' +
    '<p class="buzon__aviso">' + AVISO + '</p>' +
    '<div class="buzon__acciones">' +
    '<button type="button" class="buzon__cancelar">Cancelar</button>' +
    '<button type="submit" class="buzon__enviar">Enviar mensaje</button></div>' +
    '</form>' +
    '<div class="buzon__ok" hidden>' +
    '<p class="buzon__ok-ico" aria-hidden="true"></p>' +
    '<h2 class="buzon__t" tabindex="-1">¡Gracias por tu mensaje!</h2>' +
    '<p>' + GRACIAS + '</p>' +
    '<button type="button" class="buzon__enviar buzon__listo">Volver a la nota</button></div>';
  document.body.appendChild(dlg);
  var form = dlg.querySelector(".buzon__form");
  var ok = dlg.querySelector(".buzon__ok");
  var error = dlg.querySelector(".buzon__error");
  var enviar = dlg.querySelector('.buzon__enviar[type="submit"]');
  var cuenta = dlg.querySelector(".buzon__cuenta");
  dlg.querySelector(".buzon__t").textContent = "«" + nota + "»";

  function abrir(e) {
    e.preventDefault();
    form.hidden = false; ok.hidden = true; error.hidden = true;
    enviar.disabled = false; enviar.textContent = "Enviar mensaje";
    dlg.showModal();
    document.documentElement.classList.add("visor-on");
    form.elements.nombre.focus();
  }
  function cerrar() { if (dlg.open) dlg.close(); }
  dlg.addEventListener("close", function () { document.documentElement.classList.remove("visor-on"); btn.focus(); });
  dlg.addEventListener("click", function (e) { if (e.target === dlg) cerrar(); });
  dlg.querySelector(".buzon__cerrar").addEventListener("click", cerrar);
  dlg.querySelector(".buzon__cancelar").addEventListener("click", cerrar);
  dlg.querySelector(".buzon__listo").addEventListener("click", cerrar);
  form.elements.mensaje.addEventListener("input", function () {
    cuenta.textContent = form.elements.mensaje.value.length + " / " + MAX;
  });
  btn.addEventListener("click", abrir);
  form.addEventListener("input", function () { if (!error.hidden) error.hidden = true; });

  function mostrarError(txt, conEnlace) {
    error.innerHTML = "";
    error.appendChild(document.createTextNode(txt));
    if (conEnlace) {
      var a = document.createElement("a");
      a.href = btn.href; a.target = "_blank"; a.rel = "noopener";
      a.textContent = " Abrir el formulario";
      error.appendChild(a);
    }
    error.hidden = false;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var nombre = form.elements.nombre.value.trim();
    var sede = form.elements.sede.value.trim();
    var mensaje = form.elements.mensaje.value.trim();
    if (!nombre) { mostrarError("Escribí tu nombre."); form.elements.nombre.focus(); return; }
    if (!mensaje) { mostrarError("Escribí tu mensaje."); form.elements.mensaje.focus(); return; }
    error.hidden = true;
    // Un robot completa la trampa: se le muestra el agradecimiento y nada más.
    if (form.elements.web.value) { form.hidden = true; ok.hidden = false; return; }
    var datos = new URLSearchParams();
    if (campos.nota) datos.append(campos.nota, nota);
    if (campos.nombre) datos.append(campos.nombre, nombre);
    if (campos.sede && sede) datos.append(campos.sede, sede);
    datos.append(campos.mensaje, mensaje);
    enviar.disabled = true; enviar.textContent = "Enviando…";
    // Google no deja leer la respuesta desde otra página (no-cors): si el
    // pedido sale, el mensaje llegó; si no hay conexión, fetch falla.
    fetch(envio.accion, { method: "POST", mode: "no-cors", body: datos })
      .then(function () {
        document.dispatchEvent(new CustomEvent("mensaje:enviado", {
          detail: { nombre: nombre, sede: sede, texto: mensaje } }));
        form.reset(); cuenta.textContent = "0 / " + MAX;
        form.hidden = true; ok.hidden = false;
        ok.querySelector(".buzon__t").focus();
      })
      .catch(function () {
        enviar.disabled = false; enviar.textContent = "Enviar mensaje";
        mostrarError("No se pudo enviar (¿hay conexión?). Probá de nuevo o", true);
      });
  });
})();

/* ------------------------------------------------------------------
   Mensajes publicados al instante: la revista lee la hoja de respuestas
   del formulario (publicada en la web como CSV) y muestra, al pie de
   cada nota, los mensajes cuya columna «Nota» coincide con su título.
   Para sacar uno: borrar la fila o escribir algo en la columna
   «Ocultar». Los que tienen malas palabras no se muestran.
   ------------------------------------------------------------------ */
(function mensajesVivos() {
  "use strict";
  var sec = document.querySelector(".mensajes[data-hoja]");
  if (!sec || !window.fetch) return;
  var hoja = sec.getAttribute("data-hoja");
  var nota = sec.getAttribute("data-nota") || "";
  var titulo = sec.querySelector(".mensajes__t");
  var caja = sec.querySelector(".mensajes__caja");
  var POR_TANDA = 12;

  function normal(t) {
    return (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[«»"'¡!¿?.,:;()\-–—]/g, " ").replace(/\s+/g, " ").trim();
  }
  // Filtro básico: si aparece alguna de estas palabras, el mensaje no se
  // muestra (sigue en la hoja, a la vista del equipo docente).
  var FEAS = ["boludo", "boluda", "pelotudo", "pelotuda", "forro", "forra", "puto", "puta",
    "mierda", "concha", "pija", "verga", "culo", "idiota", "imbecil", "estupido", "estupida",
    "tarado", "tarada", "mogolico", "mogolica", "hdp", "choto", "trolo", "garca", "orto",
    "pajero", "chupala", "sorete", "cagon", "cagona", "negro de mierda", "gordo de mierda"];
  var reFea = new RegExp("(^| )(" + FEAS.join("|") + ")s?( |$)");
  function limpio(t) { return !reFea.test(normal(t)); }

  // CSV (RFC 4180): comillas, comas y saltos de línea dentro de un campo.
  function leerCSV(txt) {
    var filas = [], fila = [], campo = "", q = false;
    for (var i = 0; i < txt.length; i++) {
      var c = txt[i];
      if (q) {
        if (c === '"') { if (txt[i + 1] === '"') { campo += '"'; i++; } else q = false; }
        else campo += c;
      } else if (c === '"') q = true;
      else if (c === ",") { fila.push(campo); campo = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && txt[i + 1] === "\n") i++;
        fila.push(campo); filas.push(fila); fila = []; campo = "";
      } else campo += c;
    }
    if (campo || fila.length) { fila.push(campo); filas.push(fila); }
    return filas;
  }
  function columna(cab, prueba) {
    for (var k = 0; k < cab.length; k++) if (prueba(normal(cab[k]))) return k;
    return -1;
  }
  function fecha(t) {
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t || "");
    if (!m) return "";
    var meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
      "septiembre", "octubre", "noviembre", "diciembre"];
    return +m[1] + " de " + (meses[+m[2] - 1] || "") + " de " + m[3];
  }

  var lista = document.createElement("ul");
  lista.className = "mensajes__lista mensajes__lista--vivos";
  lista.setAttribute("aria-live", "polite");
  sec.insertBefore(lista, caja);
  var mas = document.createElement("button");
  mas.type = "button"; mas.className = "mensajes__mas"; mas.hidden = true;
  sec.insertBefore(mas, caja);
  var todos = [], mostrados = 0;

  function tarjeta(m, propio) {
    var li = document.createElement("li");
    li.className = "mensajes__item" + (propio ? " mensajes__item--propio" : "");
    var bq = document.createElement("blockquote");
    var p = document.createElement("p");
    p.textContent = m.texto;
    bq.appendChild(p);
    var a = document.createElement("p");
    a.className = "mensajes__autor";
    var b = document.createElement("b");
    b.textContent = m.nombre || "Alguien que leyó la nota";
    a.appendChild(b);
    var extra = [m.sede, propio ? "recién enviado · lo van a ver todos en unos minutos" : m.fecha]
      .filter(Boolean).join(" · ");
    if (extra) a.appendChild(document.createTextNode(" · " + extra));
    li.appendChild(bq); li.appendChild(a);
    return li;
  }
  function hayMensajes() {
    if (titulo) titulo.textContent = "Mensajes de lectores";
  }
  function pintarMas() {
    var resta = todos.length - mostrados;
    mas.hidden = resta <= 0;
    mas.textContent = "Ver " + Math.min(resta, POR_TANDA) + " mensajes más";
  }
  function mostrarTanda() {
    todos.slice(mostrados, mostrados + POR_TANDA).forEach(function (m) { lista.appendChild(tarjeta(m)); });
    mostrados = Math.min(todos.length, mostrados + POR_TANDA);
    pintarMas();
  }
  mas.addEventListener("click", mostrarTanda);

  // El mensaje propio aparece enseguida (la hoja publicada tarda en refrescarse).
  document.addEventListener("mensaje:enviado", function (e) {
    var m = e.detail || {};
    if (!m.texto || !limpio(m.texto + " " + (m.nombre || "") + " " + (m.sede || ""))) return;
    lista.insertBefore(tarjeta(m, true), lista.firstChild);
    hayMensajes();
  });

  function procesar(filas) {
    if (filas.length < 2) return;
    var cab = filas[0];
    var cNota = columna(cab, function (h) { return h === "nota"; });
    var cNom = columna(cab, function (h) { return h.indexOf("nombre") >= 0; });
    var cSede = columna(cab, function (h) { return h.indexOf("sede") >= 0 || h.indexOf("localidad") >= 0; });
    var cMsj = columna(cab, function (h) { return h.indexOf("mensaje") >= 0; });
    var cFecha = columna(cab, function (h) { return h.indexOf("marca temporal") >= 0 || h.indexOf("timestamp") >= 0; });
    var cOcultar = columna(cab, function (h) { return h.indexOf("ocultar") >= 0; });
    if (cNota < 0 || cMsj < 0) return;
    var esta = normal(nota);
    todos = filas.slice(1).filter(function (f) {
      var texto = (f[cMsj] || "").trim();
      if (!texto || normal(f[cNota]) !== esta) return false;
      if (cOcultar >= 0 && (f[cOcultar] || "").trim()) return false;
      return limpio(texto + " " + (f[cNom] || "") + " " + (f[cSede] || ""));
    }).map(function (f) {
      return { texto: f[cMsj].trim().slice(0, 1000), nombre: cNom >= 0 ? (f[cNom] || "").trim().slice(0, 80) : "",
               sede: cSede >= 0 ? (f[cSede] || "").trim().slice(0, 80) : "", fecha: cFecha >= 0 ? fecha(f[cFecha]) : "" };
    }).reverse(); // los más nuevos primero
    if (!todos.length) return;
    hayMensajes();
    mostrarTanda();
  }

  var marca = "t=" + Math.floor(Date.now() / 60000);
  function porCSV() {
    var url = hoja + (hoja.indexOf("?") < 0 ? "?" : "&") + marca;
    fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (txt) { procesar(leerCSV(txt.replace(/^﻿/, ""))); })
      .catch(function () { /* sin conexión o sin hoja: la nota se ve igual */ });
  }
  /* Las hojas de Google (enlace /gviz/tq) se leen como un script: así
     funciona también abriendo la revista desde la computadora, donde el
     navegador no deja leer la hoja con fetch. Si falla, se prueba CSV. */
  function porScript() {
    var nombre = "__revistaHoja" + Date.now();
    var hecho = false;
    var base = hoja.replace(/([?&])tqx=[^&]*/, "$1").replace(/[?&]$/, "");
    var url = base + (base.indexOf("?") < 0 ? "?" : "&") + "tqx=responseHandler:" + nombre + "&" + marca;
    var s = document.createElement("script");
    function limpiar() { try { delete window[nombre]; } catch (e) { window[nombre] = undefined; } s.remove(); }
    window[nombre] = function (r) {
      hecho = true; limpiar();
      var t = r && r.table;
      if (!t || !t.cols) return;
      var filas = [t.cols.map(function (c) { return c.label || ""; })];
      (t.rows || []).forEach(function (fila) {
        filas.push((fila.c || []).map(function (c) {
          return c ? String(c.f != null ? c.f : (c.v != null ? c.v : "")) : "";
        }));
      });
      procesar(filas);
    };
    s.onerror = function () { if (!hecho) { hecho = true; limpiar(); porCSV(); } };
    setTimeout(function () { if (!hecho) { hecho = true; limpiar(); porCSV(); } }, 9000);
    s.src = url;
    document.head.appendChild(s);
  }
  if (/\/gviz\/tq/.test(hoja)) porScript(); else porCSV();
})();
