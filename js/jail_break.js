
var renderer, scene, camera, cameraControls;
var clock = new THREE.Clock();
let camara_orbital = false;

// Configuraciones, variables, constantes etc
// .................

//longitud tamaño del plano
const L=40;
//Lista para registrar qué movimientos se hacen 
const keys ={};

// listas de los elementos que se generan en el entorno, colisiones tambn
const colliders = [];
const murosInfo =[];
const wallMeshes =[];
const waters = [];
const waterTextures =[];

// Texturas
var TEXTURA_SUELO = 'textures/suelo.jpg';
var TEXTURA_CESPED = 'textures/cesped.jpg';
var TEXTURA_LADRILLO = 'textures/ladrillo.jpg';
var TEXTURA_CAJA = 'textures/caja.jpg';
var TEXTURA_PARED = 'textures/pared.jpg';
var TEXTURA_AGUA = 'textures/agua.jpg';
var TEXTURA_MADERA = 'textures/Bark.jpg';
var TEXTURA_HOJAS = 'textures/Moss.jpg';
var TEXTURA_METAL = 'textures/metal.jpg';
// normales pra el relieve
const NORMALES ={};
NORMALES[TEXTURA_PARED] = 'textures/pared_normal.jpg';
NORMALES[TEXTURA_LADRILLO] = 'textures/ladrillo_normal.jpg';

const loaderTexturas = new THREE.TextureLoader();


//Definir el plano del patio donde se hace el juego
const PLANOS_PATIO =[
    new THREE.Plane(new THREE.Vector3(1,0,0),L),
    new THREE.Plane(new THREE.Vector3(-1,0,0),L),
    new THREE.Plane(new THREE.Vector3(0,0,1),L),
    new THREE.Plane(new THREE.Vector3(0,0,-1),L)
]

// para el personaje
const START = new THREE.Vector3(-34,0,-34); 
const pos = START.clone();
let angulo = 0, personaje = null, mixer = null, actions = {}, currentAnim = null;
const velocity = new THREE.Vector3(0, 0, 1);
const radio = 0.4, velocidad = 7, velocidad_atras=4, giro=2.6;
const gravedad=-22, impulso_salto=8.5;
let velocidad_vertical =0, en_suelo=true;
let estado = 'play' //'win' 'play' 'lose'

// cámara jugador en tercera persona
var distancia_camara = 7;
var altura_camara = 4;
var desfase_lookat_y = 1.6;
const rigidez_camara=50;
const amortiguacion_camara =14;
const vel_cam= new THREE.Vector3();
const vel_mirada = new THREE.Vector3();
const mirada = new THREE.Vector3();
const accel = new THREE.Vector3();
let camara_iniciada = false;

// colisiones con muros
const rayoCam=new THREE.Raycaster();
const cabezaJ = new THREE.Vector3();
const dirCam = new THREE.Vector3();

// reglas del juego
const TOTAL_LLAVES = 5;
const TIEMPO_TOTAL = 120;
const llaves = [];
let tiempo = TIEMPO_TOTAL;
let recogidas = 0;

// security camaras
const camarasVigilancia = [];
const raycaster = new THREE.Raycaster();


let reloj_juego = 0;
let juego_pausado=false;


// minimapa de arriba
var cameraTop;
const MARGEN_MAPA = 14;
let marcaJugador = null;
const marcasLlaves=[];

let timerMensaje = null;


// EventListener y user Interface
//...................

document.addEventListener('keydown', (event)=>{
    keys[event.code]=true;
    
    switch (event.code) {
        case 'Space':
            event.preventDefault();
            saltar();
            break;
        case 'KeyP':
            if (!event.repeat)
                cambiarPausa();
            break;
        case 'KeyC':
            if (!juego_pausado)
                cambiarCamara();
            break;
        case 'KeyR':
            if(!juego_pausado)
                reiniciar();
            break;
        case 'KeyH':
            cambiarAyuda();
            break;
    }
});

// para parar el movimiento cuando se deja de pulsar x botón
document.addEventListener('keyup', (event)=> {
    keys[event.code] = false;
});

// para la pausa, alternar estados
function cambiarPausa(){
    juego_pausado = !juego_pausado;
    if (juego_pausado !== camara_orbital) cambiarCamara();
    for (var k in keys) keys[k] = false;
    document.getElementById('pausa').style.display = juego_pausado ? 'flex' : 'none';
}

// panel de controles
function cambiarAyuda() {
    var panel = document.getElementById('ayuda')
    var btn = document.getElementById('btn-ayuda')
    var oculto = panel.style.display == 'none';
    panel.style.display = oculto? 'block': 'none';
    btn.style.display = oculto? 'none':'block';
}
document.getElementById('btn-ayuda').addEventListener('click', function (){
    cambiarAyuda();
    this.blur();
})

// Texturas, materiales, etc
//..............

// se repite la imagen por toda la primitiva
function textura_rep_imagen(ruta, repetir_x=1, repetir_y=1){
    const textura=loaderTexturas.load(ruta);
    textura.wrapS = THREE.RepeatWrapping;
    textura.wrapT = THREE.RepeatWrapping;
    textura.repeat.set(repetir_x,repetir_y);
    if ('colorSpace' in textura){textura.colorSpace = THREE.SRGBColorSpace;
    } else {textura.encoding = THREE.sRGBEncoding;}
    return textura;
}

//crear el material con la textura de arriba
function crear_material(ruta, repetir_x, repetir_y) {
    const textura = textura_rep_imagen(ruta, repetir_x,repetir_y);
    const material = new THREE.MeshStandardMaterial({map:textura});
    return material;
}

// para añadir relieve (ahora solo en suelo y en ladrillos)
function crear_material_PBR(ruta, urlNormal) {
  var n = new THREE.TextureLoader().load(urlNormal);
  n.wrapS = n.wrapT = THREE.RepeatWrapping;        
  return new THREE.MeshStandardMaterial({map: textura_rep_imagen(ruta, 1, 1),normalMap: n, 
    normalScale: new THREE.Vector2(1.8, 1.8)});
}

