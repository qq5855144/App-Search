# Three.js 材质

## 快速开始

```javascript
import * as THREE from "three";

// PBR 材质（真实感渲染推荐）
const material = new THREE.MeshStandardMaterial({
  color: 0x00ff00,
  roughness: 0.5,
  metalness: 0.5,
});

const mesh = new THREE.Mesh(geometry, material);
```

## 材质类型概览

| 材质 | 用途 | 受光照影响 |
| ---- | ---- | ---------- |
| MeshBasicMaterial | 无光照、扁平色、线框 | 否 |
| MeshLambertMaterial | 哑光表面、性能优先 | 是（仅漫反射） |
| MeshPhongMaterial | 有光泽表面、镜面高光 | 是 |
| MeshStandardMaterial | PBR、真实感材质 | 是（PBR） |
| MeshPhysicalMaterial | 高级 PBR、清漆、透射 | 是（PBR+） |
| MeshToonMaterial | 卡通风格、赛璐璐 | 是（卡通） |
| MeshNormalMaterial | 法线可视化调试用 | 否 |
| MeshDepthMaterial | 深度可视化 | 否 |
| ShaderMaterial | 自定义 GLSL 着色器 | 自定义 |
| RawShaderMaterial | 完全着色器控制 | 自定义 |

## MeshBasicMaterial

不进行光照计算。快速、始终可见。

```javascript
const material = new THREE.MeshBasicMaterial({
  color: 0xff0000,
  transparent: true,
  opacity: 0.5,
  side: THREE.DoubleSide, // FrontSide, BackSide, DoubleSide
  wireframe: false,
  map: texture, // 颜色/漫反射纹理
  alphaMap: alphaTexture, // 透明度纹理
  envMap: envTexture, // 反射纹理
  reflectivity: 1, // 环境贴图强度
  fog: true, // 受场景雾影响
});
```

## MeshLambertMaterial

仅漫反射光照。快速，无镜面高光。

```javascript
const material = new THREE.MeshLambertMaterial({
  color: 0x00ff00,
  emissive: 0x111111, // 自发光颜色
  emissiveIntensity: 1,
  map: texture,
  emissiveMap: emissiveTexture,
  envMap: envTexture,
  reflectivity: 0.5,
});
```

## MeshPhongMaterial

镜面高光。适合光泽、类塑料表面。

```javascript
const material = new THREE.MeshPhongMaterial({
  color: 0x0000ff,
  specular: 0xffffff, // 高光颜色
  shininess: 100, // 高光锐度（0-1000）
  emissive: 0x000000,
  flatShading: false, // 平面 vs 平滑着色
  map: texture,
  specularMap: specTexture, // 逐像素光泽度
  normalMap: normalTexture,
  normalScale: new THREE.Vector2(1, 1),
  bumpMap: bumpTexture,
  bumpScale: 1,
  displacementMap: dispTexture,
  displacementScale: 1,
});
```

## MeshStandardMaterial（PBR）

基于物理的渲染。真实感结果推荐。

```javascript
const material = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.5, // 0 = 镜面，1 = 漫反射
  metalness: 0.0, // 0 = 非金属，1 = 金属

  // 纹理
  map: colorTexture, // 反照率/基础颜色
  roughnessMap: roughTexture, // 逐像素粗糙度
  metalnessMap: metalTexture, // 逐像素金属度
  normalMap: normalTexture, // 表面细节
  normalScale: new THREE.Vector2(1, 1),
  aoMap: aoTexture, // 环境光遮蔽（使用 uv2！）
  aoMapIntensity: 1,
  displacementMap: dispTexture, // 顶点位移
  displacementScale: 0.1,
  displacementBias: 0,

  // 自发光
  emissive: 0x000000,
  emissiveIntensity: 1,
  emissiveMap: emissiveTexture,

  // 环境
  envMap: envTexture,
  envMapIntensity: 1,

  // 其他
  flatShading: false,
  wireframe: false,
  fog: true,
});

// 注意：aoMap 需要第二套 UV
geometry.setAttribute("uv2", geometry.attributes.uv);
```

## MeshPhysicalMaterial（高级 PBR）

扩展 MeshStandardMaterial，增加高级特性。

