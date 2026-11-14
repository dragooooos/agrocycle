import { useEffect, useRef } from "react";
import type { Material, Mesh, MeshStandardMaterial, Object3D } from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";

/**
 * Interactive 3D Earth for the landing page.
 *
 * Loading is arranged so the globe never pops in half-ready:
 * 1. three.js, its GLTF loader and /earth.glb are fetched at the same time
 *    (index.html also starts the model download early on the home page).
 *    three.js is imported on demand, so Vite puts it in its own chunk and
 *    other pages never download it.
 * 2. The scene is built and its textures and shaders are sent to the GPU
 *    while the canvas is still invisible.
 * 3. Only then does the mount get `is-ready`, which fades the canvas in (Home.css).
 *
 * The model's textures are WebP (EXT_texture_webp), so the file is ~0.8 MB.
 */

const EARTH_GLB = "/earth.glb";

const FALLBACK_HTML = `
  <div class="earth-fallback satellite-fallback">
    <div class="satellite-fallback-body">
      <span></span><i></i><b></b>
    </div>
    <strong>Landsat Earth observation</strong>
    <small>Interactive 3D visualization</small>
  </div>
`;

const materialsOf = (object: Object3D): Material[] => {
  const material = (object as Mesh).material;
  if (!material) return [];
  return Array.isArray(material) ? material : [material];
};

const loadModelData = async () => {
  const response = await fetch(EARTH_GLB);
  if (!response.ok) throw new Error(`${EARTH_GLB}: HTTP ${response.status}`);
  return response.arrayBuffer();
};

