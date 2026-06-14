# Three.js 几何体

## 快速开始

```javascript
import * as THREE from "three";

// 内置几何体
const box = new THREE.BoxGeometry(1, 1, 1);
const sphere = new THREE.SphereGeometry(0.5, 32, 32);
const plane = new THREE.PlaneGeometry(10, 10);

// 创建网格
const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const mesh = new THREE.Mesh(box, material);
scene.add(mesh);
```

## 内置几何体

### 基本形状

```javascript
// 立方体 - width, height, depth, widthSegments, heightSegments, depthSegments
new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);

// 球体 - radius, widthSegments, heightSegments, phiStart, phiLength, thetaStart, thetaLength
new THREE.SphereGeometry(1, 32, 32);
new THREE.SphereGeometry(1, 32, 32, 0, Math.PI * 2, 0, Math.PI); // 完整球体
new THREE.SphereGeometry(1, 32, 32, 0, Math.PI); // 半球

// 平面 - width, height, widthSegments, heightSegments
new THREE.PlaneGeometry(10, 10, 1, 1);

// 圆形 - radius, segments, thetaStart, thetaLength
new THREE.CircleGeometry(1, 32);
new THREE.CircleGeometry(1, 32, 0, Math.PI); // 半圆

// 圆柱体 - radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded
new THREE.CylinderGeometry(1, 1, 2, 32, 1, false);
new THREE.CylinderGeometry(0, 1, 2, 32); // 圆锥
new THREE.CylinderGeometry(1, 1, 2, 6); // 六棱柱

// 圆锥 - radius, height, radialSegments, heightSegments, openEnded
new THREE.ConeGeometry(1, 2, 32, 1, false);

// 圆环 - radius, tube, radialSegments, tubularSegments, arc
new THREE.TorusGeometry(1, 0.4, 16, 100);

// 纽结圆环 - radius, tube, tubularSegments, radialSegments, p, q
new THREE.TorusKnotGeometry(1, 0.4, 100, 16, 2, 3);

// 圆环面 - innerRadius, outerRadius, thetaSegments, phiSegments
new THREE.RingGeometry(0.5, 1, 32, 1);
```

### 高级形状

```javascript
// 胶囊体 - radius, length, capSegments, radialSegments
new THREE.CapsuleGeometry(0.5, 1, 4, 8);

// 十二面体 - radius, detail
new THREE.DodecahedronGeometry(1, 0);

// 二十面体 - radius, detail（0 = 20 个面，越高越平滑）
new THREE.IcosahedronGeometry(1, 0);

// 八面体 - radius, detail
new THREE.OctahedronGeometry(1, 0);

// 四面体 - radius, detail
new THREE.TetrahedronGeometry(1, 0);

// 多面体 - vertices, indices, radius, detail
const vertices = [1, 1, 1, -1, -1, 1, -1, 1, -1, 1, -1, -1];
const indices = [2, 1, 0, 0, 3, 2, 1, 3, 0, 2, 3, 1];
new THREE.PolyhedronGeometry(vertices, indices, 1, 0);
```

### 基于路径的形状

```javascript
// 车削体 - points[], segments, phiStart, phiLength
const points = [
  new THREE.Vector2(0, 0),
  new THREE.Vector2(0.5, 0),
  new THREE.Vector2(0.5, 1),
  new THREE.Vector2(0, 1),
];
new THREE.LatheGeometry(points, 32);

// 挤压体 - shape, options
const shape = new THREE.Shape();
shape.moveTo(0, 0);
shape.lineTo(1, 0);
shape.lineTo(1, 1);
shape.lineTo(0, 1);
shape.lineTo(0, 0);

const extrudeSettings = {
  steps: 2,
  depth: 1,
  bevelEnabled: true,
  bevelThickness: 0.1,
  bevelSize: 0.1,
  bevelSegments: 3,
};
new THREE.ExtrudeGeometry(shape, extrudeSettings);

// 管道体 - path, tubularSegments, radius, radialSegments, closed
const curve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(1, 0, 0),
]);
new THREE.TubeGeometry(curve, 64, 0.2, 8, false);
```

### 文字几何体

```javascript
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";

const loader = new FontLoader();
loader.load("fonts/helvetiker_regular.typeface.json", (font) => {
  const geometry = new TextGeometry("Hello", {
    font: font,
    size: 1,
    depth: 0.2, // 旧版本为 'height'
    curveSegments: 12,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.02,
    bevelSegments: 5,
  });

  // 文字居中
  geometry.computeBoundingBox();
  geometry.center();

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
});
```

## BufferGeometry

所有几何体的基类。以类型化数组存储数据以实现 GPU 效率。

### 自定义 BufferGeometry

