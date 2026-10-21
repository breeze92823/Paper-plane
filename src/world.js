import {
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Fog,
  HemisphereLight,
  Mesh,
  Points,
  PointsMaterial,
  ShaderMaterial,
  SphereGeometry,
} from 'three'
import { COLORS, FOG, GROUND_SIZE, GROUND_Y, LIGHT, PALETTE, SNOW } from './config.js'
import { studMat, tiledPlane } from './props.js'

// Everything is procedural: the ground is a studded plate painted to a canvas
// once, the sky is a gradient shader, the lights are plain three lights. No
// imported assets.

export function createGround() {
  const mesh = new Mesh(tiledPlane(GROUND_SIZE, GROUND_SIZE), studMat(PALETTE.grass, PALETTE.grassAlt))
  mesh.position.y = GROUND_Y
  mesh.receiveShadow = true
  return mesh
}

export function createSky() {
  const mesh = new Mesh(
    new SphereGeometry(250, 32, 16),
    new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new Color(COLORS.zenith) }, bottom: { value: new Color(COLORS.horizon) } },
      vertexShader: 'varying float vY; void main() { vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader:
        'uniform vec3 top; uniform vec3 bottom; varying float vY; void main() { gl_FragColor = vec4(mix(bottom, top, smoothstep(0.0, 0.6, vY)), 1.0); }',
    }),
  )
  mesh.renderOrder = -1
  return mesh
}

// Hemisphere fill + one shadow-casting sun. The sun's shadow box follows the
// player so a small map covers the whole play area at full resolution.
export function createLights() {
  const hemi = new HemisphereLight(LIGHT.hemiSky, LIGHT.hemiGround, LIGHT.hemiIntensity)
  const sun = new DirectionalLight(LIGHT.sunColor, LIGHT.sunIntensity)
  const offset = { x: LIGHT.sunPosition[0], y: LIGHT.sunPosition[1], z: LIGHT.sunPosition[2] }
  sun.castShadow = true
  sun.shadow.mapSize.set(LIGHT.shadowMapSize, LIGHT.shadowMapSize)
  const r = LIGHT.shadowRange
  Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 150 })
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.03

  const follow = (x, z) => {
    sun.position.set(x + offset.x, offset.y, z + offset.z)
    sun.target.position.set(x, 0, z)
    sun.target.updateMatrixWorld()
  }
  follow(0, 0)
  return { hemi, sun, follow }
}

export const createFog = () => new Fog(COLORS.horizon, FOG.near, FOG.far)

// Snow falling round the camera (SNOW, the Ice World): flakes in a box that follows the
// camera, each sinking and drifting on its own, wrapped back to the far side as it leaves.
export function createSnowfall() {
  const { flakes, box, height, fall, drift, size } = SNOW
  const pos = new Float32Array(flakes * 3)
  const speed = new Float32Array(flakes)
  const phase = new Float32Array(flakes)
  for (let i = 0; i < flakes; i++) {
    pos.set([(Math.random() - 0.5) * box, Math.random() * height, (Math.random() - 0.5) * box], i * 3)
    speed[i] = fall[0] + Math.random() * (fall[1] - fall[0])
    phase[i] = Math.random() * Math.PI * 2
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0.8)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 32, 32)
  const points = new Points(geo, new PointsMaterial({ size, map: new CanvasTexture(c), transparent: true, depthWrite: false, fog: true }))
  points.frustumCulled = false
  let time = 0
  // Positions are kept in world space; anything further than half the box from the camera
  // comes back in on the other side, so the box always surrounds it.
  const wrap = (v, centre) => centre + ((((v - centre + box / 2) % box) + box) % box) - box / 2
  return {
    object: points,
    update(dt, camera) {
      time += dt
      const { x: cx, y: cy, z: cz } = camera.position
      const floor = cy - height / 2
      for (let i = 0; i < flakes; i++) {
        const k = i * 3
        let y = pos[k + 1] - speed[i] * dt
        if (y < Math.max(floor, -1)) y += height
        else if (y > floor + height) y -= height
        pos[k] = wrap(pos[k] + Math.sin(time * 0.7 + phase[i]) * drift * dt, cx)
        pos[k + 1] = y
        pos[k + 2] = wrap(pos[k + 2] + Math.cos(time * 0.5 + phase[i]) * drift * dt, cz)
      }
      geo.attributes.position.needsUpdate = true
    },
  }
}
