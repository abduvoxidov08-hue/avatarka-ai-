import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrthographicCamera } from '@react-three/drei'
import { useRef } from 'react'
import * as THREE from 'three'
import { DESKS, SPOTS, ROOM, deskSeat } from '../lib/layout.js'
import Character from './Character.jsx'

function Desk({ id, position }) {
  return (
    <group position={[position[0], 0, position[1]]}>
      <mesh position={[0, 0.7, 0]} castShadow>
        <boxGeometry args={[2.2, 0.12, 1.1]} />
        <meshStandardMaterial color="#7c5a3a" />
      </mesh>
      {[[-1, -0.45], [1, -0.45], [-1, 0.45], [1, 0.45]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.35, z]}>
          <boxGeometry args={[0.1, 0.7, 0.1]} />
          <meshStandardMaterial color="#3b2a1a" />
        </mesh>
      ))}
      <mesh position={[0, 1.1, -0.25]} castShadow>
        <boxGeometry args={[0.9, 0.55, 0.06]} />
        <meshStandardMaterial color="#0f172a" emissive="#38bdf8" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 0.85, -0.25]}>
        <boxGeometry args={[0.12, 0.2, 0.12]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      {/* stul */}
      <mesh position={[0, 0.45, 1.1]}>
        <boxGeometry args={[0.6, 0.1, 0.6]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
    </group>
  )
}

function Coffee({ position }) {
  return (
    <group position={[position[0], 0, position[1]]}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.9, 1, 0.7]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0, 0.8, 0.36]}>
        <boxGeometry args={[0.5, 0.25, 0.02]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.6} />
      </mesh>
    </group>
  )
}

function Sofa({ position }) {
  return (
    <group position={[position[0], 0, position[1]]} rotation={[0, -Math.PI / 4, 0]}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[2.4, 0.6, 1]} />
        <meshStandardMaterial color="#6366f1" />
      </mesh>
      <mesh position={[0, 0.8, -0.4]} castShadow>
        <boxGeometry args={[2.4, 0.6, 0.2]} />
        <meshStandardMaterial color="#4f46e5" />
      </mesh>
    </group>
  )
}

function Plant({ position }) {
  return (
    <group position={[position[0], 0, position[1]]}>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.25, 0.2, 0.5, 8]} />
        <meshStandardMaterial color="#92400e" />
      </mesh>
      <mesh position={[0, 0.85, 0]} castShadow>
        <icosahedronGeometry args={[0.45, 0]} />
        <meshStandardMaterial color="#22c55e" flatShading />
      </mesh>
    </group>
  )
}

function Room() {
  const { w, d } = ROOM
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <gridHelper args={[w, w, '#334155', '#27344a']} position={[0, 0.01, 0]} />
      {/* orqa devorlar */}
      <mesh position={[0, 1.5, -d / 2]}>
        <boxGeometry args={[w, 3, 0.2]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh position={[-w / 2, 1.5, 0]}>
        <boxGeometry args={[0.2, 3, d]} />
        <meshStandardMaterial color="#2b3a52" />
      </mesh>
    </group>
  )
}

// Fokus rejimida kamera personajga yaqinlashadi, aks holda umumiy izometrik ko'rinish
function CameraRig({ focusId, positions }) {
  const { camera } = useThree()
  const target = useRef(new THREE.Vector3())
  useFrame((_, dt) => {
    const k = 1 - Math.pow(0.001, dt)
    const p = focusId && positions.current[focusId]
    const look = p ? new THREE.Vector3(p.x, 1, p.z) : new THREE.Vector3(0, 0, 0)
    const zoom = p ? 120 : 42
    const dir = new THREE.Vector3(1, 0.9, 1).normalize().multiplyScalar(30)
    camera.position.lerp(look.clone().add(dir), k)
    target.current.lerp(look, k)
    camera.zoom += (zoom - camera.zoom) * k
    camera.lookAt(target.current)
    camera.updateProjectionMatrix()
  })
  return null
}

export default function Office3D({ agents, state, bubbles, focusId, setFocusId }) {
  const positions = useRef({}) // id -> THREE.Vector3 (Character yangilaydi)
  return (
    <Canvas shadows dpr={[1, 2]} onPointerMissed={() => setFocusId(null)}>
      <color attach="background" args={['#020617']} />
      <OrthographicCamera makeDefault position={[30, 27, 30]} zoom={42} near={-100} far={200} />
      <CameraRig focusId={focusId} positions={positions} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[8, 14, 6]} intensity={1.4} castShadow shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} />
      <Room />
      {Object.entries(DESKS).map(([id, pos]) => <Desk key={id} id={id} position={pos} />)}
      <Coffee position={SPOTS.coffee} />
      <Sofa position={SPOTS.lounge} />
      <Plant position={[-7, -6]} />
      <Plant position={[7, -6]} />
      {agents.map((a) => (
        <Character
          key={a.id}
          agent={a}
          info={state[a.id]}
          bubble={bubbles[a.id]}
          focused={focusId === a.id}
          positions={positions}
          onSelect={() => setFocusId(a.id)}
          start={deskSeat(a.id)}
        />
      ))}
    </Canvas>
  )
}