```javascript
const geometry = new THREE.BufferGeometry();

// 顶点（每个顶点 3 个浮点数：x, y, z）
const vertices = new Float32Array([
  -1, -1, 0, // vertex 0
  1, -1, 0, // vertex 1
  1, 1, 0, // vertex 2
  -1, 1, 0, // vertex 3
]);
geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));

// 索引（用于索引几何体 - 复用顶点）
const indices = new Uint16Array([
  0, 1, 2, // 三角形 1
  0, 2, 3, // 三角形 2
]);
geometry.setIndex(new THREE.BufferAttribute(indices, 1));

// 法线（光照必需）
const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));

// UV（用于纹理映射）
const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

// 颜色（逐顶点颜色）
const colors = new Float32Array([
  1, 0, 0, // 红
  0, 1, 0, // 绿
  0, 0, 1, // 蓝
  1, 1, 0, // 黄
]);
geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
// 配合：material.vertexColors = true
```

### BufferAttribute 类型

```javascript
// 常用属性类型
new THREE.BufferAttribute(array, itemSize);

// 类型化数组选项
new Float32Array(count * itemSize); // 位置、法线、UV
new Uint16Array(count); // 索引（最多 65535 个顶点）
new Uint32Array(count); // 索引（更大网格）
new Uint8Array(count * itemSize); // 颜色（0-255 范围）

// 每项大小
// Position: 3 (x, y, z)
// Normal: 3 (x, y, z)
// UV: 2 (u, v)
// Color: 3 (r, g, b) 或 4 (r, g, b, a)
// Index: 1
```

### 修改 BufferGeometry

```javascript
const positions = geometry.attributes.position;

// 修改顶点
positions.setXYZ(index, x, y, z);

// 访问顶点
const x = positions.getX(index);
const y = positions.getY(index);
const z = positions.getZ(index);

// 标记 GPU 更新
positions.needsUpdate = true;

// 位置变化后重新计算法线
geometry.computeVertexNormals();

// 变化后重新计算包围盒/包围球
geometry.computeBoundingBox();
geometry.computeBoundingSphere();
```

### 交错缓冲区（高级）

```javascript
// 大网格的更高效内存布局
const interleavedBuffer = new THREE.InterleavedBuffer(
  new Float32Array([
    // pos.x, pos.y, pos.z, uv.u, uv.v（每个顶点重复）
    -1, -1, 0, 0, 0, 1, -1, 0, 1, 0, 1, 1, 0, 1, 1, -1, 1, 0, 0, 1,
  ]),
  5, // 步长（每个顶点浮点数）
);

geometry.setAttribute(
  "position",
  new THREE.InterleavedBufferAttribute(interleavedBuffer, 3, 0),
); // size 3, offset 0
geometry.setAttribute(
  "uv",
  new THREE.InterleavedBufferAttribute(interleavedBuffer, 2, 3),
); // size 2, offset 3
```

## EdgesGeometry 与 WireframeGeometry

```javascript
// 边线（仅硬边）
const edges = new THREE.EdgesGeometry(boxGeometry, 15); // 15 = 阈值角度
const edgeMesh = new THREE.LineSegments(
  edges,
  new THREE.LineBasicMaterial({ color: 0xffffff }),
);

// 线框（所有三角形）
const wireframe = new THREE.WireframeGeometry(boxGeometry);
const wireMesh = new THREE.LineSegments(
  wireframe,
  new THREE.LineBasicMaterial({ color: 0xffffff }),
);
```

## 点（Points）

```javascript
// 创建点云
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(1000 * 3);

for (let i = 0; i < 1000; i++) {
  positions[i * 3] = (Math.random() - 0.5) * 10;
  positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
  positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
}

geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

const material = new THREE.PointsMaterial({
  size: 0.1,
  sizeAttenuation: true, // 距离越远尺寸越小
  color: 0xffffff,
});

const points = new THREE.Points(geometry, material);
scene.add(points);
```

## 线（Lines）

```javascript
// 线（连续点）
const points = [
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(1, 0, 0),
];
const geometry = new THREE.BufferGeometry().setFromPoints(points);
const line = new THREE.Line(
  geometry,
  new THREE.LineBasicMaterial({ color: 0xff0000 }),
);

// 线环（闭合循环）
const loop = new THREE.LineLoop(geometry, material);

// 线段（成对点）
const segmentsGeometry = new THREE.BufferGeometry();
segmentsGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(
    new Float32Array([
      -1, 0, 0, 0, 1, 0, // 线段 1
      0, 1, 0, 1, 0, 0, // 线段 2
    ]),
    3,
  ),
);
const segments = new THREE.LineSegments(segmentsGeometry, material);
```

## InstancedMesh

高效渲染相同几何体的多个副本。

