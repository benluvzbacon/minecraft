import * as THREE from 'three';
import { DAY_LENGTH } from './config.js';
import { mixHex } from './utils.js';

export class Sky {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.time = 0.22;
    this.sun = new THREE.DirectionalLight(0xfff4d6, 1.05);
    this.sun.position.set(40, 80, 20);
    this.ambient = new THREE.AmbientLight(0x88a0c0, 0.42);
    this.hemi = new THREE.HemisphereLight(0x9ec9ff, 0x3d2a16, 0.35);
    scene.add(this.sun);
    scene.add(this.ambient);
    scene.add(this.hemi);

    this.sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(8, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff1a8 }),
    );
    this.moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(6, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xc8d4e8 }),
    );
    scene.add(this.sunMesh, this.moonMesh);

    this.fog = new THREE.Fog(0x87c8e8, 48, 140);
    scene.fog = this.fog;
    scene.background = new THREE.Color(0x87c8e8);

    this.clouds = new THREE.Group();
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 18; i++) {
      const c = new THREE.Group();
      const n = 3 + (i % 4);
      for (let k = 0; k < n; k++) {
        const box = new THREE.Mesh(new THREE.BoxGeometry(6 + (k % 3) * 2, 2, 5 + (k % 2) * 2), cloudMat);
        box.position.set((k - n / 2) * 4, (k % 2) * 1.2, ((k * 3) % 5) - 2);
        c.add(box);
      }
      c.position.set((i * 37) % 160 - 80, 62 + (i % 5), (i * 53) % 160 - 80);
      this.clouds.add(c);
    }
    scene.add(this.clouds);
  }

  setShadows(on) {
    this.sun.castShadow = on;
    if (on) {
      this.sun.shadow.mapSize.set(1024, 1024);
      const s = 40;
      this.sun.shadow.camera.left = -s;
      this.sun.shadow.camera.right = s;
      this.sun.shadow.camera.top = s;
      this.sun.shadow.camera.bottom = -s;
      this.sun.shadow.camera.near = 1;
      this.sun.shadow.camera.far = 200;
    }
  }

  update(dt, player) {
    this.time = (this.time + dt / DAY_LENGTH) % 1;
    const t = this.time;
    const elev = Math.sin(t * Math.PI * 2);
    const az = Math.cos(t * Math.PI * 2);
    const dist = 90;
    this.sun.position.set(
      player.x + az * dist,
      player.y + elev * dist,
      player.z + 30,
    );
    this.sunMesh.position.copy(this.sun.position);
    this.moonMesh.position.set(
      player.x - az * dist,
      player.y - elev * dist,
      player.z - 20,
    );

    const day = 0x87c8e8;
    const dusk = 0xe07a4a;
    const night = 0x05071a;
    const dawn = 0xff9966;
    let sky;
    if (elev > 0.25) sky = day;
    else if (elev > 0) sky = mixHex(dusk, day, elev / 0.25);
    else if (elev > -0.2) sky = mixHex(night, dusk, (elev + 0.2) / 0.2);
    else sky = night;
    if (elev > 0 && elev < 0.15 && t < 0.5) sky = mixHex(dawn, day, elev / 0.15);

    this.scene.background.setHex(sky);
    this.fog.color.setHex(sky);
    const sunI = Math.max(0.04, elev * 1.1);
    this.sun.intensity = sunI;
    this.ambient.intensity = 0.16 + Math.max(0, elev) * 0.32;
    this.hemi.intensity = 0.12 + Math.max(0, elev) * 0.28;
    this.sun.color.set(elev > 0.05 ? 0xfff4d6 : 0x8899cc);

    this.clouds.position.x = player.x;
    this.clouds.position.z = player.z;
    this.clouds.rotation.y += dt * 0.01;
    const nightFade = Math.max(0.15, elev);
    this.clouds.traverse((o) => {
      if (o.material) o.material.opacity = 0.2 + nightFade * 0.65;
    });
    this.sunMesh.visible = elev > -0.1;
    this.moonMesh.visible = elev < 0.15;
  }

  isNight() {
    return Math.sin(this.time * Math.PI * 2) < -0.05;
  }

  setRenderFog(dist) {
    this.fog.near = dist * 8;
    this.fog.far = dist * 16 + 24;
  }
}
