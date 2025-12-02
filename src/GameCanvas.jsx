import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const StressBombGame = () => {
  const mountRef = useRef(null);
  const cursorRef = useRef(null);
  const powerBarRef = useRef(null);
  const powerWrapperRef = useRef(null);
  
  // React State
  const [score, setScore] = useState(0);
  const [weaponType, setWeaponType] = useState('bomb');
  const [isReloading, setIsReloading] = useState(false);

  // Game Logic Ref
  const game = useRef({
    scene: null, camera: null, renderer: null,
    projectiles: [], shapes: [], fragments: [], particles: [], monoliths: [], // Added monoliths
    active: true,
    isHolding: false,
    isReloading: false,
    reloadTimer: 0,
    power: 0,
    mouse: new THREE.Vector2(),
    idleProjectile: null,
    audioCtx: null,
    shakeStrength: 0
  });

  // --- PALETTE ---
  const COLORS = [
      0x116DD2, 0x1642BF, 0x000082, 
      0xF0B400, 0xFCCA0C, 0xF9E07E  
  ];

  // Handle Weapon Switching
  useEffect(() => {
      const state = game.current;
      if (state.scene && !state.isHolding && !state.isReloading) {
          if (state.idleProjectile) state.scene.remove(state.idleProjectile);
          state.isReloading = true; 
          state.reloadTimer = 0.4; 
      }
  }, [weaponType]);

  useEffect(() => {
    if (mountRef.current) mountRef.current.innerHTML = '';

    const state = game.current;
    let frameId;

    // --- AUDIO SYSTEM ---
    const initAudio = () => {
        try { state.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } 
        catch (e) { console.warn("Audio not supported"); }
    };

    const playSound = (type) => {
        if (!state.audioCtx) return;
        if (state.audioCtx.state === 'suspended') state.audioCtx.resume();
        const t = state.audioCtx.currentTime;
        const gain = state.audioCtx.createGain();
        gain.connect(state.audioCtx.destination);

        if (type === 'launch') {
            const osc = state.audioCtx.createOscillator();
            osc.connect(gain);
            osc.frequency.setValueAtTime(600, t);
            osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
            gain.gain.setValueAtTime(0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
            osc.start(t); osc.stop(t + 0.1);
        }
        else if (type === 'throw') {
            const osc = state.audioCtx.createOscillator();
            osc.connect(gain);
            osc.frequency.setValueAtTime(200, t);
            osc.frequency.exponentialRampToValueAtTime(50, t + 0.2);
            gain.gain.setValueAtTime(0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
            osc.start(t); osc.stop(t + 0.2);
        }
        else if (type === 'explode') {
            const osc = state.audioCtx.createOscillator();
            osc.connect(gain);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(80, t); 
            osc.frequency.exponentialRampToValueAtTime(10, t + 0.5); 
            gain.gain.setValueAtTime(1.0, t); 
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.8);
            osc.start(t); osc.stop(t + 0.8);

            const noiseOsc = state.audioCtx.createOscillator();
            const noiseGain = state.audioCtx.createGain();
            noiseOsc.type = 'sawtooth';
            noiseOsc.frequency.setValueAtTime(100, t);
            noiseOsc.frequency.linearRampToValueAtTime(0, t+0.1);
            noiseOsc.connect(noiseGain);
            noiseGain.connect(state.audioCtx.destination);
            noiseGain.gain.setValueAtTime(0.5, t);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, t+0.1);
            noiseOsc.start(t); noiseOsc.stop(t+0.1);
        }
        else if (type === 'thunk') {
            const oscClick = state.audioCtx.createOscillator();
            const gainClick = state.audioCtx.createGain();
            oscClick.type = 'triangle'; 
            oscClick.connect(gainClick);
            gainClick.connect(state.audioCtx.destination);
            oscClick.frequency.setValueAtTime(800, t); 
            oscClick.frequency.exponentialRampToValueAtTime(100, t + 0.05);
            gainClick.gain.setValueAtTime(0.4, t);
            gainClick.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
            oscClick.start(t); oscClick.stop(t + 0.05);

            const oscThud = state.audioCtx.createOscillator();
            const gainThud = state.audioCtx.createGain();
            oscThud.type = 'sine'; 
            oscThud.connect(gainThud);
            gainThud.connect(state.audioCtx.destination);
            oscThud.frequency.setValueAtTime(150, t);
            oscThud.frequency.exponentialRampToValueAtTime(100, t + 0.15);
            gainThud.gain.setValueAtTime(0.8, t);
            gainThud.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
            oscThud.start(t); oscThud.stop(t + 0.15);
        }
        else if (type === 'reload') {
            const osc = state.audioCtx.createOscillator();
            osc.connect(gain);
            osc.frequency.setValueAtTime(300, t);
            osc.frequency.linearRampToValueAtTime(600, t + 0.2);
            gain.gain.setValueAtTime(0.0, t);
            gain.gain.linearRampToValueAtTime(0.1, t + 0.1);
            gain.gain.linearRampToValueAtTime(0.0, t + 0.2);
            osc.start(t); osc.stop(t + 0.2);
        }
    };

    // --- VISUAL BUILDERS ---
    const createBombMesh = () => {
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.45, 32, 32),
            new THREE.MeshStandardMaterial({ 
                color: 0x111111, metalness: 0.9, roughness: 0.1, emissive: 0x000000 
            })
        );
        mesh.castShadow = true;
        return mesh;
    };

    const createDartMesh = () => {
        const group = new THREE.Group();
        group.rotation.y = Math.PI; 
        const scale = 0.8; 

        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * scale, 0.05 * scale, 1.8 * scale), new THREE.MeshStandardMaterial({ 
            color: 0x000000, metalness: 0.9, roughness: 0.1 
        }));
        body.rotation.x = Math.PI / 2;
        group.add(body);
        
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05 * scale, 0.6 * scale), new THREE.MeshStandardMaterial({ 
            color: 0xffffff, metalness: 1.0, roughness: 0.1 
        }));
        tip.rotation.x = -Math.PI / 2;
        tip.position.z = 1.2 * scale;
        group.add(tip);
        
        const finMat = new THREE.MeshStandardMaterial({ 
            color: 0xC8A951, side: THREE.DoubleSide, metalness: 0.1, roughness: 0.8, emissive: 0x443300 
        });
        const finGeo = new THREE.PlaneGeometry(0.6 * scale, 0.5 * scale);
        const pos = finGeo.attributes.position;
        pos.setX(0, pos.getX(0) + (0.2 * scale)); 
        pos.setX(1, pos.getX(1) + (0.2 * scale));
        
        [0, 2, 4].forEach(i => {
            const fin = new THREE.Mesh(finGeo, finMat);
            fin.rotation.y = (i * Math.PI) / 3;
            fin.position.z = -0.7 * scale;
            fin.rotation.z = 0.1;
            group.add(fin);
        });
        return group;
    };

    const createFragments = (pos, color, isBomb, forceMultiplier = 1.0) => {
        const count = isBomb ? 25 : 12; 
        const lifetime = isBomb ? 1.5 : 3.0;

        for(let i=0; i<count; i++) {
            const size = Math.random() * 0.4 + 0.1;
            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(size, size, size),
                new THREE.MeshStandardMaterial({ color: color, metalness: 0.3, roughness: 0.2 })
            );
            mesh.position.copy(pos);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            const baseForce = isBomb ? 20 : 10;
            const finalForce = baseForce * (1 + forceMultiplier); 

            const dir = new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize();
            
            mesh.userData = {
                vel: dir.multiplyScalar(Math.random() * finalForce + 5), 
                rot: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(0.5),
                life: lifetime,
                maxLife: lifetime
            };
            state.scene.add(mesh);
            state.fragments.push(mesh);
        }
    };

    const createExplosionEffect = (pos) => {
        const flash = new THREE.Mesh(
            new THREE.SphereGeometry(2, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.8 })
        );
        flash.position.copy(pos);
        flash.userData = { life: 0.15, type: 'flash', scaleSpeed: 3.0 };
        state.particles.push(flash);
        state.scene.add(flash);

        for(let i=0; i<20; i++) {
            const mesh = new THREE.Mesh(
                new THREE.SphereGeometry(Math.random()*0.2 + 0.1),
                new THREE.MeshBasicMaterial({ color: 0xff5500 })
            );
            mesh.position.copy(pos);
            mesh.userData = {
                vel: new THREE.Vector3((Math.random()-0.5)*15, Math.random()*15, (Math.random()-0.5)*15),
                life: 0.8,
                type: 'spark'
            };
            state.scene.add(mesh);
            state.particles.push(mesh);
        }
    };

    const createScenery = () => {
        const gridHelper = new THREE.GridHelper(200, 40, 0x886633, 0xAA8855);
        gridHelper.position.y = -1.99; 
        gridHelper.material.opacity = 0.6;
        gridHelper.material.transparent = true;
        state.scene.add(gridHelper);

        // Monoliths (Golden Stone)
        const rockGeo = new THREE.ConeGeometry(4, 15, 5);
        const rockMat = new THREE.MeshStandardMaterial({ 
            color: 0xDAC17C, roughness: 0.9, metalness: 0.1, flatShading: true
        });

        for (let i = 0; i < 25; i++) {
            const z = -10 - (i * 5);
            const m = rockMat.clone();
            m.color.setHSL(0.12, 0.5, 0.5 + Math.random()*0.2); 

            // Left Wall
            const leftRock = new THREE.Mesh(rockGeo, m);
            leftRock.position.set(-30 - Math.random() * 20, 0, z);
            leftRock.scale.set(1 + Math.random(), 0.5 + Math.random(), 1 + Math.random());
            leftRock.rotation.y = Math.random() * Math.PI;
            leftRock.castShadow = true;
            leftRock.receiveShadow = true;
            state.scene.add(leftRock);
            state.monoliths.push(leftRock); // ADDED TO COLLISION ARRAY

            // Right Wall
            const rightRock = new THREE.Mesh(rockGeo, m);
            rightRock.position.set(30 + Math.random() * 20, 0, z);
            rightRock.scale.set(1 + Math.random(), 0.5 + Math.random(), 1 + Math.random());
            rightRock.rotation.y = Math.random() * Math.PI;
            rightRock.castShadow = true;
            rightRock.receiveShadow = true;
            state.scene.add(rightRock);
            state.monoliths.push(rightRock); // ADDED TO COLLISION ARRAY
        }
    };

    // --- SCENE SETUP ---
    const init = () => {
        state.scene = new THREE.Scene();
        state.scene.background = new THREE.Color(0xD8B863);
        state.scene.fog = new THREE.Fog(0xD8B863, 20, 90);

        state.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        state.camera.position.set(0, 5, 15);
        
        state.renderer = new THREE.WebGLRenderer({ antialias: true });
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        state.renderer.shadowMap.enabled = true;
        state.renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
        state.renderer.domElement.style.display = 'block';
        mountRef.current.appendChild(state.renderer.domElement);

        state.scene.add(new THREE.AmbientLight(0xffffff, 1.2)); 
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 2.5); 
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 100;
        dirLight.shadow.camera.left = -50;
        dirLight.shadow.camera.right = 50;
        dirLight.shadow.camera.top = 50;
        dirLight.shadow.camera.bottom = -50;
        state.scene.add(dirLight);

        // YELLOW FLOOR (#F9E076)
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(300, 300), 
            new THREE.MeshStandardMaterial({ color: 0xF9E076, roughness: 0.8 })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -2;
        ground.receiveShadow = true;
        state.scene.add(ground);

        createScenery();

        for(let i=0; i<6; i++) createTarget();
        initAudio();

        spawnIdleProjectile(weaponType);

        window.addEventListener('resize', onResize);
        state.renderer.domElement.addEventListener('mousedown', onDown);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('mousemove', onMove);

        animate();
    };

    const createTarget = () => {
        const type = Math.floor(Math.random() * 6);
        let geo, mat;
        let specialType = 'normal'; // 'normal', 'gold', 'silver'

        const s = 1.7;

        if (type === 3) { 
            // SPECIAL HOOP (TORUS) - GOLD (2x)
            geo = new THREE.TorusGeometry(s*0.5, 0.2, 8, 16);
            mat = new THREE.MeshStandardMaterial({ 
                color: 0xFFD700, metalness: 0.8, roughness: 0.2, emissive: 0x332200 
            });
            specialType = 'gold';
        } 
        else if (type === 2) {
            // SPECIAL CONE - SILVER (1.5x)
            geo = new THREE.ConeGeometry(0.85, 2.1, 16);
            mat = new THREE.MeshStandardMaterial({ 
                color: 0xC0C0C0, metalness: 0.9, roughness: 0.1, emissive: 0x222222 
            });
            specialType = 'silver';
        }
        else {
            switch(type) {
                case 0: geo = new THREE.BoxGeometry(s,s,s); break;
                case 1: geo = new THREE.SphereGeometry(s*0.6,16,16); break;
                case 4: geo = new THREE.OctahedronGeometry(s*0.75); break;
                case 5: geo = new THREE.IcosahedronGeometry(s*0.75); break;
                default: geo = new THREE.BoxGeometry(s,s,s);
            }
            const col = COLORS[Math.floor(Math.random() * COLORS.length)];
            mat = new THREE.MeshStandardMaterial({ color: col, metalness: 0.1, roughness: 0.5 });
        }
        
        const mesh = new THREE.Mesh(geo, mat);
        const x = (Math.random()-0.5)*22;
        const z = (Math.random()-0.5)*20 - 10;
        const y = Math.random()*6 + 2;
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        mesh.userData = { 
            rot: new THREE.Vector3((Math.random()-0.5)*0.066, (Math.random()-0.5)*0.066, (Math.random()-0.5)*0.066),
            baseY: y,
            floatSpeed: (0.001 + Math.random() * 0.002) * 1.1,
            floatAmp: 0.5 + Math.random() * 1.5,
            floatOffset: Math.random() * 1000,
            specialType: specialType
        };
        
        state.scene.add(mesh);
        state.shapes.push(mesh);
    };

    const getChargePosition = () => {
        const pos = new THREE.Vector3(0, -2, -6);
        if (game.current.camera) {
            pos.applyQuaternion(game.current.camera.quaternion);
            pos.add(game.current.camera.position);
        }
        return pos;
    };

    const triggerShake = (intensity) => {
        game.current.shakeStrength = Math.min(game.current.shakeStrength + intensity, 2.0);
    };

    // --- IDLE / RELOAD SYSTEM ---
    const spawnIdleProjectile = (type) => {
        const state = game.current;
        if (state.idleProjectile) state.scene.remove(state.idleProjectile);
        
        state.idleProjectile = type === 'bomb' ? createBombMesh() : createDartMesh();
        if (type === 'dart') {
             state.idleProjectile.traverse(c => { if(c.isMesh) c.material = c.material.clone(); });
        }

        state.idleProjectile.position.copy(getChargePosition());
        state.idleProjectile.userData = { isIdle: true, scaleTimer: 0 };
        state.idleProjectile.scale.set(0,0,0);
        state.scene.add(state.idleProjectile);
    };

    // --- INPUT ---
    const onDown = (e) => {
        const state = game.current;
        if (state.isReloading || !state.idleProjectile) return;

        state.isHolding = true;
        state.power = 0;
        state.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        state.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        
        if(powerWrapperRef.current) powerWrapperRef.current.style.opacity = '1';
    };

    const onUp = (e) => {
        const state = game.current;
        if (!state.isHolding || state.isReloading) return;
        
        state.isHolding = false;
        if(powerWrapperRef.current) powerWrapperRef.current.style.opacity = '0';
        
        if (state.idleProjectile) {
            state.scene.remove(state.idleProjectile);
            state.idleProjectile = null;
        }

        const proj = weaponType === 'bomb' ? createBombMesh() : createDartMesh();
        proj.traverse(c => { if(c.isMesh) c.material = c.material.clone(); });
        proj.position.copy(getChargePosition());

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(state.mouse, state.camera);
        const targetPoint = new THREE.Vector3();
        raycaster.ray.at(50, targetPoint); 
        // 2. AIMING FIX: Projectile goes exactly towards cursor ray
        const dir = new THREE.Vector3().subVectors(targetPoint, proj.position).normalize();

        // Color Transfer
        if (state.power > 18) {
             const excessPower = state.power - 18;
             const maxExcess = 50 - 18;
             const intensity = excessPower / maxExcess; 
             proj.traverse(c => {
                 if (c.isMesh && c.material.emissive) {
                     c.material.emissive.setHex(0x990000); 
                     c.material.emissiveIntensity = intensity * 2.5; 
                 }
             });
        }
        
        const powerRatio = state.power / 50;
        const speedBase = weaponType === 'dart' ? 1.2 : 1.0; 
        const speed = (20 + (Math.pow(powerRatio, 2.0) * 100)) * speedBase; 

        // 2. AIMING FIX: No artificial Y-boost. Straight line at high speed.
        const velocity = dir.multiplyScalar(speed); 

        proj.userData = {
            velocity: velocity,
            type: weaponType,
            stuck: false,
            life: 0,
            chargeLevel: state.power 
        };
        
        if (weaponType === 'dart') proj.lookAt(proj.position.clone().add(dir));

        state.scene.add(proj);
        state.projectiles.push(proj);
        
        playSound('launch');
        playSound('throw');
        
        state.power = 0;
        state.isReloading = true;
        state.reloadTimer = 0;
        setIsReloading(true);
    };

    const onMove = (e) => {
        game.current.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        game.current.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        
        if (cursorRef.current) {
            cursorRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
        }
    };

    const onResize = () => {
        game.current.camera.aspect = window.innerWidth / window.innerHeight;
        game.current.camera.updateProjectionMatrix();
        game.current.renderer.setSize(window.innerWidth, window.innerHeight);
    };

    // --- LOOP ---
    const animate = () => {
        frameId = requestAnimationFrame(animate);
        const state = game.current;

        // 0. UPDATE SHAPES
        const time = Date.now();
        state.shapes.forEach(s => {
            s.position.y = s.userData.baseY + Math.sin(time * s.userData.floatSpeed + s.userData.floatOffset) * s.userData.floatAmp;
            s.rotation.x += s.userData.rot.x;
            s.rotation.y += s.userData.rot.y;
            s.rotation.z += s.userData.rot.z;
        });

        // 1. RELOAD LOGIC
        if (state.isReloading) {
            state.reloadTimer += 0.016;
            if (state.reloadTimer > 0.5) {
                state.isReloading = false;
                setIsReloading(false);
                spawnIdleProjectile(weaponType);
                playSound('reload');
            }
        }

        // 2. Idle Weapon
        if (state.idleProjectile) {
            if (state.idleProjectile.userData.scaleTimer < 1.0) {
                state.idleProjectile.userData.scaleTimer += 0.05;
                const s = state.idleProjectile.userData.scaleTimer;
                state.idleProjectile.scale.set(s, s, s);
                state.idleProjectile.rotation.z += 0.1 * (1-s); 
            }

            if (weaponType === 'dart') {
                const raycaster = new THREE.Raycaster();
                raycaster.setFromCamera(state.mouse, state.camera);
                const targetPoint = new THREE.Vector3();
                raycaster.ray.at(50, targetPoint);
                state.idleProjectile.lookAt(targetPoint);
            }

            if (state.isHolding) {
                state.power = Math.min(state.power + 0.8, 50); 
                
                const ratio = state.power / 50;
                
                if (powerBarRef.current) {
                    powerBarRef.current.style.width = `${Math.floor(ratio * 100)}%`;
                    powerBarRef.current.style.background = weaponType === 'bomb' ? '#e94560' : '#16c79a';
                }

                if (cursorRef.current) {
                    const size = 40 - (ratio * 35);
                    const opacity = 0.5 + (ratio * 0.5);
                    const bg = ratio > 0.9 ? (weaponType === 'bomb' ? '#e94560' : '#16c79a') : 'transparent';
                    
                    cursorRef.current.style.width = `${size}px`;
                    cursorRef.current.style.height = `${size}px`;
                    cursorRef.current.style.borderColor = `rgba(255, 255, 255, ${opacity})`;
                    cursorRef.current.style.backgroundColor = bg;
                }

                const shake = ratio * 0.2;
                const basePos = getChargePosition();
                state.idleProjectile.position.set(
                    basePos.x + (Math.random()-0.5)*shake,
                    basePos.y + (Math.random()-0.5)*shake,
                    basePos.z
                );

                if (state.power > 18) {
                    const excessPower = state.power - 18;
                    const maxExcess = 50 - 18;
                    const intensity = excessPower / maxExcess; 
                    state.idleProjectile.traverse(c => {
                        if (c.isMesh && c.material.emissive) {
                            c.material.emissive.setHex(0x990000);
                            c.material.emissiveIntensity = intensity * 2.5;
                        }
                    });
                } else {
                    state.idleProjectile.traverse(c => {
                        if (c.isMesh && c.material.emissive) {
                            c.material.emissive.setHex(0x000000);
                        }
                    });
                }
            } else {
                state.idleProjectile.position.y += Math.sin(Date.now()*0.003)*0.002;
                if (cursorRef.current) {
                    cursorRef.current.style.width = '30px';
                    cursorRef.current.style.height = '30px';
                    cursorRef.current.style.backgroundColor = 'transparent';
                    cursorRef.current.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                }
            }
        }

        // 3. Camera Logic
        const baseZ = state.isHolding ? 12.9 : 15;
        state.camera.position.z += (baseZ - state.camera.position.z) * 0.1;
        const baseX = 0; const baseY = 5;
        
        if (state.shakeStrength > 0) {
            state.camera.position.x = baseX + (Math.random() - 0.5) * state.shakeStrength;
            state.camera.position.y = baseY + (Math.random() - 0.5) * state.shakeStrength;
            state.shakeStrength = Math.max(0, state.shakeStrength * 0.9 - 0.05); 
        } else {
            state.camera.position.x += (baseX - state.camera.position.x) * 0.1;
            state.camera.position.y += (baseY - state.camera.position.y) * 0.1;
        }

        // 4. Projectiles
        for (let i = state.projectiles.length - 1; i >= 0; i--) {
            const p = state.projectiles[i];

            if (p.userData.stuck) {
                p.userData.life += 0.016;
                if (p.userData.life > 2.0) {
                    p.traverse(c => { 
                        if(c.isMesh) { 
                            c.material.transparent=true; 
                            c.material.opacity = Math.max(0, c.material.opacity - 0.02); 
                        }
                    });
                    if (p.userData.life > 3.5) { 
                        state.scene.remove(p); 
                        state.projectiles.splice(i, 1); 
                    }
                }
                continue; 
            }

            p.userData.velocity.multiplyScalar(0.99); 
            p.userData.velocity.y -= 0.5; 
            p.position.add(p.userData.velocity.clone().multiplyScalar(0.016));

            if (p.userData.type === 'bomb') {
                p.rotation.x += 0.1; p.rotation.y += 0.1; 
            } else {
                const lookTarget = p.position.clone().add(p.userData.velocity);
                p.lookAt(lookTarget);
            }

            if (p.userData.chargeLevel > 18) {
                 const powerRatio = (p.userData.chargeLevel - 18) / 32;
                 p.traverse(c => {
                    if(c.isMesh && c.material.emissive) {
                        c.material.emissive.setHex(0x990000);
                        c.material.emissiveIntensity = powerRatio * 2.5; 
                    }
                });
            }

            // COLLISION: MONOLITHS (1. Monoliths)
            let hitMonolith = false;
            for(let k=0; k<state.monoliths.length; k++) {
                const m = state.monoliths[k];
                // Box collision check (approximate for cone)
                if (p.position.distanceTo(m.position) < 3.5) {
                    hitMonolith = true;
                    if (p.userData.type === 'bomb') {
                        createExplosionEffect(p.position);
                        playSound('explode');
                        triggerShake(0.8);
                        state.scene.remove(p);
                        state.projectiles.splice(i, 1);
                    } else {
                        p.userData.stuck = true;
                        playSound('thunk');
                        triggerShake(0.2);
                    }
                    break;
                }
            }
            if(hitMonolith) continue;

            // COLLISION: GROUND (2. Ground)
            if (p.position.y <= -2) {
                if (p.userData.type === 'bomb') {
                    createExplosionEffect(p.position);
                    playSound('explode');
                    triggerShake(0.8); 
                    state.scene.remove(p); 
                    state.projectiles.splice(i, 1);
                } else {
                    p.position.y = -2;
                    p.userData.stuck = true;
                    playSound('thunk');
                    triggerShake(0.2); 
                }
                continue;
            }

            // COLLISION: TARGETS (3. Shapes)
            for (let j = state.shapes.length - 1; j >= 0; j--) {
                const s = state.shapes[j];
                // TIGHT COLLISION RADIUS: 1.2
                if (p.position.distanceTo(s.position) < 1.2) {
                    const powerRatio = p.userData.chargeLevel / 50;
                    
                    createFragments(s.position, s.material.color, p.userData.type === 'bomb', powerRatio);
                    
                    state.scene.remove(s); 
                    state.shapes.splice(j, 1);
                    
                    const dist = Math.abs(s.position.z - state.camera.position.z);
                    let points = 2;
                    if (dist > 15) points = 4;
                    if (dist > 25) points = 8;
                    if (dist > 35) points = 16;
                    if (dist > 45) points = 32;
                    
                    if (s.userData.specialType === 'gold') points *= 2;
                    if (s.userData.specialType === 'silver') points *= 1.5;
                    
                    setScore(prev => prev + Math.floor(points));
                    setTimeout(createTarget, 800);

                    if (p.userData.type === 'bomb') {
                        createExplosionEffect(s.position);
                        playSound('explode');
                        triggerShake(0.6);
                        state.scene.remove(p);
                        state.projectiles.splice(i, 1);
                    } else {
                        playSound('thunk');
                        triggerShake(0.2);
                        state.scene.remove(p);
                        state.projectiles.splice(i, 1);
                    }
                    break; 
                }
            }
        }

        // 5. Fragments (REVERSE ITERATION)
        for (let i = state.fragments.length - 1; i >= 0; i--) {
            const f = state.fragments[i];
            f.userData.vel.y -= 0.3; 
            f.position.add(f.userData.vel.clone().multiplyScalar(0.016));
            f.rotation.x += f.userData.rot.x;
            f.userData.life -= 0.016;
            
            if (f.userData.life < 1.0) {
                 f.material.transparent = true;
                 f.material.opacity = f.userData.life;
            }
            if (f.userData.life <= 0 || f.position.y < -5) {
                state.scene.remove(f);
                state.fragments.splice(i, 1);
            }
        }

        // 6. Particles (REVERSE ITERATION)
        for (let i = state.particles.length - 1; i >= 0; i--) {
            const p = state.particles[i];
            if (p.userData.type === 'flash') {
                p.scale.addScalar(p.userData.scaleSpeed * 0.1);
                p.material.opacity -= 0.1;
                if(p.material.opacity <= 0) { state.scene.remove(p); state.particles.splice(i, 1); continue; }
            } else {
                p.userData.vel.y -= 0.3;
                p.position.add(p.userData.vel.clone().multiplyScalar(0.016));
                p.userData.life -= 0.016; 
                p.material.opacity = p.userData.life;
                
                if (p.userData.life <= 0) {
                    state.scene.remove(p);
                    state.particles.splice(i, 1);
                }
            }
        }

        state.renderer.render(state.scene, state.camera);
    };

    init();

    return () => {
        state.active = false;
        cancelAnimationFrame(frameId);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('mouseup', onUp);
        window.removeEventListener('mousemove', onMove);
        if(state.renderer && state.renderer.domElement) {
             state.renderer.domElement.removeEventListener('mousedown', onDown);
        }
        if (state.audioCtx) state.audioCtx.close();
    };
  }, [weaponType]);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: '#D8B863', cursor: 'none' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      
      {/* DYNAMIC CURSOR */}
      <div ref={cursorRef} style={{
          position: 'fixed', top: 0, left: 0, width: '30px', height: '30px', borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.5)', pointerEvents: 'none', zIndex: 9999,
          transition: 'width 0.05s, height 0.05s, background-color 0.05s' 
      }} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&display=swap');
        .game-text { font-family: 'Fredoka', sans-serif; text-shadow: 2px 2px 4px rgba(0,0,0,0.5); user-select: none; }
      `}</style>
      
      <div className="game-text" style={{ 
          position: 'absolute', top: '20px', left: '20px', 
          color: 'white', fontSize: '32px', pointerEvents: 'none' 
      }}>
        score: {score}
      </div>

      <div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', gap: '10px' }}>
          <button onClick={(e) => { e.stopPropagation(); if(!isReloading) setWeaponType('bomb'); }} style={{ 
              padding: '10px 20px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontFamily: 'Fredoka',
              background: weaponType === 'bomb' ? '#e94560' : '#444', color: 'white', fontWeight: 'bold',
              opacity: isReloading ? 0.5 : 1
          }}>bomb</button>
          <button onClick={(e) => { e.stopPropagation(); if(!isReloading) setWeaponType('dart'); }} style={{ 
              padding: '10px 20px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontFamily: 'Fredoka',
              background: weaponType === 'dart' ? '#16c79a' : '#444', color: 'white', fontWeight: 'bold',
              opacity: isReloading ? 0.5 : 1
          }}>dart</button>
      </div>

      {/* Helper Text / Power Bar Wrapper */}
      <div style={{ 
          position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
          width: '300px', textAlign: 'center', pointerEvents: 'none'
      }}>
          {!game.current.isHolding && !isReloading && (
              <div className="game-text" style={{ color: 'white', fontSize: '18px', opacity: 0.8 }}>
                  click and hold to charge<br/>release to throw
              </div>
          )}
          {isReloading && (
              <div className="game-text" style={{ color: 'white', fontSize: '18px', opacity: 0.8 }}>
                  reloading...
              </div>
          )}
          
          {/* POWER BAR CONTAINER */}
          <div ref={powerWrapperRef} style={{ 
              width: '100%', height: '20px', background: 'rgba(0,0,0,0.5)', 
              borderRadius: '10px', border: '2px solid white', overflow: 'hidden', opacity: 0,
              transition: 'opacity 0.1s'
          }}>
              <div ref={powerBarRef} style={{ 
                  width: '0%', height: '100%', background: '#e94560' 
              }} />
          </div>
      </div>
    </div>
  );
};

export default StressBombGame;