// Phong para el metal: ambiente + specular + diffuse 
function crear_material_Metal(repetir_x, repetir_y, color) {
    return new THREE.MeshPhongMaterial({ map: textura_rep_imagen(TEXTURA_METAL, repetir_x, repetir_y),color: color || 0xffffff,
    specular: 0x888888,shininess: 10 });
}

//para la luz de la cámara de vigilancia
function luz_camaravigilancia() {
  var color_luz_vigilancia = document.createElement('canvas');
  color_luz_vigilancia.width = color_luz_vigilancia.height = 128;
  var luz = color_luz_vigilancia.getContext('2d');
  var degradado = luz.createRadialGradient(64, 64, 10, 64, 64, 62);
  degradado.addColorStop(0,    'rgba(255,40,40,0.25)');
  degradado.addColorStop(0.75, 'rgba(83, 40, 34, 0.45)');
  degradado.addColorStop(0.92, 'rgba(228, 113, 113, 0.8)');
  degradado.addColorStop(1,    'rgba(247, 28, 28, 0.2)');
  luz.fillStyle = degradado;
  luz.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(color_luz_vigilancia);
}

// para devolver posiciones pseudoaleatorias y que el mapa sea siempre igual para la colocación de decoración,
// con decoración me refiero al musgo  y ventanas que hay en el mapa, hay que asegurarse de que
// no colisionen o se pongan cerca del agua etc
function aleatorio(semilla) {
    var numero = semilla;
    return function() {
        numero = (numero * 21 + 7) % 1000;
        return numero / 1000;};
}

// Construir el escenario y los objetos 
//..............
const ALTO_MURO = 7;
const azar = aleatorio(11);
const PROF_AGUA = 1.5;
const NIVEL_AGUA = -0.45;
const R_PLANO = 140;

// pata buscar la posición del agua y cerca del agua limitado a 1.5 unidades
function cercaAgua(x, z) {
    for (var i = 0; i < waters.length; i++) {
        var agua = waters[i];
        if (x > agua.minx - 1.5 && x < agua.maxx + 1.5 && z > agua.minz - 1.5 && z < agua.maxz + 1.5) {
            return true;
        }
    }
return false;
}

function enAgua(x, z) {
    for (var i = 0; i < waters.length; i++) {
        var agua = waters[i];
        if (x > agua.minx && x < agua.maxx && z > agua.minz && z < agua.maxz) {
            return true;
        }
    }
return false;
}

// punto random de una pared para colocar algún objeto

function enPared(m, lado, margen) {
    var t;
    var x;
    var z;
    var nx;
    var nz;
    t = (azar() - 0.5) * (Math.max(m.w, m.d) - 2 * margen);

    if (m.w > m.d) { x = m.cx + t; z = m.cz + lado * (m.d / 2 + 0.03);nx = 0;nz = lado;} 
    else {x = m.cx + lado * (m.w / 2 + 0.03);z = m.cz + t; nx = lado;nz = 0;}
    return {x: x,z: z,nx: nx,nz: nz};
}


// creat musgo opero que esté difuminado 

function crear_musgo(vertical) {
    var canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    var contexto = canvas.getContext('2d');
    var azar;
    // esto sirve para que luego cuando coloco musgo en pared o suelo pues que no parezca pegote igual
    if (vertical) {azar = aleatorio(3);} else {azar = aleatorio(5);}
    contexto.fillStyle = '#000';
    contexto.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 40; i++) {var x = 60 + azar() * 136;var y;var radio;
        if (vertical) { y = 150 + azar() * 80;} 
        else {y = 60 + azar() * 136;}
        radio = 14 + azar() * 34;
        var degradado = contexto.createRadialGradient( x, y, 0,x, y, radio);

        degradado.addColorStop(0, 'rgba(255,255,255,1)');
        degradado.addColorStop(1, 'rgba(255,255,255,0)');

        contexto.fillStyle = degradado;
        contexto.beginPath();
        contexto.arc(x, y, radio, 0, Math.PI * 2);
        contexto.fill();
    }

    var textura = new THREE.CanvasTexture(canvas);
    return textura;
}

// crear ventanas transparentes en plan reja 

function crear_ventanaRota(m) {
    var horizontal = false;
    if (m.w > m.d) {horizontal = true;}
    var largo;
    var grosor;
    if (horizontal) {largo = m.w; grosor = m.d;  } else {largo = m.d; grosor = m.w; }

    var ancho = 1.7;
    var alto = 2.4;
    var centroY = 3.3;
    var centro = (azar() - 0.5) * (largo - 5);

    scene.remove(m.mesh);
    var indice = wallMeshes.indexOf(m.mesh);
    if (indice !== -1) {
        wallMeshes.splice(indice, 1);
    }
    m.mesh.geometry.dispose();

    function reconstruir_pared(inicio, fin, abajo, arriba) {
        var medio = (inicio + fin) / 2;
        var x;
        var z;
        var anchoPared;
        var fondoPared;

        if (horizontal) { x = m.cx + medio;z = m.cz;anchoPared = fin - inicio;fondoPared = grosor;} 
        else { x = m.cx; z = m.cz + medio; anchoPared = grosor;fondoPared = fin - inicio;}

        crear_pared( x,  z,anchoPared,fondoPared,arriba - abajo, TEXTURA_PARED, {pared: true, sinColision: true,y0: abajo});
    }
    reconstruir_pared(-largo / 2, centro - ancho / 2, 0, ALTO_MURO);

    reconstruir_pared(centro + ancho / 2,largo / 2,0, ALTO_MURO);
    reconstruir_pared(
        centro - ancho / 2,
        centro + ancho / 2,
        0,
        centroY - alto / 2
    );

    reconstruir_pared(
        centro - ancho / 2,
        centro + ancho / 2,
        centroY + alto / 2,
        ALTO_MURO
    );
    var ventana = new THREE.Group();
    var xVentana = m.cx;
    var zVentana = m.cz;

    if (horizontal) {xVentana = m.cx + centro;} else {zVentana = m.cz + centro;}
    ventana.position.set(xVentana, centroY, zVentana);
    if (horizontal) { ventana.rotation.y = 0;} else {ventana.rotation.y = Math.PI / 2;}

    var metal = crear_material_Metal(1, 3, 0x777777);
    for (var i = 0; i < 5; i++) {
        var barra = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, alto, 8), metal);
        barra.position.x = (i - 2) * (ancho / 5);
        ventana.add(barra);
    }
    var barraHorizontal = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, ancho, 8),metal);

    barraHorizontal.rotation.z = Math.PI / 2;
    barraHorizontal.position.y = 0.3;
    ventana.add(barraHorizontal);
    scene.add(ventana);
}