```javascript
const material = new THREE.MeshPhysicalMaterial({
  // 包含所有 MeshStandardMaterial 属性，以及：

  // 清漆（车漆、漆器）
  clearcoat: 1.0, // 0-1 清漆层强度
  clearcoatRoughness: 0.1,
  clearcoatMap: ccTexture,
  clearcoatRoughnessMap: ccrTexture,
  clearcoatNormalMap: ccnTexture,
  clearcoatNormalScale: new THREE.Vector2(1, 1),

  // 透射（玻璃、水）
  transmission: 1.0, // 0 = 不透明，1 = 完全透明
  transmissionMap: transTexture,
  thickness: 0.5, // 折射体积厚度
  thicknessMap: thickTexture,
  attenuationDistance: 1, // 吸收距离
  attenuationColor: new THREE.Color(0xffffff),

  // 折射
  ior: 1.5, // 折射率（1-2.333）

  // 光泽（织物、天鹅绒）
  sheen: 1.0,
  sheenRoughness: 0.5,
  sheenColor: new THREE.Color(0xffffff),
  sheenColorMap: sheenTexture,
  sheenRoughnessMap: sheenRoughTexture,

  // 虹彩（肥皂泡、油膜）
  iridescence: 1.0,
  iridescenceIOR: 1.3,
  iridescenceThicknessRange: [100, 400],
  iridescenceMap: iridTexture,
  iridescenceThicknessMap: iridThickTexture,

  // 各向异性（拉丝金属）
  anisotropy: 1.0,
  anisotropyRotation: 0,
  anisotropyMap: anisoTexture,

  // 高光
  specularIntensity: 1,
  specularColor: new THREE.Color(0xffffff),
  specularIntensityMap: specIntTexture,
  specularColorMap: specColorTexture,
});
```

### 玻璃材质示例

```javascript
const glass = new THREE.MeshPhysicalMaterial({
  color: 0xffffff,
  metalness: 0,
  roughness: 0,
  transmission: 1,
  thickness: 0.5,
  ior: 1.5,
  envMapIntensity: 1,
});
```

### 车漆材质示例

```javascript
const carPaint = new THREE.MeshPhysicalMaterial({
  color: 0xff0000,
  metalness: 0.9,
  roughness: 0.5,
  clearcoat: 1,
  clearcoatRoughness: 0.1,
});
```

## MeshToonMaterial

卡通风格赛璐璐着色。

```javascript
const material = new THREE.MeshToonMaterial({
  color: 0x00ff00,
  gradientMap: gradientTexture, // 可选：自定义着色渐变
});

// 创建阶梯渐变纹理
const colors = new Uint8Array([0, 128, 255]);
const gradientMap = new THREE.DataTexture(colors, 3, 1, THREE.RedFormat);
gradientMap.minFilter = THREE.NearestFilter;
gradientMap.magFilter = THREE.NearestFilter;
gradientMap.needsUpdate = true;
```

## MeshNormalMaterial

可视化表面法线。调试用途。

```javascript
const material = new THREE.MeshNormalMaterial({
  flatShading: false,
  wireframe: false,
});
```

## MeshDepthMaterial

渲染深度值。用于阴影贴图、景深效果。

```javascript
const material = new THREE.MeshDepthMaterial({
  depthPacking: THREE.RGBADepthPacking,
});
```

## PointsMaterial

用于点云。

```javascript
const material = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 0.1,
  sizeAttenuation: true, // 随距离缩放
  map: pointTexture,
  alphaMap: alphaTexture,
  transparent: true,
  alphaTest: 0.5, // 丢弃低于阈值的像素
  vertexColors: true, // 使用逐顶点颜色
});

const points = new THREE.Points(geometry, material);
```

## LineBasicMaterial 与 LineDashedMaterial

```javascript
// 实线
const lineMaterial = new THREE.LineBasicMaterial({
  color: 0xffffff,
  linewidth: 1, // 注意：>1 仅在某些系统上有效
  linecap: "round",
  linejoin: "round",
});

// 虚线
const dashedMaterial = new THREE.LineDashedMaterial({
  color: 0xffffff,
  dashSize: 0.5,
  gapSize: 0.25,
  scale: 1,
});

// 虚线需要
const line = new THREE.Line(geometry, dashedMaterial);
line.computeLineDistances();
```

## ShaderMaterial

使用 Three.js uniforms 的自定义 GLSL 着色器。

