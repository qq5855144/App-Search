# Three.js 基础

## 快速开始

```javascript
import * as THREE from "three";

// 创建场景、相机、渲染器
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// 添加网格
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// 添加光源
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 5, 5);
scene.add(dirLight);

camera.position.z = 5;

// 动画循环
function animate() {
  requestAnimationFrame(animate);
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;
  renderer.render(scene, camera);
}
animate();

// 处理窗口大小变化
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
```

## 核心类

### 场景（Scene）

容纳所有 3D 对象、光源和相机的容器。

```javascript
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000); // 纯色背景
scene.background = texture; // 天空盒纹理
scene.background = cubeTexture; // 立方体贴图
scene.environment = envMap; // PBR 环境贴图
scene.fog = new THREE.Fog(0xffffff, 1, 100); // 线性雾
scene.fog = new THREE.FogExp2(0xffffff, 0.02); // 指数雾
```

### 相机（Cameras）

**透视相机（PerspectiveCamera）** —— 最常用，模拟人眼。

```javascript
// PerspectiveCamera(fov, aspect, near, far)
const camera = new THREE.PerspectiveCamera(
  75, // 视野角度（度）
  window.innerWidth / window.innerHeight, // 宽高比
  0.1, // 近裁剪面
  1000, // 远裁剪面
);

camera.position.set(0, 5, 10);
camera.lookAt(0, 0, 0);
camera.updateProjectionMatrix(); // 修改 fov、aspect、near、far 后调用
```

**正交相机（OrthographicCamera）** —— 无透视畸变，适合 2D/等距视角。

```javascript
// OrthographicCamera(left, right, top, bottom, near, far)
const aspect = window.innerWidth / window.innerHeight;
const frustumSize = 10;
const camera = new THREE.OrthographicCamera(
  (frustumSize * aspect) / -2,
  (frustumSize * aspect) / 2,
  frustumSize / 2,
  frustumSize / -2,
  0.1,
  1000,
);
```

**阵列相机（ArrayCamera）** —— 多视口子相机。

```javascript
const cameras = [];
for (let i = 0; i < 4; i++) {
  const subcamera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  subcamera.viewport = new THREE.Vector4(
    Math.floor(i % 2) * 0.5,
    Math.floor(i / 2) * 0.5,
    0.5,
    0.5,
  );
  cameras.push(subcamera);
}
const arrayCamera = new THREE.ArrayCamera(cameras);
```

**立方相机（CubeCamera）** —— 渲染环境贴图用于反射。

```javascript
const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256);
const cubeCamera = new THREE.CubeCamera(0.1, 1000, cubeRenderTarget);
scene.add(cubeCamera);

// 用于反射
material.envMap = cubeRenderTarget.texture;

// 每帧更新（开销大！）
cubeCamera.position.copy(reflectiveMesh.position);
cubeCamera.update(renderer, scene);
```

### WebGL 渲染器（WebGLRenderer）

```javascript
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector("#canvas"), // 可选：使用已有 canvas
  antialias: true, // 平滑边缘
  alpha: true, // 透明背景
  powerPreference: "high-performance", // GPU 性能提示
  preserveDrawingBuffer: true, // 用于截图
});

renderer.setSize(width, height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// 色调映射
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// 色彩空间（Three.js r152+）
renderer.outputColorSpace = THREE.SRGBColorSpace;

// 阴影
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// 清除色
renderer.setClearColor(0x000000, 1);

// 渲染
renderer.render(scene, camera);
```

### Object3D

所有 3D 对象的基类。Mesh、Group、Light、Camera 都继承自 Object3D。

```javascript
const obj = new THREE.Object3D();

// 变换
obj.position.set(x, y, z);
obj.rotation.set(x, y, z); // 欧拉角（弧度）
obj.quaternion.set(x, y, z, w); // 四元数旋转
obj.scale.set(x, y, z);

// 局部与世界变换
obj.getWorldPosition(targetVector);
obj.getWorldQuaternion(targetQuaternion);
obj.getWorldDirection(targetVector);

// 层级
obj.add(child);
obj.remove(child);
obj.parent;
obj.children;

// 可见性
obj.visible = false;

// 层级（用于选择性渲染/射线检测）
obj.layers.set(1);
obj.layers.enable(2);
obj.layers.disable(0);

// 遍历层级
obj.traverse((child) => {
  if (child.isMesh) child.material.color.set(0xff0000);
});

// 矩阵更新
obj.matrixAutoUpdate = true; // 默认：自动更新矩阵
obj.updateMatrix(); // 手动更新矩阵
obj.updateMatrixWorld(true); // 递归更新世界矩阵
```

### 组（Group）

用于组织对象的空容器。

```javascript
const group = new THREE.Group();
group.add(mesh1);
group.add(mesh2);
scene.add(group);

// 整体变换
group.position.x = 5;
group.rotation.y = Math.PI / 4;
```

### 网格（Mesh）

结合几何体与材质。

```javascript
const mesh = new THREE.Mesh(geometry, material);

// 多材质（每个几何体组一个材质）
const mesh = new THREE.Mesh(geometry, [material1, material2]);

// 常用属性
mesh.geometry;
mesh.material;
mesh.castShadow = true;
mesh.receiveShadow = true;

// 视锥剔除
mesh.frustumCulled = true; // 默认：相机外跳过渲染

// 渲染顺序
mesh.renderOrder = 10; // 越大越晚渲染
```

## 坐标系

Three.js 使用**右手坐标系**：

- **+X** 指向右侧
- **+Y** 指向上方
- **+Z** 指向观察者（屏幕外）

