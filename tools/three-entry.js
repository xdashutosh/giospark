// Entry for the trimmed Three.js bundle used by the site (assets/vendor/three.min.js).
// Rebuild with:  npx esbuild tools/three-entry.js --bundle --format=iife --global-name=THREE --minify --outfile=assets/vendor/three.min.js
export {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, Points, Object3D,
  LatheGeometry, CylinderGeometry, CircleGeometry, TorusGeometry, PlaneGeometry, SphereGeometry,
  BufferGeometry, BufferAttribute, Float32BufferAttribute,
  ShaderMaterial, MeshStandardMaterial, MeshPhysicalMaterial, MeshBasicMaterial,
  CanvasTexture, Texture, Vector2, Vector3, Color, MathUtils, Clock,
  AmbientLight, HemisphereLight, DirectionalLight, PMREMGenerator,
  DoubleSide, FrontSide, BackSide, AdditiveBlending, NormalBlending,
  SRGBColorSpace, NoToneMapping, ACESFilmicToneMapping, LinearFilter, LinearMipmapLinearFilter, ClampToEdgeWrapping, RepeatWrapping
} from 'three';
export { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
