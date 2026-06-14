# Three.js 后处理

## 快速开始

```javascript
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

// 设置 composer
const composer = new EffectComposer(renderer);

// 渲染场景
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// 添加泛光
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.5, // 强度
  0.4, // 半径
  0.85, // 阈值
);
composer.addPass(bloomPass);

// 动画循环 - 使用 composer 而非 renderer
function animate() {
  requestAnimationFrame(animate);
  composer.render(); // 不是 renderer.render()
}
```

## EffectComposer 设置

```javascript
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";

const composer = new EffectComposer(renderer);

// 第一遍：渲染场景
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// 添加更多 passes...
composer.addPass(effectPass);

// 最后一遍应渲染到屏幕
effectPass.renderToScreen = true; // 最后一遍默认

// 处理大小变化
function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  composer.setSize(width, height);
}
```

## 常用特效

### 泛光（Bloom）

```javascript
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.5, // 强度 - 辉光强度
  0.4, // 半径 - 辉光扩散
  0.85, // 阈值 - 亮度阈值
);

composer.addPass(bloomPass);

// 运行时调整
bloomPass.strength = 2.0;
bloomPass.threshold = 0.5;
bloomPass.radius = 0.8;
```

### 选择性泛光

仅对特定对象应用泛光。

```javascript
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

// 层级设置
const BLOOM_LAYER = 1;
const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM_LAYER);

// 标记要泛光的对象
glowingMesh.layers.enable(BLOOM_LAYER);

// 非泛光对象的暗色材质
const darkMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
const materials = {};

function darkenNonBloomed(obj) {
  if (obj.isMesh && !bloomLayer.test(obj.layers)) {
    materials[obj.uuid] = obj.material;
    obj.material = darkMaterial;
  }
}

function restoreMaterial(obj) {
  if (materials[obj.uuid]) {
    obj.material = materials[obj.uuid];
    delete materials[obj.uuid];
  }
}

// 自定义渲染循环
function render() {
  // 渲染泛光 pass
  scene.traverse(darkenNonBloomed);
  composer.render();
  scene.traverse(restoreMaterial);

  // 在泛光上渲染最终场景
  renderer.render(scene, camera);
}
```

### FXAA（抗锯齿）

```javascript
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";

const fxaaPass = new ShaderPass(FXAAShader);
fxaaPass.material.uniforms["resolution"].value.set(
  1 / window.innerWidth,
  1 / window.innerHeight,
);

composer.addPass(fxaaPass);

// 大小变化时更新
function onResize() {
  fxaaPass.material.uniforms["resolution"].value.set(
    1 / window.innerWidth,
    1 / window.innerHeight,
  );
}
```

### SMAA（更好的抗锯齿）

```javascript
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";

const smaaPass = new SMAAPass(
  window.innerWidth * renderer.getPixelRatio(),
  window.innerHeight * renderer.getPixelRatio(),
);

composer.addPass(smaaPass);
```

### SSAO（环境光遮蔽）

```javascript
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";

const ssaoPass = new SSAOPass(
  scene,
  camera,
  window.innerWidth,
  window.innerHeight,
);
ssaoPass.kernelRadius = 16;
ssaoPass.minDistance = 0.005;
ssaoPass.maxDistance = 0.1;

composer.addPass(ssaoPass);

// 输出模式
ssaoPass.output = SSAOPass.OUTPUT.Default;
// SSAOPass.OUTPUT.Default - 最终合成输出
// SSAOPass.OUTPUT.SSAO - 仅 AO
// SSAOPass.OUTPUT.Blur - 模糊后的 AO
// SSAOPass.OUTPUT.Depth - 深度缓冲
// SSAOPass.OUTPUT.Normal - 法线缓冲
```

### 景深（DOF）

```javascript
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";

const bokehPass = new BokehPass(scene, camera, {
  focus: 10.0, // 焦距
  aperture: 0.025, // 光圈（越小景深越大）
  maxblur: 0.01, // 最大模糊量
});

composer.addPass(bokehPass);

// 动态更新焦点
bokehPass.uniforms["focus"].value = distanceToTarget;
```

