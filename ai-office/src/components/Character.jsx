import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { SPOTS, ROOM, resolveLocation } from '../lib/layout.js'

const wanderPool = [SPOTS.coffee, SPOTS.lounge, [-3, 4], [3, -5], [5, 2], [-5, -2]]
const randomSpot = () => {
  const s = wanderPool[Math.floor(Math.random() * wanderPool.length)]
  return [Math.max(-ROOM.w / 2 + 1, Math.min(ROOM.w / 2 - 1, s[0] + (Math.random() - 0.5))), s[1] + (Math.random() - 0.5)]
}

export default function Character({ agent, info = {}, bubble, focused, positions, onSelect, start }) {
  const group = useRef()
  const body = useRef()
  const [wander, setWander] = useState(() => randomSpot())
  const t = useRef(Math.random() * 10)
  const pos = useRef(new THREE.Vector3(start[0], 0, start[1]))
  positions.current[agent.id] = pos.current

  // bo'sh agentlar vaqti-vaqti bilan ofis bo'ylab yuradi
  useEffect(() => {
    if (info.location !== 'free') return
    const id = setInterval(() => setWander(randomSpot()), 6000 + Math.random() * 5000)
    return () => clearInterval(id)
  }, [info.location])

  useFrame((_, dt) => {
    t.current += dt
    const [tx, tz] = resolveLocation(agent.id, info.location, wander)
    const to = new THREE.Vector3(tx, 0, tz)
    const dist = pos.current.distanceTo(to)
    const walking = dist > 0.08
    if (walking) {
      pos.current.add(to.sub(pos.current).normalize().multiplyScalar(Math.min(dist, 2.2 * dt)))
      group.current.rotation.y = Math.atan2(to.x - pos.current.x + 1e-6, to.z - pos.current.z + 1e-6)
    }
    group.current.position.copy(pos.current)
    // yurganda sakrash, ishlaganda biroz tebranish
    const bob = walking ? Math.abs(Math.sin(t.current * 10)) * 0.12 : info.status === 'busy' ? Math.sin(t.current * 12) * 0.03 : 0
    body.current.position.y = bob
  })

  const statusColor = info.status === 'busy' ? '#fbbf24' : info.status === 'thinking' ? '#38bdf8' : '#64748b'

  return (
    <group ref={group} onClick={(e) => { e.stopPropagation(); onSelect() }}>
      <group ref={body}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <capsuleGeometry args={[0.28, 0.5, 4, 12]} />
          <meshStandardMaterial color={agent.color} />
        </mesh>
        <mesh position={[0, 1.2, 0]} castShadow>
          <sphereGeometry args={[0.27, 16, 16]} />
          <meshStandardMaterial color="#fcd9b6" />
        </mesh>
        {/* ko'zlar (yuz yo'nalishi +Z) */}
        <mesh position={[-0.09, 1.25, 0.23]}><sphereGeometry args={[0.04, 8, 8]} /><meshStandardMaterial color="#111827" /></mesh>
        <mesh position={[0.09, 1.25, 0.23]}><sphereGeometry args={[0.04, 8, 8]} /><meshStandardMaterial color="#111827" /></mesh>
      </group>
      <Html position={[0, 1.9, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div className="flex w-56 flex-col items-center gap-1 text-center">
          {bubble && (
            <div className="max-h-28 overflow-hidden rounded-xl bg-white px-3 py-2 text-left text-[11px] leading-snug text-slate-900 shadow-lg">
              {bubble.length > 140 ? bubble.slice(0, 140) + '…' : bubble}
            </div>
          )}
          <div className="rounded-md bg-slate-900/85 px-2 py-1 backdrop-blur">
            <div className="text-xs font-semibold" style={{ color: agent.color }}>{agent.name}</div>
            <div className="text-[10px] text-slate-400">{agent.role}</div>
            <div className="flex items-center justify-center gap-1 text-[10px] text-slate-200">
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: statusColor }} />
              {info.activity}
            </div>
          </div>
        </div>
      </Html>
    </group>
  )
}
