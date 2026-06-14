---
name: threejs
description: "Use when users request 3D web applications, Three.js projects, WebGL scenes, 3D visualization, interactive 3D, 3D games, VR/AR web experiences, or any browser-based 3D graphics."
license: MIT
metadata:
  version: "1.0.0"
  category: 3d-graphics
---

# Three.js 3D 生产流水线

## 何时使用

当用户请求以下内容时激活：Three.js 项目、WebGL 场景、3D 可视化、交互式 3D、3D 网页游戏、VR/AR 网页体验、3D 数据展示、3D 产品展示、3D 建筑可视化、3D 动画、着色器特效，或任何基于浏览器的 3D 图形。

## 能力概述

使用 Three.js 构建浏览器端 3D 图形与交互体验的生产流水线。可创建 3D 场景、产品展示、数据可视化、游戏原型、建筑漫游、粒子特效、后期处理画面、自定义着色器——输出为可运行的 HTML/JS 或集成到现有项目中。涵盖：场景管理、几何体、PBR 材质、光照与阴影、骨骼动画、射线交互、模型加载、后处理特效、GLSL 着色器、纹理与环境贴图。

## 质量标准

**首次渲染即 excellence。** 首次加载时必须在视觉上令人震撼。默认光照、默认材质、没有阴影的场景是错的。

**统一美学胜过功能数量。** 所有元素必须服务于统一的视觉语言——一致的色温、协调的材质粗糙度、有意义的光照层次。

**性能意识贯穿始终。** 3D 渲染昂贵。始终关注 draw call、纹理内存、阴影贴图分辨率、几何体面数。在添加特效前先测量帧率。

**主动创意。** 如果用户要求"一个旋转的立方体"，交付一个带有环境反射、柔和阴影、呼吸式缩放动画、以及环境雾的立方体。包含至少一个用户没要求但会欣赏的视觉细节。

**内存管理是工程师的尊严。** Three.js 对象不会自动释放 GPU 内存。对不再使用的 geometry、material、texture 始终调用 `dispose()`。

## 技术栈

| 层级 | 工具 | 用途 |
|------|------|------|
| 核心 | Three.js r160+ (ES modules) | 场景图、渲染器、数学、几何体、材质 |
| 控制器 | `three/addons/controls/` | OrbitControls、FlyControls、DragControls |
| 加载器 | `three/addons/loaders/` | GLTF、OBJ、FBX、STL、DRACO、KTX2 |
| 后处理 | `three/addons/postprocessing/` | EffectComposer、泛光、SSAO、景深、胶片颗粒 |
| 数学 | `three/src/math/` | Vector3、Matrix4、Quaternion、Euler、Color |
| 着色器 | 自定义 GLSL | ShaderMaterial、RawShaderMaterial、后期处理 ShaderPass |

## 主题索引

| 主题 | 参考文档 | 核心内容 |
|------|----------|----------|
| **基础** | `references/fundamentals.md` | Scene、Camera、Renderer、Object3D、数学工具 |
| **几何体** | `references/geometry.md` | 内置形状、BufferGeometry、InstancedMesh、LOD |
| **材质** | `references/materials.md` | PBR、Standard/Physical、ShaderMaterial、透明与混合 |
| **光照** | `references/lighting.md` | 光源类型、阴影、环境贴图、IBL、三点布光 |
| **动画** | `references/animation.md` | AnimationMixer、GLTF 动画、骨骼动画、Morph targets |
| **交互** | `references/interaction.md` | Raycaster、控制器、鼠标/触摸/键盘输入 |
| **加载器** | `references/loaders.md` | GLTF/GLB、OBJ/FBX/STL、加载进度、缓存、错误处理 |
| **后处理** | `references/postprocessing.md` | EffectComposer、泛光、SSAO、景深、自定义 ShaderPass |
| **着色器** | `references/shaders.md` | ShaderMaterial、GLSL 内置函数、常用着色器模式 |
| **纹理** | `references/textures.md` | UV 映射、环境贴图、PBR 贴图集、RenderTarget、程序化纹理 |

## 3D 生产流水线

每个项目遵循相同的路径：

```
概念 → 场景搭建 → 资源加载 → 材质光照 → 动画交互 → 后期处理 → 性能优化
```

1. **概念** —— 阐明创意愿景：情绪、构图、色彩世界、独特之处
2. **场景搭建** —— 创建 Scene、Camera、Renderer，设置渲染参数（antialias、shadowMap、colorSpace）
3. **资源加载** —— 使用合适的 Loader 加载模型/纹理，处理加载进度与错误回退
4. **材质光照** —— 配置 PBR 材质、设置光源（至少环境光+方向光+补光）、开启阴影
5. **动画交互** —— 实现 AnimationMixer、OrbitControls、Raycaster 交互、响应式布局
6. **后期处理** —— 按需添加泛光、色调映射、色彩校正
7. **性能优化** —— InstancedMesh 合并、纹理压缩、LOD、阴影质量调优、内存 dispose

## 关键实现要点

### 渲染循环

始终使用 `requestAnimationFrame`，在循环中更新 controls、mixer、uniforms：

```javascript
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  controls.update();
  mixer.update(delta);
  composer.render();
}
animate();
```

### 内存管理

```javascript
// 清理几何体
geometry.dispose();
// 清理材质
material.dispose();
// 清理纹理
texture.dispose();
// 清理渲染目标
renderTarget.dispose();
```

### 响应式

```javascript
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});
```

### 阴影优化

```javascript
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
```

### ColorSpace 与 Gamma

```javascript
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
```

## 不要做

- 不要在生产环境使用 `MeshBasicMaterial` 作为主体材质（不接受光照，看起来扁平）
- 不要加载未压缩的纹理到移动端
- 不要为每个物体单独创建相同的几何体（使用 `.clone()` 或 InstancedMesh）
- 不要忘记在场景卸载时 dispose 所有 Three.js 对象
- 不要在动画循环中创建新的对象（Vector3、Color 等），使用 `.set()` 复用

## 参考文档索引

- `references/fundamentals.md` —— Scene、Camera、Renderer 核心概念
- `references/geometry.md` —— 所有几何体类型与高级用法
- `references/materials.md` —— 材质系统与 PBR 工作流
- `references/lighting.md` —— 光照、阴影、环境贴图
- `references/animation.md` —— 动画系统与程序化动画
- `references/interaction.md` —— 射线检测与用户输入
- `references/loaders.md` —— 模型加载与资源管理
- `references/postprocessing.md` —— 后期处理特效栈
- `references/shaders.md` —— 自定义着色器开发
- `references/textures.md` —— 纹理映射与高级纹理技术