export default function EarthScene() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let animationFrame = 0;
    let cleanup: (() => void) | undefined;

    const showFallback = (mount: HTMLDivElement, error: unknown) => {
      console.warn("AgroCycle: 3D Earth unavailable; showing the static fallback.", error);
      cleanup?.();
      cleanup = undefined;
      mount.innerHTML = FALLBACK_HTML;
      mount.classList.add("is-ready");
    };

    const start = async () => {
      const mount = mountRef.current;
      if (!mount) return;

      // All three downloads run in parallel instead of one after another.
      const loaded = await Promise.all([
        import("three"),
        import("three/addons/loaders/GLTFLoader.js"),
        loadModelData(),
      ]).catch((error: unknown) => {
        if (!disposed) showFallback(mount, error);
        return null;
      });
      if (!loaded || disposed) return;
      const [THREE, { GLTFLoader }, modelData] = loaded;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        40,
        Math.max(mount.clientWidth, 1) / Math.max(mount.clientHeight, 1),
        0.1,
        100,
      );
      camera.position.set(0, 0.25, 6.65);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(0x000000, 0);
      mount.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight(0xb7d9c4, 2.0));

      const keyLight = new THREE.DirectionalLight(0xffffff, 4.2);
      keyLight.position.set(4, 3, 5);
      scene.add(keyLight);

      const greenRim = new THREE.PointLight(0x48d58a, 7, 10);
      greenRim.position.set(-3.5, 1.5, 2.5);
      scene.add(greenRim);

      const globeGroup = new THREE.Group();
      globeGroup.rotation.set(-0.25, 0.15, 0.15);
      scene.add(globeGroup);

      // Orbit ring gives the globe some spatial context without competing with the hero copy.
      const orbit = new THREE.Mesh(
        new THREE.TorusGeometry(1.85, 0.009, 8, 180),
        new THREE.MeshBasicMaterial({ color: 0x63d69a, transparent: true, opacity: 0.34 }),
      );
      orbit.rotation.x = Math.PI / 2.35;
      orbit.rotation.z = 0.28;
      scene.add(orbit);

      const orbitDot = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0x9aefba, transparent: true, opacity: 0.92 }),
      );
      orbitDot.position.set(1.85, 0, 0);
      orbit.add(orbitDot);

      const starPositions = new Float32Array(650 * 3);
      for (let i = 0; i < 650; i += 1) {
        starPositions[i * 3] = (Math.random() - 0.5) * 15;
        starPositions[i * 3 + 1] = (Math.random() - 0.5) * 9;
        starPositions[i * 3 + 2] = -2 - Math.random() * 9;
      }
      const starGeometry = new THREE.BufferGeometry();
      starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
      const stars = new THREE.Points(
        starGeometry,
        new THREE.PointsMaterial({ color: 0xb9e8cf, size: 0.016, transparent: true, opacity: 0.62 }),
      );
      scene.add(stars);

      let dragging = false;
      let lastX = 0;
      let lastY = 0;

      const onPointerDown = (event: PointerEvent) => {
        dragging = true;
        lastX = event.clientX;
        lastY = event.clientY;
        renderer.domElement.setPointerCapture?.(event.pointerId);
      };

      const onPointerMove = (event: PointerEvent) => {
        if (!dragging) return;
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        lastX = event.clientX;
        lastY = event.clientY;
        globeGroup.rotation.y += dx * 0.007;
        globeGroup.rotation.x = Math.max(-0.85, Math.min(0.85, globeGroup.rotation.x + dy * 0.004));
      };

      const onPointerUp = () => {
        dragging = false;
      };

      const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        camera.position.z = Math.max(3.0, Math.min(5.8, camera.position.z + event.deltaY * 0.0024));
      };

      const onResize = () => {
        camera.aspect = Math.max(mount.clientWidth, 1) / Math.max(mount.clientHeight, 1);
        camera.updateProjectionMatrix();
        renderer.setSize(mount.clientWidth, mount.clientHeight);
      };

      renderer.domElement.addEventListener("pointerdown", onPointerDown);
      renderer.domElement.addEventListener("pointermove", onPointerMove);
      renderer.domElement.addEventListener("pointerup", onPointerUp);
      renderer.domElement.addEventListener("pointercancel", onPointerUp);
      renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
      window.addEventListener("resize", onResize);

      cleanup = () => {
        cancelAnimationFrame(animationFrame);
        window.removeEventListener("resize", onResize);
        renderer.domElement.removeEventListener("pointerdown", onPointerDown);
        renderer.domElement.removeEventListener("pointermove", onPointerMove);
        renderer.domElement.removeEventListener("pointerup", onPointerUp);
        renderer.domElement.removeEventListener("pointercancel", onPointerUp);
        renderer.domElement.removeEventListener("wheel", onWheel);

        scene.traverse((object) => {
          (object as Mesh).geometry?.dispose();
          materialsOf(object).forEach((material) => {
            (material as MeshStandardMaterial).map?.dispose();
            material.dispose();
          });
        });
        renderer.dispose();
        renderer.domElement.remove();
      };

      // Decode the model (textures are decoded off the main thread by the loader).
      let gltf: GLTF;
      try {
        gltf = await new Promise<GLTF>((resolve, reject) => new GLTFLoader().parse(modelData, "", resolve, reject));
      } catch (error) {
        if (!disposed) showFallback(mount, error);
        return;
      }
      if (disposed) return;

      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const scale = 2.15 / Math.max(size.x, size.y, size.z, 0.001);
      model.scale.setScalar(scale);
      model.position.sub(center.multiplyScalar(scale));
      model.rotation.set(0.06, -0.35, 0.08);
      globeGroup.add(model);

      // Upload textures and compile shaders now, while the canvas is still invisible,
      // so the first visible frame does not stall.
      model.traverse((object) => {
        materialsOf(object).forEach((material) => {
          const map = (material as MeshStandardMaterial).map;
          if (map) renderer.initTexture(map);
        });
      });
      try {
        await renderer.compileAsync(scene, camera);
      } catch {
        // compileAsync is an optimisation only; rendering compiles on demand anyway.
      }
      if (disposed) return;

      const animate = () => {
        if (disposed) return;
        if (!dragging) globeGroup.rotation.y += 0.0011;
        orbit.rotation.y += 0.0025;
        stars.rotation.y += 0.00008;
        // Slight idle motion makes the globe feel suspended in space.
        globeGroup.position.y = Math.sin(Date.now() * 0.0008) * 0.035;
        renderer.render(scene, camera);
        animationFrame = requestAnimationFrame(animate);
      };

      animate();
      // Reveal after the first complete frame has been drawn.
      requestAnimationFrame(() => {
        if (!disposed) mount.classList.add("is-ready");
      });
    };

    start();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return <div ref={mountRef} className="earth-scene" aria-label="Interactive 3D Earth visualization" />;
}
