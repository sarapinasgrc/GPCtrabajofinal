let homeRender,homeEscena, homeCamara, homeMixer = null;
const homeClock = new THREE.Clock();


// para que aparezca el personaje solo quiero movimiento mirando para lados
function iniciarHome() {
    //personaje
    var cont = document.getElementById('vista-personaje');
    homeRender = new THREE.WebGLRenderer();
    homeRender.outputEncoding = THREE.sRGBEncoding;
    cont.appendChild(homeRender.domElement);
    //camara
    homeEscena = new THREE.Scene();
    homeCamara = new THREE.PerspectiveCamera(28,1,0.1,100);
    homeCamara.position.set(0.4,1.45,1.5);
    homeCamara.lookAt(0,1.30,0);

    homeEscena.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));

    var luz = new THREE.DirectionalLight(0xfff1d6, 1.2);
    luz.position.set(2,4,3);
    homeEscena.add(luz);

    const w = cont.clientWidth;
    const h = cont.clientHeight;

    homeRender.setSize(w, h, false);
    homeCamara.aspect = w / h;
    homeCamara.updateProjectionMatrix();

    // porsi la ventana de otro ordenador es mas grande o pequeña, que se reajuste
    window.addEventListener('resize', () => {
        const w = cont.clientWidth;
        const h = cont.clientHeight;

        homeRender.setSize(w, h, false);
        homeCamara.aspect = w / h;
        homeCamara.updateProjectionMatrix();
    });

    const loader = new THREE.FBXLoader();
    loader.load('models/Prisoner%20B%20Styperek.fbx', function(obj) {
        // y para que solo salga la cadera para arriba
        const caja = new THREE.Box3().setFromObject(obj);
        const alto = caja.max.y - caja.min.y || 1;
        obj.scale.setScalar(1.9 / alto);obj.position.y = -0.2;obj.rotation.y = Math.PI * 0.15;
        obj.traverse(function(c) {
            if (c.isMesh) c.frustumCulled = false;
        });

        homeEscena.add(obj);
        homeMixer = new THREE.AnimationMixer(obj);
        // y el movimiento
        loader.load('models/Looking%20Around.fbx', function(d) {
            const anim = d.animations[0];
            if (anim) homeMixer.clipAction(anim).play();
        });

    });
    // para dejar el movimiento en bucle y no pare
    (function bucle(){
        requestAnimationFrame(bucle);
        if (homeMixer) homeMixer.update(homeClock.getDelta());
        homeRender.render(homeEscena,homeCamara);
    })();
}

iniciarHome();