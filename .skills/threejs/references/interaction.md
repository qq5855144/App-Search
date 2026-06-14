# Three.js 交互

## 快速开始

```javascript
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// 相机控制器
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// 射线检测用于点击识别
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onClick(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children);

  if (intersects.length > 0) {
    console.log("Clicked:", intersects[0].object);
  }
}

window.addEventListener("click", onClick);
```

## 射线检测器（Raycaster）

### 基础射线检测

```javascript
const raycaster = new THREE.Raycaster();

// 从相机出发（鼠标拾取）
raycaster.setFromCamera(mousePosition, camera);

// 从任意原点和方向出发
raycaster.set(origin, direction); // origin: Vector3, direction: 归一化 Vector3

// 获取交点
const intersects = raycaster.intersectObjects(objects, recursive);

// intersects 数组包含：
// {
//   distance: number,          // 距离射线原点
//   point: Vector3,            // 世界坐标交点
//   face: Face3,               // 相交面
//   faceIndex: number,         // 面索引
//   object: Object3D,          // 相交对象
//   uv: Vector2,               // 交点 UV 坐标
//   uv1: Vector2,              // 第二套 UV
//   normal: Vector3,           // 插值面法线
//   instanceId: number         // InstancedMesh 用
// }
```

### 鼠标位置转换

```javascript
const mouse = new THREE.Vector2();

function updateMouse(event) {
  // 全窗口
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

// 特定 canvas 元素
function updateMouseCanvas(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}
```

### 触摸支持

```javascript
function onTouchStart(event) {
  event.preventDefault();

  if (event.touches.length === 1) {
    const touch = event.touches[0];
    mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(clickableObjects);

    if (intersects.length > 0) {
      handleSelection(intersects[0]);
    }
  }
}

renderer.domElement.addEventListener("touchstart", onTouchStart);
```

### 射线检测选项

```javascript
const raycaster = new THREE.Raycaster();

// 近/远裁剪（默认：0, Infinity）
raycaster.near = 0;
raycaster.far = 100;

// 线/点精度
raycaster.params.Line.threshold = 0.1;
raycaster.params.Points.threshold = 0.1;

// 层级（仅检测特定层上的对象）
raycaster.layers.set(1);
```

### 高效射线检测

```javascript
// 仅检测特定对象
const clickables = [mesh1, mesh2, mesh3];
const intersects = raycaster.intersectObjects(clickables, false);

// 使用层级过滤
mesh1.layers.set(1); // 可点击层
raycaster.layers.set(1);

// 对悬停效果节流
let lastRaycast = 0;
function onMouseMove(event) {
  const now = Date.now();
  if (now - lastRaycast < 50) return; // 最高 20fps
  lastRaycast = now;

  // 在此进行射线检测
}
```

## 相机控制器

### OrbitControls

```javascript
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const controls = new OrbitControls(camera, renderer.domElement);

// 阻尼（平滑移动）
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// 旋转限制
controls.minPolarAngle = 0; // 顶部
controls.maxPolarAngle = Math.PI / 2; // 地平线
controls.minAzimuthAngle = -Math.PI / 4; // 左侧
controls.maxAzimuthAngle = Math.PI / 4; // 右侧

// 缩放限制
controls.minDistance = 2;
controls.maxDistance = 50;

// 启用/禁用功能
controls.enableRotate = true;
controls.enableZoom = true;
controls.enablePan = true;

// 自动旋转
controls.autoRotate = true;
controls.autoRotateSpeed = 2.0;

// 目标（环绕点）
controls.target.set(0, 1, 0);

// 在动画循环中更新
function animate() {
  controls.update(); // 阻尼和自动旋转必需
  renderer.render(scene, camera);
}
```

### FlyControls

```javascript
import { FlyControls } from "three/addons/controls/FlyControls.js";

const controls = new FlyControls(camera, renderer.domElement);
controls.movementSpeed = 10;
controls.rollSpeed = Math.PI / 24;
controls.dragToLook = true;

// 使用 delta 更新
function animate() {
  controls.update(clock.getDelta());
  renderer.render(scene, camera);
}
```

### FirstPersonControls

```javascript
import { FirstPersonControls } from "three/addons/controls/FirstPersonControls.js";

const controls = new FirstPersonControls(camera, renderer.domElement);
controls.movementSpeed = 10;
controls.lookSpeed = 0.1;
controls.lookVertical = true;
controls.constrainVertical = true;
controls.verticalMin = Math.PI / 4;
controls.verticalMax = (Math.PI * 3) / 4;

function animate() {
  controls.update(clock.getDelta());
}
```

