# Three.js 动画

## 快速开始

```javascript
import * as THREE from "three";

// 简单程序化动画
const clock = new THREE.Clock();

function animate() {
  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  mesh.rotation.y += delta;
  mesh.position.y = Math.sin(elapsed) * 0.5;

  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
```

## 动画系统概览

Three.js 动画系统有三个主要组件：

1. **AnimationClip** —— 关键帧数据容器
2. **AnimationMixer** —— 在根对象上播放动画
3. **AnimationAction** —— 控制片段的播放

## AnimationClip

存储关键帧动画数据。

```javascript
// 创建动画片段
const times = [0, 1, 2]; // 关键帧时间（秒）
const values = [0, 1, 0]; // 每个关键帧的值

const track = new THREE.NumberKeyframeTrack(
  ".position[y]", // 属性路径
  times,
  values,
);

const clip = new THREE.AnimationClip("bounce", 2, [track]);
```

### 关键帧轨道类型

```javascript
// 数值轨道（单值）
new THREE.NumberKeyframeTrack(".opacity", times, [1, 0]);
new THREE.NumberKeyframeTrack(".material.opacity", times, [1, 0]);

// 向量轨道（位置、缩放）
new THREE.VectorKeyframeTrack(".position", times, [
  0, 0, 0, // t=0
  1, 2, 0, // t=1
  0, 0, 0, // t=2
]);

// 四元数轨道（旋转）
const q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0));
const q2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0));
new THREE.QuaternionKeyframeTrack(
  ".quaternion",
  [0, 1],
  [q1.x, q1.y, q1.z, q1.w, q2.x, q2.y, q2.z, q2.w],
);

// 颜色轨道
new THREE.ColorKeyframeTrack(".material.color", times, [
  1, 0, 0, // 红
  0, 1, 0, // 绿
  0, 0, 1, // 蓝
]);

// 布尔轨道
new THREE.BooleanKeyframeTrack(".visible", [0, 0.5, 1], [true, false, true]);

// 字符串轨道（用于变形目标）
new THREE.StringKeyframeTrack(
  ".morphTargetInfluences[smile]",
  [0, 1],
  ["0", "1"],
);
```

### 插值模式

```javascript
const track = new THREE.VectorKeyframeTrack(".position", times, values);

// 插值
track.setInterpolation(THREE.InterpolateLinear); // 默认
track.setInterpolation(THREE.InterpolateSmooth); // 三次样条
track.setInterpolation(THREE.InterpolateDiscrete); // 阶梯函数
```

## AnimationMixer

在对象及其后代上播放动画。

```javascript
const mixer = new THREE.AnimationMixer(model);

// 从片段创建动作
const action = mixer.clipAction(clip);
action.play();

// 在动画循环中更新
function animate() {
  const delta = clock.getDelta();
  mixer.update(delta); // 必需！

  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
```

### Mixer 事件

```javascript
mixer.addEventListener("finished", (e) => {
  console.log("Animation finished:", e.action.getClip().name);
});

mixer.addEventListener("loop", (e) => {
  console.log("Animation looped:", e.action.getClip().name);
});
```

## AnimationAction

控制动画片段的播放。

```javascript
const action = mixer.clipAction(clip);

// 播放控制
action.play();
action.stop();
action.reset();
action.halt(fadeOutDuration);

// 播放状态
action.isRunning();
action.isScheduled();

// 时间控制
action.time = 0.5; // 当前时间
action.timeScale = 1; // 播放速度（负值 = 倒放）
action.paused = false;

// 权重（用于混合）
action.weight = 1; // 0-1，对最终姿态的贡献
action.setEffectiveWeight(1);

// 循环模式
action.loop = THREE.LoopRepeat; // 默认：无限循环
action.loop = THREE.LoopOnce; // 播放一次后停止
action.loop = THREE.LoopPingPong; // 往返交替
action.repetitions = 3; // 循环次数（默认 Infinity）

// 钳制
action.clampWhenFinished = true; // 结束时保持最后一帧

// 混合
action.blendMode = THREE.NormalAnimationBlendMode;
action.blendMode = THREE.AdditiveAnimationBlendMode;
```

### 淡入淡出

```javascript
// 淡入
action.reset().fadeIn(0.5).play();

// 淡出
action.fadeOut(0.5);

// 动画间交叉淡入淡出
const action1 = mixer.clipAction(clip1);
const action2 = mixer.clipAction(clip2);

action1.play();

// 之后交叉淡入淡出到 action2
action1.crossFadeTo(action2, 0.5, true);
action2.play();
```