### 胶片颗粒

```javascript
import { FilmPass } from "three/addons/postprocessing/FilmPass.js";

const filmPass = new FilmPass(
  0.35, // 噪声强度
  0.5, // 扫描线强度
  648, // 扫描线数量
  false, // 灰度
);

composer.addPass(filmPass);
```

### 暗角

```javascript
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { VignetteShader } from "three/addons/shaders/VignetteShader.js";

const vignettePass = new ShaderPass(VignetteShader);
vignettePass.uniforms["offset"].value = 1.0; // 暗角大小
vignettePass.uniforms["darkness"].value = 1.0; // 暗角强度

composer.addPass(vignettePass);
```

### 色彩校正

```javascript
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { ColorCorrectionShader } from "three/addons/shaders/ColorCorrectionShader.js";

const colorPass = new ShaderPass(ColorCorrectionShader);
colorPass.uniforms["powRGB"].value = new THREE.Vector3(1.2, 1.2, 1.2); // 幂

colorPass.uniforms["mulRGB"].value = new THREE.Vector3(1.0, 1.0, 1.0); // 乘数

composer.addPass(colorPass);
```

### Gamma 校正

```javascript
import { GammaCorrectionShader } from "three/addons/shaders/GammaCorrectionShader.js";

const gammaPass = new ShaderPass(GammaCorrectionShader);
composer.addPass(gammaPass);
```

### 像素化

```javascript
import { RenderPixelatedPass } from "three/addons/postprocessing/RenderPixelatedPass.js";

const pixelPass = new RenderPixelatedPass(6, scene, camera); // 6 = 像素大小

composer.addPass(pixelPass);
```

### 故障效果

```javascript
import { GlitchPass } from "three/addons/postprocessing/GlitchPass.js";

const glitchPass = new GlitchPass();
glitchPass.goWild = false; // 持续故障

composer.addPass(glitchPass);
```

### 半调

```javascript
import { HalftonePass } from "three/addons/postprocessing/HalftonePass.js";

const halftonePass = new HalftonePass(window.innerWidth, window.innerHeight, {
  shape: 1, // 1 = 点, 2 = 椭圆, 3 = 线, 4 = 方
  radius: 4, // 点大小
  rotateR: Math.PI / 12,
  rotateB: (Math.PI / 12) * 2,
  rotateG: (Math.PI / 12) * 3,
  scatter: 0,
  blending: 1,
  blendingMode: 1,
  greyscale: false,
});

composer.addPass(halftonePass);
```

### 描边

```javascript
import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";

const outlinePass = new OutlinePass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  scene,
  camera,
);

outlinePass.edgeStrength = 3;
outlinePass.edgeGlow = 0;
outlinePass.edgeThickness = 1;
outlinePass.pulsePeriod = 0;
outlinePass.visibleEdgeColor.set(0xffffff);
outlinePass.hiddenEdgeColor.set(0x190a05);

// 选择要描边的对象
outlinePass.selectedObjects = [mesh1, mesh2];

composer.addPass(outlinePass);
```

## 自定义 ShaderPass

创建你自己的后处理特效。

```javascript
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

const CustomShader = {
  uniforms: {
    tDiffuse: { value: null }, // 必需：输入纹理
    time: { value: 0 },
    intensity: { value: 1.0 },
  },
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float intensity;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;

      // 波纹扭曲
      uv.x += sin(uv.y * 10.0 + time) * 0.01 * intensity;

      vec4 color = texture2D(tDiffuse, uv);
      gl_FragColor = color;
    }
  `,
};

const customPass = new ShaderPass(CustomShader);
composer.addPass(customPass);