```javascript
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const count = 1000;

const instancedMesh = new THREE.InstancedMesh(geometry, material, count);

// 为每个实例设置变换
const dummy = new THREE.Object3D();
const matrix = new THREE.Matrix4();

for (let i = 0; i < count; i++) {
  dummy.position.set(
    (Math.random() - 0.5) * 20,
    (Math.random() - 0.5) * 20,
    (Math.random() - 0.5) * 20,
  );
  dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
  dummy.scale.setScalar(0.5 + Math.random());
  dummy.updateMatrix();

  instancedMesh.setMatrixAt(i, dummy.matrix);
}

// 标记 GPU 更新
instancedMesh.instanceMatrix.needsUpdate = true;

// 可选：逐实例颜色
instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(
  new Float32Array(count * 3),
  3,
);
for (let i = 0; i < count; i++) {
  instancedMesh.setColorAt(
    i,
    new THREE.Color(Math.random(), Math.random(), Math.random()),
  );
}
instancedMesh.instanceColor.needsUpdate = true;

scene.add(instancedMesh);
```

### 运行时更新实例

```javascript
// 更新单个实例
const matrix = new THREE.Matrix4();
instancedMesh.getMatrixAt(index, matrix);
// 修改矩阵...
instancedMesh.setMatrixAt(index, matrix);
instancedMesh.instanceMatrix.needsUpdate = true;

// 实例化网格的射线检测
const intersects = raycaster.intersectObject(instancedMesh);
if (intersects.length > 0) {
  const instanceId = intersects[0].instanceId;
}
```

## InstancedBufferGeometry（高级）

用于超出变换/颜色的自定义逐实例属性。

```javascript
const geometry = new THREE.InstancedBufferGeometry();
geometry.copy(new THREE.BoxGeometry(1, 1, 1));

// 添加逐实例属性
const offsets = new Float32Array(count * 3);
for (let i = 0; i < count; i++) {
  offsets[i * 3] = Math.random() * 10;
  offsets[i * 3 + 1] = Math.random() * 10;
  offsets[i * 3 + 2] = Math.random() * 10;
}
geometry.setAttribute("offset", new THREE.InstancedBufferAttribute(offsets, 3));

// 在着色器中使用
// attribute vec3 offset;
// vec3 transformed = position + offset;
```

## 几何体工具

```javascript
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

// 合并几何体（必须具有相同属性）
const merged = BufferGeometryUtils.mergeGeometries([geo1, geo2, geo3]);

// 带组合并（用于多材质）
const merged = BufferGeometryUtils.mergeGeometries([geo1, geo2], true);

// 计算切线（法线贴图需要）
BufferGeometryUtils.computeTangents(geometry);

// 交错属性以获得更好性能
const interleaved = BufferGeometryUtils.interleaveAttributes([
  geometry.attributes.position,
  geometry.attributes.normal,
  geometry.attributes.uv,
]);
```

## 常用模式

### 几何体居中

```javascript
geometry.computeBoundingBox();
geometry.center(); // 移动顶点使中心位于原点
```

### 缩放至适配

```javascript
geometry.computeBoundingBox();
const size = new THREE.Vector3();
geometry.boundingBox.getSize(size);
const maxDim = Math.max(size.x, size.y, size.z);
geometry.scale(1 / maxDim, 1 / maxDim, 1 / maxDim);
```

### 克隆与变换

```javascript
const clone = geometry.clone();
clone.rotateX(Math.PI / 2);
clone.translate(0, 1, 0);
clone.scale(2, 2, 2);
```

### 变形目标（Morph Targets）

```javascript
// 基础几何体
const geometry = new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);

// 创建变形目标
const morphPositions = geometry.attributes.position.array.slice();
for (let i = 0; i < morphPositions.length; i += 3) {
  morphPositions[i] *= 2; // X 轴放大
  morphPositions[i + 1] *= 0.5; // Y 轴压缩
}

geometry.morphAttributes.position = [
  new THREE.BufferAttribute(new Float32Array(morphPositions), 3),
];

const mesh = new THREE.Mesh(geometry, material);
mesh.morphTargetInfluences[0] = 0.5; // 50% 混合
```

## 性能优化建议

1. **使用索引几何体**：用索引复用顶点
2. **合并静态网格**：使用 `mergeGeometries` 减少绘制调用
3. **使用 InstancedMesh**：用于大量相同对象
4. **选择合适的分段数**：分段越多越平滑但越慢
5. **释放不用的几何体**：`geometry.dispose()`

```javascript
// 常见用途的合适分段数
new THREE.SphereGeometry(1, 32, 32); // 良好质量
new THREE.SphereGeometry(1, 64, 64); // 高质量
new THREE.SphereGeometry(1, 16, 16); // 性能模式

// 用完释放
geometry.dispose();
```

## 参见

- `references/fundamentals.md` —— 场景搭建与 Object3D
- `references/materials.md` —— 网格材质类型
- `references/shaders.md` —— 自定义顶点操作