## 加载 GLTF 动画

骨骼动画最常见的来源。

```javascript
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const loader = new GLTFLoader();
loader.load("model.glb", (gltf) => {
  const model = gltf.scene;
  scene.add(model);

  // 创建 mixer
  const mixer = new THREE.AnimationMixer(model);

  // 获取所有片段
  const clips = gltf.animations;
  console.log(
    "Available animations:",
    clips.map((c) => c.name),
  );

  // 播放第一个动画
  if (clips.length > 0) {
    const action = mixer.clipAction(clips[0]);
    action.play();
  }

  // 按名称播放特定动画
  const walkClip = THREE.AnimationClip.findByName(clips, "Walk");
  if (walkClip) {
    mixer.clipAction(walkClip).play();
  }

  // 存储 mixer 供更新循环使用
  window.mixer = mixer;
});

// 动画循环
function animate() {
  const delta = clock.getDelta();
  if (window.mixer) window.mixer.update(delta);

  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
```

## 骨骼动画

### 骨架与骨骼

```javascript
// 从蒙皮网格访问骨架
const skinnedMesh = model.getObjectByProperty("type", "SkinnedMesh");
const skeleton = skinnedMesh.skeleton;

// 访问骨骼
skeleton.bones.forEach((bone) => {
  console.log(bone.name, bone.position, bone.rotation);
});

// 按名称查找特定骨骼
const headBone = skeleton.bones.find((b) => b.name === "Head");
if (headBone) headBone.rotation.y = Math.PI / 4; // 转头

// 骨架辅助器
const helper = new THREE.SkeletonHelper(model);
scene.add(helper);
```

### 程序化骨骼动画

```javascript
function animate() {
  const time = clock.getElapsedTime();

  // 动画化骨骼
  const headBone = skeleton.bones.find((b) => b.name === "Head");
  if (headBone) {
    headBone.rotation.y = Math.sin(time) * 0.3;
  }

  // 如果同时播放片段则更新 mixer
  mixer.update(clock.getDelta());
}
```

### 骨骼附着

```javascript
// 将对象附加到骨骼
const weapon = new THREE.Mesh(weaponGeometry, weaponMaterial);
const handBone = skeleton.bones.find((b) => b.name === "RightHand");
if (handBone) handBone.add(weapon);

// 偏移附着
weapon.position.set(0, 0, 0.5);
weapon.rotation.set(0, Math.PI / 2, 0);
```

## 变形目标（Morph Targets）

在不同网格形状之间混合。

```javascript
// 变形目标存储在几何体中
const geometry = mesh.geometry;
console.log("Morph attributes:", Object.keys(geometry.morphAttributes));

// 访问变形目标权重
mesh.morphTargetInfluences; // 权重数组
mesh.morphTargetDictionary; // 名称到索引映射

// 按索引设置变形目标
mesh.morphTargetInfluences[0] = 0.5;

// 按名称设置
const smileIndex = mesh.morphTargetDictionary["smile"];
mesh.morphTargetInfluences[smileIndex] = 1;
```

### 动画化变形目标

```javascript
// 程序化
function animate() {
  const t = clock.getElapsedTime();
  mesh.morphTargetInfluences[0] = (Math.sin(t) + 1) / 2;
}

// 使用关键帧动画
const track = new THREE.NumberKeyframeTrack(
  ".morphTargetInfluences[smile]",
  [0, 0.5, 1],
  [0, 1, 0],
);
const clip = new THREE.AnimationClip("smile", 1, [track]);
mixer.clipAction(clip).play();
```

## 动画混合

将多个动画混合在一起。

```javascript
// 设置动作
const idleAction = mixer.clipAction(idleClip);
const walkAction = mixer.clipAction(walkClip);
const runAction = mixer.clipAction(runClip);

// 以不同权重播放所有动作
idleAction.play();
walkAction.play();
runAction.play();

// 设置初始权重
idleAction.setEffectiveWeight(1);
walkAction.setEffectiveWeight(0);
runAction.setEffectiveWeight(0);

// 基于速度混合
function updateAnimations(speed) {
  if (speed < 0.1) {
    idleAction.setEffectiveWeight(1);
    walkAction.setEffectiveWeight(0);
    runAction.setEffectiveWeight(0);
  } else if (speed < 5) {
    const t = speed / 5;
    idleAction.setEffectiveWeight(1 - t);
    walkAction.setEffectiveWeight(t);
    runAction.setEffectiveWeight(0);
  } else {
    const t = Math.min((speed - 5) / 5, 1);
    idleAction.setEffectiveWeight(0);
    walkAction.setEffectiveWeight(1 - t);
    runAction.setEffectiveWeight(t);
  }
}
```

