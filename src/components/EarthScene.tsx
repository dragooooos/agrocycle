import { useEffect, useRef } from "react";

/**
 * Interactive 3D Earth scene.
 *
 * The primary model is the Earth GLB supplied for AgroCycle. It is bundled
 * locally in /public/earth.glb so the hero does not depend on Sketchfab or a
 * third-party runtime embed. A small procedural fallback is kept for safety.
 */
export default function EarthScene() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let animationFrame = 0;
    let cleanup: (() => void) | undefined;

    const start = async () => {
      const mount = mountRef.current;
      if (!mount) return;

      try {
        const threeUrl = "https://esm.sh/three@0.181.2";
        const loaderUrl =
          "https://esm.sh/three@0.181.2/examples/jsm/loaders/GLTFLoader.js?deps=three@0.181.2";

        // @vite-ignore keeps Vite from trying to bundle remote ESM URLs.
        const THREE = await import(/* @vite-ignore */ threeUrl);
        const { GLTFLoader } = await import(/* @vite-ignore */ loaderUrl);

        if (disposed || !mount) return;

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

        const ambient = new THREE.AmbientLight(0xb7d9c4, 2.0);
        scene.add(ambient);

        const keyLight = new THREE.DirectionalLight(0xffffff, 4.2);
        keyLight.position.set(4, 3, 5);
        scene.add(keyLight);

        const greenRim = new THREE.PointLight(0x48d58a, 7, 10);
        greenRim.position.set(-3.5, 1.5, 2.5);
        scene.add(greenRim);

        const satelliteGroup = new THREE.Group();
        satelliteGroup.rotation.set(-0.25, 0.15, 0.15);
        scene.add(satelliteGroup);

        const fallback = new THREE.Group();
        satelliteGroup.add(fallback);

        const body = new THREE.Mesh(
          new THREE.BoxGeometry(0.78, 0.52, 0.48),
          new THREE.MeshStandardMaterial({
            color: 0xd7ddd9,
            metalness: 0.55,
            roughness: 0.28,
          }),
        );
        fallback.add(body);

        const sensor = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.22, 0.28),
          new THREE.MeshStandardMaterial({
            color: 0x243b32,
            metalness: 0.35,
            roughness: 0.35,
          }),
        );
        sensor.position.set(0.46, -0.03, 0);
        fallback.add(sensor);

        const panelMaterial = new THREE.MeshStandardMaterial({
          color: 0x234c70,
          metalness: 0.35,
          roughness: 0.4,
        });

        for (const side of [-1, 1]) {
          const panel = new THREE.Mesh(
            new THREE.BoxGeometry(0.92, 0.025, 0.34),
            panelMaterial,
          );
          panel.position.x = side * 0.86;
          fallback.add(panel);
        }

        const boom = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.025, 0.9, 12),
          new THREE.MeshStandardMaterial({ color: 0x8f9993 }),
        );
        boom.rotation.z = Math.PI / 2;
        boom.position.x = 0.08;
        fallback.add(boom);

        // Local Earth GLB supplied for AgroCycle.
        // Bundling it locally keeps the 3D model reliable and avoids loading
        // the Sketchfab iframe/runtime on the landing page.
        const EARTH_GLB = "/earth.glb";

        const loader = new GLTFLoader();
        let modelLoaded = false;

        loader.load(
          EARTH_GLB,
          (gltf: any) => {
            if (disposed) return;

            const model = gltf.scene;
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const maxDimension = Math.max(size.x, size.y, size.z, 0.001);

            // Scale the supplied Earth to sit comfortably inside the hero.
            const scale = 2.15 / maxDimension;
            model.scale.setScalar(scale);
            model.position.sub(center.multiplyScalar(scale));
            model.rotation.set(0.06, -0.35, 0.08);

            model.traverse((object: any) => {
              if (object.isMesh) {
                object.castShadow = false;
                object.receiveShadow = false;
                if (object.material) {
                  const materials = Array.isArray(object.material)
                    ? object.material
                    : [object.material];
                  materials.forEach((material: any) => {
                    material.needsUpdate = true;
                  });
                }
              }
            });

            satelliteGroup.add(model);
            fallback.visible = false;
            modelLoaded = true;
          },
          undefined,
          (error: unknown) => {
            console.warn(
              "AgroCycle: local Earth model unavailable; using fallback.",
              error,
            );
          },
        );

        // Orbit ring gives the satellite some spatial context without adding
        // another object that competes with the hero copy.
        const orbit = new THREE.Mesh(
          new THREE.TorusGeometry(1.85, 0.009, 8, 180),
          new THREE.MeshBasicMaterial({
            color: 0x63d69a,
            transparent: true,
            opacity: 0.34,
          }),
        );
        orbit.rotation.x = Math.PI / 2.35;
        orbit.rotation.z = 0.28;
        scene.add(orbit);

        const orbitDot = new THREE.Mesh(
          new THREE.SphereGeometry(0.055, 16, 16),
          new THREE.MeshBasicMaterial({
            color: 0x9aefba,
            transparent: true,
            opacity: 0.92,
          }),
        );
        orbitDot.position.set(1.85, 0, 0);
        orbit.add(orbitDot);

        const starGeometry = new THREE.BufferGeometry();
        const starPositions = new Float32Array(650 * 3);
        for (let i = 0; i < 650; i += 1) {
          starPositions[i * 3] = (Math.random() - 0.5) * 15;
          starPositions[i * 3 + 1] = (Math.random() - 0.5) * 9;
          starPositions[i * 3 + 2] = -2 - Math.random() * 9;
        }
        starGeometry.setAttribute(
          "position",
          new THREE.BufferAttribute(starPositions, 3),
        );

        const stars = new THREE.Points(
          starGeometry,
          new THREE.PointsMaterial({
            color: 0xb9e8cf,
            size: 0.016,
            transparent: true,
            opacity: 0.62,
          }),
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
          satelliteGroup.rotation.y += dx * 0.007;
          satelliteGroup.rotation.x = Math.max(
            -0.85,
            Math.min(0.85, satelliteGroup.rotation.x + dy * 0.004),
          );
        };

        const onPointerUp = () => {
          dragging = false;
        };

        const onWheel = (event: WheelEvent) => {
          event.preventDefault();
          camera.position.z = Math.max(
            3.0,
            Math.min(5.8, camera.position.z + event.deltaY * 0.0024),
          );
        };

        renderer.domElement.addEventListener("pointerdown", onPointerDown);
        renderer.domElement.addEventListener("pointermove", onPointerMove);
        renderer.domElement.addEventListener("pointerup", onPointerUp);
        renderer.domElement.addEventListener("pointercancel", onPointerUp);
        renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

        const onResize = () => {
          if (!mount) return;
          camera.aspect =
            Math.max(mount.clientWidth, 1) / Math.max(mount.clientHeight, 1);
          camera.updateProjectionMatrix();
          renderer.setSize(mount.clientWidth, mount.clientHeight);
        };

        window.addEventListener("resize", onResize);

        const animate = () => {
          if (disposed) return;

          if (!dragging) {
            satelliteGroup.rotation.y += 0.0011;
          }

          orbit.rotation.y += 0.0025;
          stars.rotation.y += 0.00008;

          // Slight idle motion makes the model feel suspended in space.
          satelliteGroup.position.y = Math.sin(Date.now() * 0.0008) * 0.035;

          renderer.render(scene, camera);
          animationFrame = requestAnimationFrame(animate);
        };

        animate();

        cleanup = () => {
          cancelAnimationFrame(animationFrame);
          window.removeEventListener("resize", onResize);
          renderer.domElement.removeEventListener("pointerdown", onPointerDown);
          renderer.domElement.removeEventListener("pointermove", onPointerMove);
          renderer.domElement.removeEventListener("pointerup", onPointerUp);
          renderer.domElement.removeEventListener("pointercancel", onPointerUp);
          renderer.domElement.removeEventListener("wheel", onWheel);

          renderer.dispose();
          renderer.domElement.remove();

          scene.traverse((object: any) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach((material: any) => material.dispose());
              } else {
                object.material.dispose();
              }
            }
          });
        };

        // Keep this reference so the loader's success state is not optimized
        // away by future refactors.
        void modelLoaded;
      } catch (error) {
        console.error("AgroCycle: unable to load Three.js satellite scene", error);
        if (mount) {
          mount.innerHTML = `
            <div class="earth-fallback satellite-fallback">
              <div class="satellite-fallback-body">
                <span></span><i></i><b></b>
              </div>
              <strong>Landsat Earth observation</strong>
              <small>Interactive 3D visualization</small>
            </div>
          `;
        }
      }
    };

    start();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="earth-scene"
      aria-label="Interactive 3D Earth visualization"
    />
  );
}