```javascript
const material = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0 },
    color: { value: new THREE.Color(0xff0000) },
    texture1: { value: texture },
  },
  vertexShader: `
    varying vec2 vUv;
    uniform float time;

    void main() {
      vUv = uv;
      vec3 pos = position;
      pos.z += sin(pos.x * 10.0 + time) * 0.1;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform vec3 color;
    uniform sampler2D texture1;

    void main() {
      // GLSL 1.0 用 texture2D()，GLSL 3.0 用 texture()（需 glslVersion: THREE.GLSL3）
      vec4 texColor = texture2D(texture1, vUv);
      gl_FragColor = vec4(color * texColor.rgb, 1.0);
    }
  `,
  transparent: true,
  side: THREE.DoubleSide,
});

// 在动画循环中更新 uniform
material.uniforms.time.value = clock.getElapsedTime();
```

### 内置 Uniforms（自动提供）

```glsl
// 顶点着色器
uniform mat4 modelMatrix;         // 物体到世界
uniform mat4 modelViewMatrix;     // 物体到相机
uniform mat4 projectionMatrix;    // 相机投影
uniform mat4 viewMatrix;          // 世界到相机
uniform mat3 normalMatrix;        // 法线变换
uniform vec3 cameraPosition;      // 相机世界位置

// 属性
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
```

## RawShaderMaterial

完全控制 —— 无内置 uniforms/attributes。

```javascript
const material = new THREE.RawShaderMaterial({
  uniforms: {
    projectionMatrix: { value: camera.projectionMatrix },
    modelViewMatrix: { value: new THREE.Matrix4() },
  },
  vertexShader: `
    precision highp float;
    attribute vec3 position;
    uniform mat4 projectionMatrix;
    uniform mat4 modelViewMatrix;

    void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    precision highp float;

    void main() {
      gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
    }
  `,
});
```

## 通用材质属性

所有材质共享以下基础属性：

```javascript
// 可见性
material.visible = true;
material.transparent = false;
material.opacity = 1.0;
material.alphaTest = 0; // 丢弃 alpha < 值的像素

// 渲染
material.side = THREE.FrontSide; // FrontSide, BackSide, DoubleSide
material.depthTest = true;
material.depthWrite = true;
material.colorWrite = true;

// 混合
material.blending = THREE.NormalBlending;
// NormalBlending, AdditiveBlending, SubtractiveBlending, MultiplyBlending, CustomBlending

// 模板
material.stencilWrite = false;
material.stencilFunc = THREE.AlwaysStencilFunc;
material.stencilRef = 0;
material.stencilMask = 0xff;

// 多边形偏移（z-fighting 修复）
material.polygonOffset = false;
material.polygonOffsetFactor = 0;
material.polygonOffsetUnits = 0;

// 其他
material.dithering = false;
material.toneMapped = true;
```

## 多材质

```javascript
// 为几何体组分配不同材质
const geometry = new THREE.BoxGeometry(1, 1, 1);
const materials = [
  new THREE.MeshBasicMaterial({ color: 0xff0000 }), // 右
  new THREE.MeshBasicMaterial({ color: 0x00ff00 }), // 左
  new THREE.MeshBasicMaterial({ color: 0x0000ff }), // 上
  new THREE.MeshBasicMaterial({ color: 0xffff00 }), // 下
  new THREE.MeshBasicMaterial({ color: 0xff00ff }), // 前
  new THREE.MeshBasicMaterial({ color: 0x00ffff }), // 后
];
const mesh = new THREE.Mesh(geometry, materials);

// 自定义组
geometry.clearGroups();
geometry.addGroup(0, 6, 0); // start, count, materialIndex
geometry.addGroup(6, 6, 1);
```

## 环境贴图

```javascript
// 加载立方体纹理
const cubeLoader = new THREE.CubeTextureLoader();
const envMap = cubeLoader.load([
  "px.jpg",
  "nx.jpg", // positive/negative X
  "py.jpg",
  "ny.jpg", // positive/negative Y
  "pz.jpg",
  "nz.jpg", // positive/negative Z
]);

// 应用到材质
material.envMap = envMap;
material.envMapIntensity = 1;

// 或设为场景环境（影响所有 PBR 材质）
scene.environment = envMap;

// HDR 环境（推荐）
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
const rgbeLoader = new RGBELoader();
rgbeLoader.load("environment.hdr", (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = texture;
  scene.background = texture;
});
```

## 材质克隆与修改

```javascript
// 克隆材质
const clone = material.clone();
clone.color.set(0x00ff00);

// 运行时修改
material.color.set(0xff0000);
material.needsUpdate = true; // 某些变更需要

// 需要 needsUpdate 的情况：
// - 更改 flat shading
// - 更改纹理
// - 更改 transparent
// - 自定义着色器代码变更
```

## 性能优化建议

1. **复用材质**：相同材质 = 批量绘制调用
2. **尽量避免透明**：透明材质需要排序
3. **使用 alphaTest 替代透明度**：适用时更快
4. **选择更简单的材质**：Basic > Lambert > Phong > Standard > Physical
5. **限制活动光源数**：每个光源增加着色器复杂度

```javascript
// 材质池
const materialCache = new Map();
function getMaterial(color) {
  const key = color.toString(16);
  if (!materialCache.has(key)) {
    materialCache.set(key, new THREE.MeshStandardMaterial({ color }));
  }
  return materialCache.get(key);
}

// 用完释放
material.dispose();
```

## 参见

- `references/textures.md` —— 纹理加载与配置
- `references/shaders.md` —— 自定义着色器开发
- `references/lighting.md` —— 光照与材质交互