// De musgo y ventanas elegimos zonas random sacadas con azar para que siempre estén en el mismo sitio
// se usa también la función que comprueba si está cerca del agua o no para no colocarlas ahí
function decorar_patio() {
  var textura_musgo = textura_rep_imagen(TEXTURA_HOJAS, 1, 1);
  var material_suelo = new THREE.MeshLambertMaterial({ map: textura_musgo, alphaMap: crear_musgo(false),
    color: 0xb5d08f, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  var material_pared = new THREE.MeshLambertMaterial({ map: textura_musgo, alphaMap: crear_musgo(true),
    color: 0xb5d08f, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

  murosInfo.forEach(function(m, idx) {
    var largo = Math.max(m.w, m.d);
    for (var k = 0; k < 2; k++) {
      var lado = azar() < 0.5 ? -1 : 1;
      var p = enPared(m, lado, 1);
      var tam = 2.5 + azar() * 3;
      var x = p.x + p.nx * (0.8 + azar()), z = p.z + p.nz * (0.8 + azar());
      if (cercaAgua(x, z) || Math.abs(x) > L - 1 || Math.abs(z) > L - 1) continue;
      var musgo_suelo = new THREE.Mesh(new THREE.PlaneGeometry(tam, tam), material_suelo);
      musgo_suelo.rotation.set(-Math.PI / 2, 0, azar() * 6.28);
      musgo_suelo.position.set(x, 0.03, z);
      scene.add(musgo_suelo);
    }
    if (azar() < 0.65) {
      var p2 = enPared(m, azar() < 0.5 ? -1 : 1, 1);
      var alt = 1.4 + azar() * 1.2;
      var musgo_pared = new THREE.Mesh(new THREE.PlaneGeometry(2 + azar() * 3, alt), material_pared);
      musgo_pared.position.set(p2.x + p2.nx * 0.02, alt / 2, p2.z + p2.nz * 0.02);
      musgo_pared.rotation.y = Math.atan2(p2.nx, p2.nz);
      scene.add(musgo_pared);
    }
    // para no poner venatnas en todos los muros
    if (idx % 3 === 1 && largo >= 8) crear_ventanaRota(m);
  });
}


// crear caja y añadimos en el collider para que el personaje no lo traspase

function crear_pared(cx, cz, w, d, h, ruta, opciones) {
    if (!opciones) {opciones = {};}
    var y0 = 0;
    if (opciones.y0) {y0 = opciones.y0;}

    var geometria = new THREE.BoxGeometry(w, h, d);
    var escala = 4;
    var tamanos = [
        [d, h],
        [d, h],
        [w, d],
        [w, d],
        [w, h],
        [w, h]
    ];

    var uv = geometria.attributes.uv;
    for (var cara = 0; cara < 6; cara++) {
        for (var vertice = 0; vertice < 4; vertice++) {
            var indice = cara * 4 + vertice;
            var u = uv.getX(indice);
            var v = uv.getY(indice);
            u = u * tamanos[cara][0] / escala;
            v = v * tamanos[cara][1] / escala;
            uv.setXY(indice, u, v);
        }
    }

    uv.needsUpdate = true;
    var material;
    if (NORMALES[ruta]) {material = crear_material_PBR(ruta, NORMALES[ruta]);
    } else {material = crear_material(ruta, 1, 1); }


    var pared = new THREE.Mesh(geometria, material);
    pared.position.set(cx, y0 + h / 2, cz);
    pared.castShadow = true;
    pared.receiveShadow = true;
    scene.add(pared);

    if (opciones.pared) {wallMeshes.push(pared);}
    if (!opciones.sinColision) {
        var colision = {
            minx: cx - w / 2,
            maxx: cx + w / 2,
            minz: cz - d / 2,
            maxz: cz + d / 2,
            top: y0 + h
        };

        colliders.push(colision);
        if (opciones.pared) {
            if (Math.abs(cx) < L - 0.5 &&
                Math.abs(cz) < L - 0.5) {
                murosInfo.push({
                    cx: cx,
                    cz: cz,
                    w: w,
                    d: d,
                    mesh: pared
                });}
        }
    }
    return pared;
}


// cajas dentro del agua para saltarlas
function plataforma(x, z, top) {
  var m = crear_pared(x, z, 3, 3, top + PROF_AGUA, TEXTURA_CAJA, { y0: -PROF_AGUA });
  return m;
}

function anadir_agua(cx, cz, w, d) {
  var t = textura_rep_imagen(TEXTURA_AGUA, w / 4, d / 4);
  if (!waterTextures.includes(t)) {
    waterTextures.push(t);
  }
  var m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshPhongMaterial({ map: t, color: 0xbfe6ff, transparent: true, opacity: 0.82, specular: 0xffffff, shininess: 90 })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(cx, NIVEL_AGUA, cz);
  scene.add(m);
  var pozo = new THREE.Mesh(
    new THREE.BoxGeometry(w, PROF_AGUA, d),
    new THREE.MeshLambertMaterial({ map: textura_rep_imagen(TEXTURA_SUELO, Math.max(w, d) / 8, 1), color: 0x666666, side: THREE.BackSide })
  );
  pozo.position.set(cx, -PROF_AGUA / 2, cz);
  pozo.receiveShadow = true;
  scene.add(pozo);
  waters.push({ minx: cx - w / 2, maxx: cx + w / 2, minz: cz - d / 2, maxz: cz + d / 2 });
}

// para el exterior que no está en la carcel y dar un poco de realidad
function anadir_profundidad(x, z) {
  var r = Math.sqrt(x * x + z * z);
  var t = THREE.MathUtils.clamp((r - R_PLANO) / 420, 0, 1);
  t = t * t * (3 - 2 * t);
  return t;
}

function crear_exterior() {
  var forma = new THREE.Shape();
  forma.absarc(0, 0, R_PLANO, 0, Math.PI * 2, false);
  var hueco = new THREE.Path();
  hueco.moveTo(-L, -L); hueco.lineTo(L, -L); hueco.lineTo(L, L); hueco.lineTo(-L, L); hueco.closePath();
  forma.holes.push(hueco);
  var disco = new THREE.Mesh(new THREE.ShapeGeometry(forma, 64), crear_material(TEXTURA_CESPED, 1 / 8, 1 / 8));
  disco.rotation.x = -Math.PI / 2;
  disco.position.y = -0.05;
  disco.receiveShadow = true;
  scene.add(disco);
  var g = new THREE.RingGeometry(R_PLANO - 4, 1500, 128, 60);
  g.rotateX(-Math.PI / 2);
  var p = g.attributes.position, uv = g.attributes.uv, col = [];
  for (var i = 0; i < p.count; i++) {
    var x = p.getX(i), z = p.getZ(i);
    p.setY(i, anadir_profundidad(x, z));
    uv.setXY(i, x / 8, z / 8);
    var n = 0.5 + 0.5 * Math.sin(x * 0.02) * Math.sin(z * 0.017 + 1);
    var v = 0.62 + 0.42 * n;
    col.push(v * 0.85, v, v * 0.7);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  var anillo = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: textura_rep_imagen(TEXTURA_CESPED, 1, 1), vertexColors: true }));
  anillo.receiveShadow = true;
  scene.add(anillo);
}

// cuatro torres en las eaquinas del terreno
function crear_torres() {
  var e = L + 2.6; // 40 + 2.6
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function(s) {
    var t = new THREE.Group();
    t.position.set(s[0] * e, 0, s[1] * e);
    function caja(w, h, d, material, y) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      m.position.y = y;
      t.add(m);
      return m;
    }
    caja(4.4, 1.2, 4.4, crear_material(TEXTURA_PARED, 1, 1), 0.6);
    caja(3.4, 11, 3.4, crear_material(TEXTURA_LADRILLO, 1, 3), 5.5);
    caja(6.6, 0.35, 6.6, crear_material_Metal(2, 2, 0x777777), 11.1);
    caja(5.6, 3.2, 5.6, crear_material(TEXTURA_PARED, 2, 1), 12.8);
    var techo = new THREE.Mesh(new THREE.ConeGeometry(4.6, 2.2, 4), crear_material_Metal(1, 1, 0x555555));
    techo.rotation.y = Math.PI / 4;
    techo.position.y = 15.5;
    t.add(techo);
    t.traverse(function(o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(t);
  });
}

// árboles para el exterior
function crear_arboles() {
  var azarArbol = aleatorio(5);
  var tronco = new THREE.MeshLambertMaterial({ map: textura_rep_imagen(TEXTURA_MADERA, 1, 2) });
  var hojas = new THREE.MeshLambertMaterial({map: textura_rep_imagen(TEXTURA_HOJAS, 3, 2) });
  var cilindro_tronco = new THREE.CylinderGeometry(0.45, 0.7, 5, 6);
  cilindro_tronco.translate(0, 2.5, 0);
  var copa_arbol_abajo = new THREE.ConeGeometry(3.6, 8, 7);
  copa_arbol_abajo.translate(0, 8, 0);
  var copa_arriba_arbol = new THREE.ConeGeometry(2.6, 7, 7);
  copa_arriba_arbol.translate(0, 12.5, 0);

  for (var i = 0; i < 90; i++) {
    var angulo = azarArbol() * Math.PI * 2;
    var radio = 80 + azarArbol() * 420;
    var x = Math.cos(angulo) * radio;
    var z = Math.sin(angulo) * radio;

    var arbol = new THREE.Group();
    arbol.add(
      new THREE.Mesh(cilindro_tronco, tronco),
      new THREE.Mesh(copa_arbol_abajo, hojas),
      new THREE.Mesh(copa_arriba_arbol, hojas)
    );
    arbol.position.set(x, anadir_profundidad(x, z), z);
    arbol.rotation.y = azarArbol() * Math.PI * 2;
    scene.add(arbol);
  }
  var arbusto_forma = new THREE.IcosahedronGeometry(1.2, 0);
  var arbusto_material = new THREE.MeshLambertMaterial({
    map: textura_rep_imagen(TEXTURA_HOJAS, 2, 2),
    color: 0xb5d08f
  });
  for (var k = 0; k < 40; k++) {
    var t = (azarArbol() - 0.5) * 2 * (L + 12);
    var fuera = L + 13 + azarArbol() * 5;
    var lado = [[t, -fuera], [t, fuera], [-fuera, t], [fuera, t]][k % 4];

    var arbusto = new THREE.Mesh(arbusto_forma, arbusto_material);
    arbusto.position.set(lado[0], 0.6, lado[1]);
    arbusto.scale.set(0.8 + azarArbol(), 0.6 + azarArbol() * 0.6, 0.8 + azarArbol());
    scene.add(arbusto);
  }
}

// suelo principal y se elige sitios aleatorios con huecos para el agua
function crear_suelo() {
  var forma = new THREE.Shape();
  forma.moveTo(-L, -L); forma.lineTo(L, -L); forma.lineTo(L, L); forma.lineTo(-L, L); forma.closePath();
  waters.forEach(w => {
    var agujero = new THREE.Path();
    agujero.moveTo(w.minx, -w.minz); agujero.lineTo(w.maxx, -w.minz);
    agujero.lineTo(w.maxx, -w.maxz); agujero.lineTo(w.minx, -w.maxz); agujero.closePath();
    forma.holes.push(agujero);
  });
  var suelo = new THREE.Mesh(new THREE.ShapeGeometry(forma), crear_material(TEXTURA_SUELO, 1 / 8, 1 / 8));
  suelo.rotation.x = -Math.PI / 2;
  suelo.receiveShadow = true;
  scene.add(suelo);
}

//llaves
function anadir_llaves(x, y, z) {
  var llave = new THREE.Group();
  var oro = new THREE.MeshLambertMaterial({ color: 0xffd23a, emissive: 0x6a5000 });
  var aro = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 8, 16), oro);
  var cuerpo = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.1), oro); cuerpo.position.y = -0.55;
  var diente = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.1), oro); diente.position.set(0.15, -0.75, 0);
  llave.add(aro, cuerpo, diente);
  llave.position.set(x, y + 1.3, z);
  scene.add(llave);
  llaves.push({ mesh: llave, y: y, got: false });
}