// 在动画循环中更新
customPass.uniforms.time.value = clock.getElapsedTime();
```

### 反色着色器

```javascript
const InvertShader = {
  uniforms: {
    tDiffuse: { value: null },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      gl_FragColor = vec4(1.0 - color.rgb, color.a);
    }
  `,
};
```

### 色差

```javascript
const ChromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    amount: { value: 0.005 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float amount;
    varying vec2 vUv;

    void main() {
      vec2 dir = vUv - 0.5;
      float dist = length(dir);

      float r = texture2D(tDiffuse, vUv - dir * amount * dist).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv + dir * amount * dist).b;

      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
};
```

## 组合多个特效

```javascript
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";
import { VignetteShader } from "three/addons/shaders/VignetteShader.js";
import { GammaCorrectionShader } from "three/addons/shaders/GammaCorrectionShader.js";

const composer = new EffectComposer(renderer);

// 1. 渲染场景
composer.addPass(new RenderPass(scene, camera));

// 2. 泛光
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.5,
  0.4,
  0.85,
);
composer.addPass(bloomPass);

// 3. 暗角
const vignettePass = new ShaderPass(VignetteShader);
vignettePass.uniforms["offset"].value = 0.95;
vignettePass.uniforms["darkness"].value = 1.0;
composer.addPass(vignettePass);

// 4. Gamma 校正
composer.addPass(new ShaderPass(GammaCorrectionShader));

// 5. 抗锯齿（输出前始终最后）
const fxaaPass = new ShaderPass(FXAAShader);
fxaaPass.uniforms["resolution"].value.set(
  1 / window.innerWidth,
  1 / window.innerHeight,
);
composer.addPass(fxaaPass);
```

## 渲染到纹理

```javascript
// 创建渲染目标
const renderTarget = new THREE.WebGLRenderTarget(512, 512);

// 渲染场景到目标
renderer.setRenderTarget(renderTarget);
renderer.render(scene, camera);
renderer.setRenderTarget(null);

// 使用纹理
const texture = renderTarget.texture;
otherMaterial.map = texture;
```

## 多 Pass 渲染

```javascript
// 不同场景/层使用多个 composer
const bgComposer = new EffectComposer(renderer);
bgComposer.addPass(new RenderPass(bgScene, camera));

const fgComposer = new EffectComposer(renderer);
fgComposer.addPass(new RenderPass(fgScene, camera));
fgComposer.addPass(bloomPass);

// 在渲染循环中合成
function animate() {
  // 不清除渲染背景
  renderer.autoClear = false;
  renderer.clear();

  bgComposer.render();

  // 在其上渲染前景
  renderer.clearDepth();
  fgComposer.render();
}
```

## WebGPU 后处理（Three.js r150+）

```javascript
import { postProcessing } from "three/addons/nodes/Nodes.js";
import { pass, bloom, dof } from "three/addons/nodes/Nodes.js";

// 使用节点系统
const scenePass = pass(scene, camera);
const bloomNode = bloom(scenePass, 0.5, 0.4, 0.85);

const postProcessing = new THREE.PostProcessing(renderer);
postProcessing.outputNode = bloomNode;

// 渲染
function animate() {
  postProcessing.render();
}
```

## 性能优化建议

1. **限制 pass 数量**：每个 pass 增加一次全屏渲染
2. **降低分辨率**：模糊 pass 使用更小的渲染目标
3. **禁用未使用的特效**：切换 pass 开/关
4. **使用 FXAA 替代 MSAA**：更便宜的抗锯齿
5. **使用 DevTools 分析**：检查 GPU 使用率

```javascript
// 禁用 pass
bloomPass.enabled = false;

// 降低泛光分辨率
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2),
  strength,
  radius,
  threshold,
);

// 仅在高性能场景应用特效
const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
if (!isMobile) {
  composer.addPass(expensivePass);
}
```

## 处理大小变化

```javascript
function onWindowResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelRatio = renderer.getPixelRatio();

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  composer.setSize(width, height);

  // 更新 pass 特定的分辨率
  if (fxaaPass) {
    fxaaPass.material.uniforms["resolution"].value.set(
      1 / (width * pixelRatio),
      1 / (height * pixelRatio),
    );
  }

  if (bloomPass) {
    bloomPass.resolution.set(width, height);
  }
}

window.addEventListener("resize", onWindowResize);
```

## 参见

- `references/shaders.md` —— 自定义着色器开发
- `references/textures.md` —— 渲染目标
- `references/fundamentals.md` —— 渲染器设置