```javascript
// 坐标轴辅助器
const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper); // 红=X, 绿=Y, 蓝=Z
```

## 数学工具

### Vector3

```javascript
const v = new THREE.Vector3(x, y, z);
v.set(x, y, z);
v.copy(otherVector);
v.clone();

// 运算（原地修改）
v.add(v2);
v.sub(v2);
v.multiply(v2);
v.multiplyScalar(2);
v.divideScalar(2);
v.normalize();
v.negate();
v.clamp(min, max);
v.lerp(target, alpha);

// 计算（返回新值）
v.length();
v.lengthSq(); // 比 length() 更快
v.distanceTo(v2);
v.dot(v2);
v.cross(v2); // 修改 v
v.angleTo(v2);

// 变换
v.applyMatrix4(matrix);
v.applyQuaternion(q);
v.project(camera); // 世界坐标转 NDC
v.unproject(camera); // NDC 转世界坐标
```

### Matrix4

```javascript
const m = new THREE.Matrix4();
m.identity();
m.copy(other);
m.clone();

// 构建变换
m.makeTranslation(x, y, z);
m.makeRotationX(theta);
m.makeRotationY(theta);
m.makeRotationZ(theta);
m.makeRotationFromQuaternion(q);
m.makeScale(x, y, z);

// 组合/分解
m.compose(position, quaternion, scale);
m.decompose(position, quaternion, scale);

// 运算
m.multiply(m2); // m = m * m2
m.premultiply(m2); // m = m2 * m
m.invert();
m.transpose();

// 相机矩阵
m.makePerspective(left, right, top, bottom, near, far);
m.makeOrthographic(left, right, top, bottom, near, far);
m.lookAt(eye, target, up);
```

### Quaternion（四元数）

```javascript
const q = new THREE.Quaternion();
q.setFromEuler(euler);
q.setFromAxisAngle(axis, angle);
q.setFromRotationMatrix(matrix);

q.multiply(q2);
q.slerp(target, t); // 球面插值
q.normalize();
q.invert();
```

### Euler（欧拉角）

```javascript
const euler = new THREE.Euler(x, y, z, "XYZ"); // 顺序很重要！
euler.setFromQuaternion(q);
euler.setFromRotationMatrix(m);

// 旋转顺序：'XYZ', 'YXZ', 'ZXY', 'XZY', 'YZX', 'ZYX'
```

### Color

```javascript
const color = new THREE.Color(0xff0000);
const color = new THREE.Color("red");
const color = new THREE.Color("rgb(255, 0, 0)");
const color = new THREE.Color("#ff0000");

color.setHex(0x00ff00);
color.setRGB(r, g, b); // 0-1 范围
color.setHSL(h, s, l); // 0-1 范围

color.lerp(otherColor, alpha);
color.multiply(otherColor);
color.multiplyScalar(2);
```

### MathUtils

```javascript
THREE.MathUtils.clamp(value, min, max);
THREE.MathUtils.lerp(start, end, alpha);
THREE.MathUtils.mapLinear(value, inMin, inMax, outMin, outMax);
THREE.MathUtils.degToRad(degrees);
THREE.MathUtils.radToDeg(radians);
THREE.MathUtils.randFloat(min, max);
THREE.MathUtils.randInt(min, max);
THREE.MathUtils.smoothstep(x, min, max);
THREE.MathUtils.smootherstep(x, min, max);
```

## 常用模式

### 正确清理资源

```javascript
function dispose() {
  // 清理几何体
  mesh.geometry.dispose();

  // 清理材质
  if (Array.isArray(mesh.material)) {
    mesh.material.forEach((m) => m.dispose());
  } else {
    mesh.material.dispose();
  }

  // 清理纹理
  texture.dispose();

  // 从场景中移除
  scene.remove(mesh);

  // 清理渲染器
  renderer.dispose();
}
```

### 动画时钟

```javascript
const clock = new THREE.Clock();

function animate() {
  const delta = clock.getDelta(); // 上一帧以来的时间（秒）
  const elapsed = clock.getElapsedTime(); // 总时间（秒）

  mesh.rotation.y += delta * 0.5; // 无论帧率如何速度一致

  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
```

### 响应式画布

```javascript
function onWindowResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}
window.addEventListener("resize", onWindowResize);
```

### 加载管理器

```javascript
const manager = new THREE.LoadingManager();

manager.onStart = (url, loaded, total) => console.log("Started loading");
manager.onLoad = () => console.log("All loaded");
manager.onProgress = (url, loaded, total) => console.log(`${loaded}/${total}`);
manager.onError = (url) => console.error(`Error loading ${url}`);

const textureLoader = new THREE.TextureLoader(manager);
const gltfLoader = new GLTFLoader(manager);
```

## 性能优化建议

1. **限制绘制调用**：合并几何体、使用实例化、图集纹理
2. **视锥剔除**：默认启用，确保包围盒正确
3. **LOD（细节层次）**：使用 `THREE.LOD` 基于距离切换网格
4. **对象池化**：复用对象而非创建/销毁
5. **避免在循环中调用 `getWorldPosition`**：缓存结果

```javascript
// 合并静态几何体
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
const merged = mergeGeometries([geo1, geo2, geo3]);

// LOD
const lod = new THREE.LOD();
lod.addLevel(highDetailMesh, 0);
lod.addLevel(medDetailMesh, 50);
lod.addLevel(lowDetailMesh, 100);
scene.add(lod);
```

## 参见

- `references/geometry.md` —— 几何体创建与操作
- `references/materials.md` —— 材质类型与属性
- `references/lighting.md` —— 光源类型与阴影