### PointerLockControls

```javascript
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

const controls = new PointerLockControls(camera, document.body);

// 点击锁定指针
document.addEventListener("click", () => {
  controls.lock();
});

controls.addEventListener("lock", () => {
  console.log("Pointer locked");
});

controls.addEventListener("unlock", () => {
  console.log("Pointer unlocked");
});

// 移动
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const moveForward = false;
const moveBackward = false;

document.addEventListener("keydown", (event) => {
  switch (event.code) {
    case "KeyW":
      moveForward = true;
      break;
    case "KeyS":
      moveBackward = true;
      break;
  }
});

function animate() {
  if (controls.isLocked) {
    direction.z = Number(moveForward) - Number(moveBackward);
    direction.normalize();

    velocity.z -= direction.z * 0.1;
    velocity.z *= 0.9; // 摩擦力

    controls.moveForward(-velocity.z);
  }
}
```

### TrackballControls

```javascript
import { TrackballControls } from "three/addons/controls/TrackballControls.js";

const controls = new TrackballControls(camera, renderer.domElement);
controls.rotateSpeed = 2.0;
controls.zoomSpeed = 1.2;
controls.panSpeed = 0.8;
controls.staticMoving = true;

function animate() {
  controls.update();
}
```

### MapControls

```javascript
import { MapControls } from "three/addons/controls/MapControls.js";

const controls = new MapControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.maxPolarAngle = Math.PI / 2;
```

## TransformControls

用于移动/旋转/缩放对象的 Gizmo。

```javascript
import { TransformControls } from "three/addons/controls/TransformControls.js";

const transformControls = new TransformControls(camera, renderer.domElement);
scene.add(transformControls);

// 附加到对象
transformControls.attach(selectedMesh);

// 切换模式
transformControls.setMode("translate"); // 'translate', 'rotate', 'scale'

// 切换空间
transformControls.setSpace("local"); // 'local', 'world'

// 尺寸
transformControls.setSize(1);

// 事件
transformControls.addEventListener("dragging-changed", (event) => {
  // 拖动时禁用轨道控制器
  orbitControls.enabled = !event.value;
});

transformControls.addEventListener("change", () => {
  renderer.render(scene, camera);
});

// 快捷键
window.addEventListener("keydown", (event) => {
  switch (event.key) {
    case "g":
      transformControls.setMode("translate");
      break;
    case "r":
      transformControls.setMode("rotate");
      break;
    case "s":
      transformControls.setMode("scale");
      break;
    case "Escape":
      transformControls.detach();
      break;
  }
});
```

## DragControls

直接拖动对象。

```javascript
import { DragControls } from "three/addons/controls/DragControls.js";

const draggableObjects = [mesh1, mesh2, mesh3];
const dragControls = new DragControls(
  draggableObjects,
  camera,
  renderer.domElement,
);

dragControls.addEventListener("dragstart", (event) => {
  orbitControls.enabled = false;
  event.object.material.emissive.set(0xaaaaaa);
});

dragControls.addEventListener("drag", (event) => {
  // 限制在地平面
  event.object.position.y = 0;
});

dragControls.addEventListener("dragend", (event) => {
  orbitControls.enabled = true;
  event.object.material.emissive.set(0x000000);
});
```

## 选择系统

### 点击选择

```javascript
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedObject = null;

function onMouseDown(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(selectableObjects);

  // 取消选择之前
  if (selectedObject) {
    selectedObject.material.emissive.set(0x000000);
  }

  // 选择新对象
  if (intersects.length > 0) {
    selectedObject = intersects[0].object;
    selectedObject.material.emissive.set(0x444444);
  } else {
    selectedObject = null;
  }
}
```

### 框选

```javascript
import { SelectionBox } from "three/addons/interactive/SelectionBox.js";
import { SelectionHelper } from "three/addons/interactive/SelectionHelper.js";

const selectionBox = new SelectionBox(camera, scene);
const selectionHelper = new SelectionHelper(renderer, "selectBox"); // CSS 类

document.addEventListener("pointerdown", (event) => {
  selectionBox.startPoint.set(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1,
    0.5,
  );
});

document.addEventListener("pointermove", (event) => {
  if (selectionHelper.isDown) {
    selectionBox.endPoint.set(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1,
      0.5,
    );
  }
});

document.addEventListener("pointerup", (event) => {
  selectionBox.endPoint.set(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1,
    0.5,
  );

  const selected = selectionBox.select();
  console.log("Selected objects:", selected);
});
```

### 悬停效果

