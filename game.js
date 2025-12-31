import * as THREE from 'three';

// --- AYARLAR ---
const SPEED_START = 0.3;
const JUMP_FORCE = 0.5;
const GRAVITY = 0.025;
let gameSpeed = SPEED_START;
let score = 0;
let isPlaying = false;
let obstacles = [];

// --- SAHNE KURULUMU ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Gökyüzü
scene.fog = new THREE.Fog(0x87CEEB, 20, 90); // Sis efekti

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 6, 12);
camera.lookAt(0, 2, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; // Gölgeler AÇIK
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Yumuşak gölgeler
document.body.appendChild(renderer.domElement);

// --- IŞIKLANDIRMA (Lüks görünüm için) ---
const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(20, 50, 20);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
scene.add(dirLight);

// --- ZEMİN (Damalı Desen Oluşturma - Texture yüklemeden) ---
// Canvas ile dinamik texture üretiyoruz ki dosya indirmekle uğraşma
function createCheckerTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2ecc71'; // Açık yeşil
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#27ae60'; // Koyu yeşil
    // Kareler çiz
    for(let y=0; y<512; y+=64) {
        for(let x=0; x<512; x+=64) {
            if ((x/64 + y/64) % 2 === 0) ctx.fillRect(x, y, 64, 64);
        }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(10, 50); // Zemine yay
    return texture;
}

const groundGeo = new THREE.PlaneGeometry(20, 1000);
const groundMat = new THREE.MeshStandardMaterial({ 
    map: createCheckerTexture(),
    roughness: 0.8 
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.z = -450;
ground.receiveShadow = true;
scene.add(ground);

// --- OYUNCU (FASULYE KARAKTER) ---
// Stumble Guys karakteri kapsüldür
const playerGeo = new THREE.CapsuleGeometry(0.7, 1, 4, 16);
const playerMat = new THREE.MeshStandardMaterial({ 
    color: 0xff4757, // Kırmızı Fasulye
    roughness: 0.1,  // Parlak plastik hissi
    metalness: 0.1
});
const player = new THREE.Mesh(playerGeo, playerMat);
player.position.y = 1.35; // Ayaklar yere değsin
player.castShadow = true;
scene.add(player);

// Gözlük ekleyelim (Karakter olduğu belli olsun)
const visorGeo = new THREE.BoxGeometry(1, 0.4, 0.5);
const visorMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0 });
const visor = new THREE.Mesh(visorGeo, visorMat);
visor.position.set(0, 0.5, 0.5);
player.add(visor); // Gözlüğü oyuncuya yapıştır

// --- FİZİK DEĞİŞKENLERİ ---
let playerVelY = 0;
let isJumping = false;
let lanes = [-3, 0, 3]; // 3 Şeritli yol
let currentLane = 1; // Ortada başla (0: sol, 1: orta, 2: sağ)

// --- KONTROLLER ---
window.addEventListener('keydown', (e) => {
    if (!isPlaying) {
        if (e.code === 'Space') startGame();
        return;
    }

    if (e.code === 'Space' && !isJumping) {
        playerVelY = JUMP_FORCE;
        isJumping = true;
        
        // Zıplama efekti (scale)
        player.scale.set(0.8, 1.2, 0.8);
        setTimeout(() => player.scale.set(1, 1, 1), 100);
    }
    
    // Şerit Değiştirme (Sol/Sağ ok)
    if (e.code === 'ArrowLeft' && currentLane > 0) {
        currentLane--;
    }
    if (e.code === 'ArrowRight' && currentLane < 2) {
        currentLane++;
    }
});

function startGame() {
    isPlaying = true;
    document.getElementById('start-screen').classList.add('hidden');
}

function gameOver() {
    isPlaying = false;
    document.getElementById('game-over-screen').classList.remove('hidden');
}

// --- ENGEL OLUŞTURUCU ---
function spawnObstacle() {
    if (!isPlaying) return;

    const type = Math.random() > 0.5 ? 'box' : 'bar';
    let obs;

    if (type === 'box') {
        // Zıplanacak Kutu
        const geo = new THREE.BoxGeometry(2.5, 2, 2);
        const mat = new THREE.MeshStandardMaterial({ color: 0xff9f43 });
        obs = new THREE.Mesh(geo, mat);
        // Rastgele bir şeride koy
        const laneIndex = Math.floor(Math.random() * 3);
        obs.position.set(lanes[laneIndex], 1, -80);
    } else {
        // Eğilinmesi/Zıplanması gereken yatay bar
        const geo = new THREE.CylinderGeometry(0.3, 0.3, 10, 16);
        const mat = new THREE.MeshStandardMaterial({ color: 0xee5253 });
        obs = new THREE.Mesh(geo, mat);
        obs.rotation.z = Math.PI / 2;
        obs.position.set(0, 1, -80); // Yerde yuvarlanan silindir
    }

    obs.castShadow = true;
    obs.receiveShadow = true;
    scene.add(obs);
    obstacles.push(obs);
}

// Engel oluşturma döngüsü
setInterval(() => {
    if (isPlaying) spawnObstacle();
}, 1500);


// --- OYUN DÖNGÜSÜ (RENDER LOOP) ---
function animate() {
    requestAnimationFrame(animate);

    if (isPlaying) {
        // 1. Oyuncu Hareketi (Şeritlere yumuşak geçiş - Lerp)
        const targetX = lanes[currentLane];
        player.position.x += (targetX - player.position.x) * 0.1;

        // 2. Zıplama Fiziği
        player.position.y += playerVelY;
        playerVelY -= GRAVITY;

        // Yer kontrolü
        if (player.position.y <= 1.35) {
            player.position.y = 1.35;
            playerVelY = 0;
            isJumping = false;
        } else {
            // Havadaysa hafif öne eğil
            player.rotation.x = -0.2;
        }
        if (!isJumping) player.rotation.x = 0;

        // Koşma Animasyonu (Sallanma)
        if (!isJumping) {
            player.rotation.z = Math.sin(Date.now() * 0.01) * 0.1;
        }

        // 3. Zemin Hareketi (Sonsuz hissi)
        ground.material.map.offset.y -= gameSpeed * 0.1;

        // 4. Engeller
        for (let i = obstacles.length - 1; i >= 0; i--) {
            let obs = obstacles[i];
            obs.position.z += gameSpeed * 1.5; // Engeller bize gelsin
            obs.rotation.x += 0.05; // Yuvarlanma efekti

            // Çarpışma Kontrolü (Basit mesafe)
            const distZ = Math.abs(obs.position.z - player.position.z);
            const distX = Math.abs(obs.position.x - player.position.x);

            // Eğer engel silindirse (geniş) X'e bakma, sadece Z ve Y
            let hit = false;
            
            // Kutu engeli
            if (obs.geometry.type === 'BoxGeometry') {
                if (distZ < 1.5 && distX < 1 && player.position.y < 2.5) hit = true;
            } 
            // Silindir engeli (Boydan boya)
            else if (obs.geometry.type === 'CylinderGeometry') {
                if (distZ < 1 && player.position.y < 2) hit = true;
            }

            if (hit) {
                gameOver();
            }

            // Sahneden çıkanları sil
            if (obs.position.z > 10) {
                scene.remove(obs);
                obstacles.splice(i, 1);
                score += 10;
                document.getElementById('score').innerText = score;
                gameSpeed += 0.0005; // Oyun hızlansın
            }
        }
    }

    renderer.render(scene, camera);
}

// Pencere boyutu değişince düzelt
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