// camara de vigilancia
function anadir_camaravigilancia(x, z, base, amp, vel) {
  var altura = 5, pitch = 0.7, fov = 0.36;
  var pivote = altura + 0.3;
  var apexF = 0.55 * Math.cos(pitch);
  var apexH = pivote - 0.55 * Math.sin(pitch);
  var haz_luz = apexH / Math.sin(pitch);
  var r = haz_luz * Math.tan(fov);
  var D = apexF + apexH / Math.tan(pitch);
  var luz_ancho = 1 / Math.sin(pitch);
  var base_placa = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.1, 16), crear_material_Metal(1, 1, 0x888888));
  base_placa.position.set(x, 0.05, z);
  var poste = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, altura, 12), crear_material_Metal(1, 3, 0x999999));
  poste.position.set(x, altura / 2, z);
  var brida = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 16), crear_material_Metal(1, 1, 0x777777));
  brida.position.set(x, altura - 0.06, z);
  scene.add(base_placa, poste, brida);
  var aux = new THREE.Group();
  aux.position.set(x, altura, z);
  scene.add(aux);
  var cuello = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 12), crear_material_Metal(1, 1, 0x666666));
  cuello.position.y = 0.15;
  aux.add(cuello);
  var pitchG = new THREE.Group();
  pitchG.position.y = 0.3;
  pitchG.rotation.x = pitch;
  aux.add(pitchG);
  var cuerpo = new THREE.CylinderGeometry(0.22, 0.22, 1.0, 20);
  cuerpo.rotateX(Math.PI / 2);
  pitchG.add(new THREE.Mesh(cuerpo, crear_material_Metal(1, 1, 0xb0b0b0)));
  var geoAro = new THREE.CylinderGeometry(0.2, 0.2, 0.08, 20);
  geoAro.rotateX(Math.PI / 2);
  var aro = new THREE.Mesh(geoAro, new THREE.MeshPhongMaterial({ color: 0x111111, shininess: 100 }));
  aro.position.z = 0.52;
  pitchG.add(aro);
  var vision = new THREE.CylinderGeometry(0.14, 0.14, 0.04, 20);
  vision.rotateX(Math.PI / 2);
  var cono_luz = new THREE.ConeGeometry(r, haz_luz, 28, 1, true);
  cono_luz.translate(0, -haz_luz / 2, 0);
  cono_luz.rotateX(-Math.PI / 2);
  var cono = new THREE.Mesh(cono_luz, new THREE.MeshBasicMaterial({
    color: 0xff2020, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, clippingPlanes: PLANOS_PATIO }));
  cono.position.z = 0.55;
  pitchG.add(cono);
  var lucecita = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshBasicMaterial({
    map: luz_camaravigilancia(), transparent: true, depthWrite: false, clippingPlanes: PLANOS_PATIO, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  lucecita.rotation.x = -Math.PI / 2;
  lucecita.scale.y = luz_ancho;
  lucecita.position.set(0, 0.06 - altura, D);
  aux.add(lucecita);
  camarasVigilancia.push({ x: x, z: z, base: base, amp: amp, vel: vel, a: base,
                           cabeza: aux, D: D, semiA: r * luz_ancho, semiB: r });
}

// minimapa
function crear_minimapa() {
  var minimap = L + 3;
  cameraTop = new THREE.OrthographicCamera(-minimap, minimap, minimap, -minimap, 1, 200);
  cameraTop.up.set(0, 0, -1);
  cameraTop.position.set(0, 80, 0);
  cameraTop.lookAt(0, 0, 0);
  cameraTop.layers.enable(1);
  function marca(geo, color) {
    var mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: color }));
    mesh.layers.set(1);
    scene.add(mesh);
    return mesh;
  }
  function circulo(r) {
    var circu = new THREE.CircleGeometry(r, 20);
    circu.rotateX(-Math.PI / 2);
    return circu;
  }
  var flecha = new THREE.ConeGeometry(1.7, 4.2, 3);
  flecha.rotateX(Math.PI / 2);
  marcaJugador = marca(flecha, 0x35e0ff);
  llaves.forEach(function(k) {
    var auxiliar = marca(circulo(1.5), 0xffd23a);
    auxiliar.position.set(k.mesh.position.x, 20, k.mesh.position.z);
    marcasLlaves.push(auxiliar);
  });
  camarasVigilancia.forEach(function(c) {
    var a = marca(circulo(1.3), 0xff3030);
    a.position.set(c.x, 20, c.z);
  });
}