```javascript
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredObject = null;

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(hoverableObjects);

  // 重置之前悬停
  if (hoveredObject) {
    hoveredObject.material.color.set(hoveredObject.userData.originalColor);
    document.body.style.cursor = "default";
  }

  // 应用新悬停
  if (intersects.length > 0) {
    hoveredObject = intersects[0].object;
    if (!hoveredObject.userData.originalColor) {
      hoveredObject.userData.originalColor =
        hoveredObject.material.color.getHex();
    }
    hoveredObject.material.color.set(0xff6600);
    document.body.style.cursor = "pointer";
  } else {
    hoveredObject = null;
  }
}

window.addEventListener("mousemove", onMouseMove);
```

## 键盘输入

```javascript
const keys = {};

document.addEventListener("keydown", (event) => {
  keys[event.code] = true;
});

document.addEventListener("keyup", (event) => {
  keys[event.code] = false;
});

function update() {
  const speed = 0.1;

  if (keys["KeyW"]) player.position.z -= speed;
  if (keys["KeyS"]) player.position.z += speed;
  if (keys["KeyA"]) player.position.x -= speed;
  if (keys["KeyD"]) player.position.x += speed;
  if (keys["Space"]) player.position.y += speed;
  if (keys["ShiftLeft"]) player.position.y -= speed;
}
```

## 世界坐标与屏幕坐标转换

### 世界到屏幕

```javascript
function worldToScreen(position, camera) {
  const vector = position.clone();
  vector.project(camera);

  return {
    x: ((vector.x + 1) / 2) * window.innerWidth,
    y: (-(vector.y - 1) / 2) * window.innerHeight,
  };
}

// 在 3D 对象上方定位 HTML 元素
const screenPos = worldToScreen(mesh.position, camera);
element.style.left = screenPos.x + "px";
element.style.top = screenPos.y + "px";
```

### 屏幕到世界

```javascript
function screenToWorld(screenX, screenY, camera, targetZ = 0) {
  const vector = new THREE.Vector3(
    (screenX / window.innerWidth) * 2 - 1,
    -(screenY / window.innerHeight) * 2 + 1,
    0.5,
  );

  vector.unproject(camera);

  const dir = vector.sub(camera.position).normalize();
  const distance = (targetZ - camera.position.z) / dir.z;

  return camera.position.clone().add(dir.multiplyScalar(distance));
}
```

### 射线与平面相交

```javascript
function getRayPlaneIntersection(mouse, camera, plane) {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  const intersection = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, intersection);

  return intersection;
}

// 地平面
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const worldPos = getRayPlaneIntersection(mouse, camera, groundPlane);
```

## 事件处理最佳实践

```javascript
class InteractionManager {
  constructor(camera, renderer, scene) {
    this.camera = camera;
    this.renderer = renderer;
    this.scene = scene;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.clickables = [];

    this.bindEvents();
  }

  bindEvents() {
    const canvas = this.renderer.domElement;

    canvas.addEventListener("click", (e) => this.onClick(e));
    canvas.addEventListener("mousemove", (e) => this.onMouseMove(e));
    canvas.addEventListener("touchstart", (e) => this.onTouchStart(e));
  }

  updateMouse(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  getIntersects() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    return this.raycaster.intersectObjects(this.clickables, true);
  }

  onClick(event) {
    this.updateMouse(event);
    const intersects = this.getIntersects();

    if (intersects.length > 0) {
      const object = intersects[0].object;
      if (object.userData.onClick) {
        object.userData.onClick(intersects[0]);
      }
    }
  }

  addClickable(object, callback) {
    this.clickables.push(object);
    object.userData.onClick = callback;
  }

  dispose() {
    // 移除事件监听器
  }
}

// 用法
const interaction = new InteractionManager(camera, renderer, scene);
interaction.addClickable(mesh, (intersect) => {
  console.log("Clicked at:", intersect.point);
});
```

## 性能优化建议

1. **限制射线检测**：对 mousemove 处理器节流
2. **使用层级**：过滤射线检测目标
3. **简单碰撞网格**：使用不可见的更简单几何体进行射线检测
4. **不需要时禁用控制器**：`controls.enabled = false`
5. **批量更新**：分组交互检测

```javascript
// 使用更简单的几何体进行射线检测
const complexMesh = loadedModel;
const collisionMesh = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshBasicMaterial({ visible: false }),
);
collisionMesh.userData.target = complexMesh;
clickables.push(collisionMesh);
```

## 参见

- `references/fundamentals.md` —— 相机与场景搭建
- `references/animation.md` —— 交互动画
- `references/shaders.md` —— 视觉反馈特效