### 加法混合

```javascript
// 基础姿态
const baseAction = mixer.clipAction(baseClip);
baseAction.play();

// 加法层（例如呼吸）
const additiveAction = mixer.clipAction(additiveClip);
additiveAction.blendMode = THREE.AdditiveAnimationBlendMode;
additiveAction.play();

// 转换为加法片段
THREE.AnimationUtils.makeClipAdditive(additiveClip);
```

## 动画工具

```javascript
import * as THREE from "three";

// 按名称查找片段
const clip = THREE.AnimationClip.findByName(clips, "Walk");

// 创建子片段
const subclip = THREE.AnimationUtils.subclip(clip, "subclip", 0, 30, 30);

// 转换为加法
THREE.AnimationUtils.makeClipAdditive(clip);
THREE.AnimationUtils.makeClipAdditive(clip, 0, referenceClip);

// 克隆片段
const clone = clip.clone();

// 获取片段时长
clip.duration;

// 优化片段（删除冗余关键帧）
clip.optimize();

// 重置片段到第一帧
clip.resetDuration();
```

## 程序化动画模式

### 平滑阻尼

```javascript
// 平滑跟随/插值
const target = new THREE.Vector3();
const current = new THREE.Vector3();
const velocity = new THREE.Vector3();

function smoothDamp(current, target, velocity, smoothTime, deltaTime) {
  const omega = 2 / smoothTime;
  const x = omega * deltaTime;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current.clone().sub(target);
  const temp = velocity
    .clone()
    .add(change.clone().multiplyScalar(omega))
    .multiplyScalar(deltaTime);
  velocity.sub(temp.clone().multiplyScalar(omega)).multiplyScalar(exp);
  return target.clone().add(change.add(temp).multiplyScalar(exp));
}

function animate() {
  current.copy(smoothDamp(current, target, velocity, 0.3, delta));
  mesh.position.copy(current);
}
```

### 弹簧物理

```javascript
class Spring {
  constructor(stiffness = 100, damping = 10) {
    this.stiffness = stiffness;
    this.damping = damping;
    this.position = 0;
    this.velocity = 0;
    this.target = 0;
  }

  update(dt) {
    const force = -this.stiffness * (this.position - this.target);
    const dampingForce = -this.damping * this.velocity;
    this.velocity += (force + dampingForce) * dt;
    this.position += this.velocity * dt;
    return this.position;
  }
}

const spring = new Spring(100, 10);
spring.target = 1;

function animate() {
  mesh.position.y = spring.update(delta);
}
```

### 振荡

```javascript
function animate() {
  const t = clock.getElapsedTime();

  // 正弦波
  mesh.position.y = Math.sin(t * 2) * 0.5;

  // 弹跳
  mesh.position.y = Math.abs(Math.sin(t * 3)) * 2;

  // 圆周运动
  mesh.position.x = Math.cos(t) * 2;
  mesh.position.z = Math.sin(t) * 2;

  // 8 字形
  mesh.position.x = Math.sin(t) * 2;
  mesh.position.z = Math.sin(t * 2) * 1;
}
```

## 性能优化建议

1. **共享片段**：同一 AnimationClip 可用于多个 mixer
2. **优化片段**：调用 `clip.optimize()` 删除冗余关键帧
3. **离屏时禁用**：不可见对象停止 mixer 更新
4. **动画使用 LOD**：远处角色使用更简单的骨骼
5. **限制活动 mixer**：每个 mixer.update() 都有开销

```javascript
// 不可见时暂停动画
mesh.onBeforeRender = () => {
  action.paused = false;
};

mesh.onAfterRender = () => {
  // 检查下一帧是否可见
  if (!isInFrustum(mesh)) {
    action.paused = true;
  }
};

// 缓存片段
const clipCache = new Map();
function getClip(name) {
  if (!clipCache.has(name)) {
    clipCache.set(name, loadClip(name));
  }
  return clipCache.get(name);
}
```

## 参见

- `references/loaders.md` —— 加载带动画的 GLTF 模型
- `references/fundamentals.md` —— 时钟与动画循环
- `references/shaders.md` —— 着色器中的顶点动画