// pPersonaje y animación
// ......................

// para eliminar cualquier movimiento raro como cuando anda que no retroceda etc, la idea es quitar el movimiento del eje y y quedarnos con el x y z
function quitarmovimientosobrante(c) {
  c.tracks.forEach(function(track) {
    if (!/hips\.position$/i.test(track.name)) return;
    var valores = track.values;
    for (var i = 3; i < valores.length; i += 3) {
        valores[i] = valores[0];
        valores[i + 2] = valores[2];
    }
  });
}

function cambiar_animacion(nombre) {
  if (!mixer || !actions[nombre] || currentAnim === nombre) return;
  var anterior = currentAnim ? actions[currentAnim] : null;
  var anim = actions[nombre];
  anim.reset(); anim.play();
  if (anterior) anterior.crossFadeTo(anim, 0.15, false);
  else anim.fadeIn(0.15);
  currentAnim = nombre;
}

//para cambiar la posicion que corresponda
function actualizar_animacion(avance) {
  if (!mixer) return;
  if (!en_suelo) cambiar_animacion('jump');
  else if (Math.abs(avance) > 0.1) {
    if (actions.walk) actions.walk.timeScale = 0.5 + Math.abs(avance) / 14;
    cambiar_animacion('walk');
  } else cambiar_animacion('idle');
}

