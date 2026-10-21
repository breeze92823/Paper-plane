import {
  BackSide,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
} from 'three'
import { COLORS, FOG, GROUND_SIZE, GROUND_Y, LIGHT, PALETTE } from './config.js'
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
