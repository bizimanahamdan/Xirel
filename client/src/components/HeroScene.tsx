import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Environment } from "@react-three/drei";
import { useRef, Suspense } from "react";
import * as THREE from "three";

function RoseBlob() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.x = state.clock.elapsedTime * 0.15;
    meshRef.current.rotation.y = state.clock.elapsedTime * 0.2;
  });

  return (
    <Float speed={1.5} rotationIntensity={0.6} floatIntensity={1.2}>
      <mesh ref={meshRef} scale={1.6}>
        <icosahedronGeometry args={[1, 4]} />
        <MeshDistortMaterial
          color="#e11d48"
          distort={0.35}
          speed={2}
          roughness={0.15}
          metalness={0.4}
        />
      </mesh>
    </Float>
  );
}

function SmallShape({
  position,
  color,
  geometry,
}: {
  position: [number, number, number];
  color: string;
  geometry: "box" | "torus" | "sphere";
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.x = state.clock.elapsedTime * 0.4;
    meshRef.current.rotation.z = state.clock.elapsedTime * 0.3;
  });

  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={2}>
      <mesh ref={meshRef} position={position} scale={0.4}>
        {geometry === "box" && <boxGeometry args={[1, 1, 1]} />}
        {geometry === "torus" && <torusGeometry args={[0.6, 0.25, 16, 32]} />}
        {geometry === "sphere" && <sphereGeometry args={[0.7, 32, 32]} />}
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.6} />
      </mesh>
    </Float>
  );
}

export default function HeroScene() {
  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 3, 3]} intensity={1.2} />
          <pointLight position={[-3, -2, -2]} intensity={0.5} color="#e11d48" />

          <RoseBlob />
          <SmallShape position={[-1.8, 1.2, -1]} color="#3b82f6" geometry="box" />
          <SmallShape position={[1.9, -1, -1]} color="#ec4899" geometry="torus" />
          <SmallShape position={[1.6, 1.4, -1.5]} color="#f59e0b" geometry="sphere" />

          <Environment preset="city" />
        </Suspense>
      </Canvas>
    </div>
  );
}