function cargarModeloJugador() {
  var loader = new THREE.FBXLoader();
  loader.load('models/Prisoner B Styperek.fbx', function(obj) {
    personaje = obj;
    var caja = new THREE.Box3().setFromObject(personaje);
    var alto = caja.max.y - caja.min.y;
    personaje.scale.setScalar(1.8 / alto);

    personaje.traverse(function(c) {
      if (c.isMesh) { c.frustumCulled = false; c.castShadow = true; }
    });

    personaje.position.copy(pos);
    scene.add(personaje);
    mixer = new THREE.AnimationMixer(personaje);

    function un_clip_deanim(ruta, nombre, unaVez, quitarDesp) {
      loader.load(ruta, function(d) {
        var c = d.animations[0];
        if (quitarDesp) quitarmovimientosobrante(c);
        var auxiliar = mixer.clipAction(c);
        auxiliar.loop = unaVez ? THREE.LoopOnce : THREE.LoopRepeat;
        auxiliar.clampWhenFinished = unaVez;
        actions[nombre] = auxiliar;
        if (nombre === 'idle') cambiar_animacion('idle');
      });
    }
    un_clip_deanim('models/Slow Run.fbx', 'walk', false, true);
    un_clip_deanim('models/Standing Idle.fbx', 'idle', false, false);
    un_clip_deanim('models/Jump.fbx', 'jump', true, true);
    un_clip_deanim('models/Defeat.fbx', 'defeat', true, true);
    un_clip_deanim('models/Falling Down.fbx', 'fall', true, true);
    un_clip_deanim('models/Victory.fbx', 'victory', true, true);
  }, undefined, function(err) { console.error('Error cargando el FBX:', err); });
}

// Para evitar colisiones
function bloqueado(x, z, y) {
  return colliders.some(b => x + radio > b.minx && x - radio < b.maxx &&
    z + radio > b.minz && z - radio < b.maxz && y < b.top - 0.4);
}

// para que no flote si hay altura etc
function altura_suelo(x, z, y) {
  var h = enAgua(x, z) ? -PROF_AGUA : 0;
  colliders.forEach(collide => {
    if (x + 0.2 > collide.minx && x - 0.2 < collide.maxx && z + 0.2 > collide.minz && z - 0.2 < collide.maxz && collide.top <= y + 0.5)
      h = Math.max(h, collide.top);
  });
  return h;
}

function saltar() {
  if (estado !== 'play' || !en_suelo) return;
  velocidad_vertical = impulso_salto; 
  en_suelo = false;
}

// camara
// ...................

function resorte(actual, vel, objetivo, dt) {
  accel.copy(objetivo).sub(actual).multiplyScalar(rigidez_camara)
       .addScaledVector(vel, -amortiguacion_camara);
  vel.addScaledVector(accel, dt);
  actual.addScaledVector(vel, dt);
}

// para que no traspase muros
function acercar_con_muro(cerca) {
  cabezaJ.set(pos.x, pos.y + 1.6, pos.z);
  dirCam.copy(cerca).sub(cabezaJ);
  var dir = dirCam.length();
  if (dir < 0.01) return false;
  rayoCam.set(cabezaJ, dirCam.normalize());
  rayoCam.far = dir;
  var hit = rayoCam.intersectObjects(wallMeshes, false);
  if (hit.length === 0) return false;
  cerca.copy(cabezaJ).addScaledVector(dirCam, Math.max(hit[0].distance - 0.4, 0.6));
  return true;
}

// en tercera persona
function updateCamera(dt) {
  var obj = new THREE.Vector3(pos.x - Math.sin(angulo) * distancia_camara,
                              pos.y + altura_camara,
                              pos.z - Math.cos(angulo) * distancia_camara);
  obj.x = THREE.MathUtils.clamp(obj.x, -L + 0.5, L - 0.5);
  obj.z = THREE.MathUtils.clamp(obj.z, -L + 0.5, L - 0.5);
  acercar_con_muro(obj);
  var mirar = new THREE.Vector3(pos.x, pos.y + desfase_lookat_y, pos.z);
  if (!camara_iniciada) {
    camera.position.copy(obj); mirada.copy(mirar);
    vel_cam.set(0, 0, 0); vel_mirada.set(0, 0, 0);
    camara_iniciada = true;
  } else {
    resorte(camera.position, vel_cam, obj, dt);
    resorte(mirada, vel_mirada, mirar, dt);
    if (acercar_con_muro(camera.position)) vel_cam.set(0, 0, 0);   
  }
  camera.lookAt(mirada);
}

function cambiarCamara() {
  camara_orbital = !camara_orbital;
  cameraControls.enabled = camara_orbital;
  if (camara_orbital) { cameraControls.target.copy(pos); cameraControls.update(); }
  else camara_iniciada = false;
}

function visto_camara(c) {
    var seno = Math.sin(c.a); coseno = Math.cos(c.a);
    var dx = pos.x - c.x; dz = pos.z - c.z;
    var delante = dx * seno + dz * coseno - c.D;
    var lateral = dx * coseno - dz * seno;
    var a = delante / c.semiA;
    var b = lateral / c.semiB;

    if (a * a + b * b > 1) {
        return false;
    }
    var origen = c.cabeza.position.clone();
    var destino = new THREE.Vector3(
        pos.x,
        pos.y + 1.2,
        pos.z
    );

    var direccion = destino.sub(origen);
    var distancia = direccion.length();
    direccion.normalize();
    raycaster.set(origen, direccion);
    raycaster.far = distancia;

    var impactos = raycaster.intersectObjects(wallMeshes, false);

    if (impactos.length > 0) {
        return false;
    }
    return true;
}



// lógica del juego, HUD, etc
// ..................

function terminar(res, titulo, sub, anim, retardo) {
  estado = res;
  if (anim) cambiar_animacion(anim);
  document.getElementById('titulo_mensaje').textContent = titulo;
  document.getElementById('subtitulo_mensaje').textContent = sub + ' — pulsa R para reintentar';
  clearTimeout(timerMensaje);
  timerMensaje = setTimeout(function() {
    document.getElementById('mensaje').style.display = 'flex';
  }, retardo || 0);
}

function reiniciar() {
  clearTimeout(timerMensaje);
  pos.copy(START); angulo = 0; velocidad_vertical = 0; en_suelo = true;
  tiempo = TIEMPO_TOTAL; recogidas = 0; estado = 'play'; camara_iniciada = false;
  llaves.forEach(k => { k.got = false; k.mesh.visible = true; });
  document.getElementById('mensaje').style.display = 'none';
  cambiar_animacion('idle');
}

function actualizarHUD() {
  var act = document.getElementById('hud-tiempo');
  act.textContent = 'Tiempo: ' + Math.ceil(Math.max(tiempo, 0));
  act.className = tiempo < 20 ? 'peligro' : '';
  document.getElementById('hud-llaves').textContent = 'Llaves: ' + recogidas + ' / ' + TOTAL_LLAVES;
}


// INITS; LOAD_SCENE UPDATE ETC

function init() {
  renderer = new THREE.WebGLRenderer();
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.localClippingEnabled = true;
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('container_game').appendChild(renderer.domElement);
  
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xaebfca);
  scene.fog = new THREE.Fog(0xaebfca, 160, 900);
  scene.add(new THREE.HemisphereLight(0xdbe9ff, 0x6a6a52, 0.8)); 

  var sol = new THREE.DirectionalLight(0xfff0d8, 0.7);            
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  var sc = sol.shadow.camera;
  sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 1; sc.far = 200;
  sol.shadow.bias = -0.0005;
  sol.position.set(30, 50, 20);
  scene.add(sol);

  camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 2000);
  camera.position.set(-20, 15, -20);
  cameraControls = new THREE.OrbitControls(camera, renderer.domElement);
  cameraControls.target.set(-34, 1, -34);
  cameraControls.enabled = camara_orbital;

  cameraControls.enablePan = false;                 
  cameraControls.minDistance = 6;                   
  cameraControls.maxDistance = 90;                  
  cameraControls.minPolarAngle = 0.15;              
  cameraControls.maxPolarAngle = Math.PI / 2 - 0.08; 

  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  });
}

function loadScene() {
  crear_exterior();
  crear_arboles();

  // Muralla exterior de la prisión
  crear_pared(0, -L - 1, L * 2 + 4, 2, 7, TEXTURA_LADRILLO, { pared: true });
  crear_pared(0,  L + 1, L * 2 + 4, 2, 7, TEXTURA_LADRILLO, { pared: true });
  crear_pared(-L - 1, 0, 2, L * 2, 7, TEXTURA_LADRILLO, { pared: true });
  crear_pared( L + 1, 0, 2, L * 2, 7, TEXTURA_LADRILLO, { pared: true });
  crear_torres();

  var ALTO_PARED = 7;
  var V = [   
    [-30,25,2,10],
    [-20,-10,2,20],[-20,35,2,10],
    [-10,-30,2,20],[-10,0,2,20],[-10,25,2,10],
    [0,-15,2,10],[0,10,2,20],[0,35,2,10],
    [10,20,2,20],
    [20,-20,2,20],[20,5,2,10],[20,30,2,20]
  ];
  var H = [   
    [-30,-30,20,2],[5,-30,10,2],[25,-30,10,2],
    [-20,-20,20,2],[15,-20,10,2],[35,-20,10,2],
    [-35,-10,10,2],[0,-10,20,2],[25,-10,10,2],
    [-25,0,10,2],[10,0,20,2],[35,0,10,2],
    [-30,10,20,2],[25,10,10,2],
    [-15,20,30,2],[35,20,10,2],
    [5,30,10,2],[25,30,10,2]
  ];

  H.forEach(h => {
    var x0 = h[0] - h[2] / 2, x1 = h[0] + h[2] / 2;
    if (x0 > -L + 0.1) x0 -= 1;
    if (x1 <  L - 0.1) x1 += 1;
    crear_pared((x0 + x1) / 2, h[1], x1 - x0, h[3], ALTO_PARED, TEXTURA_PARED, { pared: true });
  });

  V.forEach(v => {
    var minz = v[1] - v[3] / 2, maxz = v[1] + v[3] / 2;
    H.forEach(h => {
      var solapaX = Math.abs(v[0] - h[0]) < (v[2] + h[2]) / 2;
      var hminz = h[1] - h[3] / 2, hmaxz = h[1] + h[3] / 2;
      if (!solapaX || hminz >= maxz || hmaxz <= minz) return;
      if (hminz <= minz) minz = hmaxz;        
      else if (hmaxz >= maxz) maxz = hminz;   
    });
    if (maxz - minz > 0.1)
      crear_pared(v[0], (minz + maxz) / 2, v[2], maxz - minz, ALTO_PARED, TEXTURA_PARED, { pared: true });
  });

  anadir_agua(-25, -25, 9, 8);
  plataforma(-28, -25, 0.8);
  plataforma(-22, -25, 0.8);

  anadir_agua(-20, 25, 14, 8);
  plataforma(-25, 25, 0.8);
  plataforma(-20, 25, 1.2);
  plataforma(-15, 25, 0.8);

  anadir_agua(5, 14, 8, 9);
  plataforma(5, 11, 0.8);
  plataforma(5, 17, 0.8);

  crear_suelo();
  decorar_patio();

  [[-25,-35.5,2,9],[5,-35.5,2,9],[25,-35.5,2,9]]
    .forEach(b => crear_pared(b[0], b[1], b[2], b[3], 1, TEXTURA_CAJA));

  anadir_llaves(-35, 0, -5);
  anadir_llaves(35, 0, -25);
  anadir_llaves(5, 1.2, 17);
  anadir_llaves(-20, 1.2, 25);   
  anadir_llaves(35, 0, 35);

  anadir_camaravigilancia(-12, -39, -Math.PI / 2, 0.35, 1.2);  
  anadir_camaravigilancia(-38, -26,  Math.PI / 2, 0.35, 1.0);  
  anadir_camaravigilancia(5, 2,      0,           0.35, 1.3);  
  anadir_camaravigilancia(-27, 33,   Math.PI,     0.35, 1.1);  
  
  crear_minimapa();
  cargarModeloJugador();
}

function update() {
  var dt = Math.min(clock.getDelta(), 0.05);
  if (juego_pausado) { cameraControls.update(); return; }
  reloj_juego += dt;

  camarasVigilancia.forEach(c_actual => {
    // para que haga movimiento oscilante uso el seno
    c_actual.a = c_actual.base + Math.sin(reloj_juego * c_actual.vel) * c_actual.amp;
    c_actual.cabeza.rotation.y = c_actual.a;
  });

  waterTextures.forEach(t => { t.offset.x += dt * 0.05; t.offset.y += dt * 0.03; });
  if (mixer) mixer.update(dt);

  if (estado === 'play') {
    if (keys.KeyA || keys.ArrowLeft)  angulo += giro * dt;
    if (keys.KeyD || keys.ArrowRight) angulo -= giro * dt;
    velocity.set(Math.sin(angulo), 0, Math.cos(angulo));

    var avance = 0;
    if (keys.KeyW || keys.ArrowUp)  avance = velocidad;
    if (keys.KeyS || keys.ArrowDown) avance = -velocidad_atras;

    var nx = THREE.MathUtils.clamp(pos.x + velocity.x * avance * dt, -L + radio, L - radio);
    var nz = THREE.MathUtils.clamp(pos.z + velocity.z * avance * dt, -L + radio, L - radio);
    if (!bloqueado(nx, pos.z, pos.y)) pos.x = nx;
    if (!bloqueado(pos.x, nz, pos.y)) pos.z = nz;

    velocidad_vertical += gravedad * dt;
    pos.y += velocidad_vertical * dt;
    var suelo = altura_suelo(pos.x, pos.z, pos.y);
    if (pos.y <= suelo) { pos.y = suelo; velocidad_vertical = 0; en_suelo = true; }
    else en_suelo = false;

    tiempo -= dt;
    if (tiempo <= 0 && estado === 'play')
      terminar('lose', 'Tiempo agotado', 'Has tardado demasiado y te han pillado...', 'defeat', 2500);

    if (estado === 'play' && pos.y < -0.5 && enAgua(pos.x, pos.z))
      terminar('lose', 'Oh ohhh te has caído al agua', 'La corriente te ha llevado', 'fall', 2200);
    llaves.forEach(k => {
      if (k.got) return;
      var dx = k.mesh.position.x - pos.x, dz = k.mesh.position.z - pos.z;
      if (dx * dx + dz * dz < 1.4 && Math.abs(pos.y - k.y) < 2) {
        k.got = true; k.mesh.visible = false; recogidas++;
        if (recogidas === TOTAL_LLAVES)
          terminar('win', '¡Has conseguido escapar!', 'Enhorabuena (ya era hora)', 'victory', 3000);
      }
    });

    actualizarHUD();
    if (estado === 'play' && camarasVigilancia.some(visto_camara))
      terminar('lose', '¡Te han pillado!', 'Has sido visto por una cámara', 'defeat', 2500);
    
    if (estado === 'play') actualizar_animacion(avance);
  } 
      
  if (personaje) { personaje.position.copy(pos); personaje.rotation.y = angulo; }
  if (marcaJugador) {
    marcaJugador.position.set(pos.x, 20, pos.z);
    marcaJugador.rotation.y = angulo;
  }
  marcasLlaves.forEach(function(p, i) { p.visible = !llaves[i].got; });
  if (camara_orbital) cameraControls.update(); else updateCamera(dt);
}


function dibujar_minimapa() {
  var ds = Math.min(innerWidth, innerHeight) / 4;      
  var x = innerWidth - ds - MARGEN_MAPA;               
  var y = innerHeight - ds - MARGEN_MAPA;

  var fondo = scene.background;
  scene.background = null;                                           
  renderer.setViewport(x, y, ds, ds);
  renderer.setScissor(x, y, ds, ds);
  renderer.setScissorTest(true);
  renderer.setClearColor(0x1b1f24, 1);
  renderer.clear();
  renderer.render(scene, cameraTop);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, innerWidth, innerHeight);
  scene.background = fondo;
}

function render() {
  requestAnimationFrame(render);
  update();
  renderer.autoClear = false;
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, innerWidth, innerHeight);
  renderer.clear();
  renderer.render(scene, camera);

  dibujar_minimapa();
}

init(); 
loadScene(); 
render();
