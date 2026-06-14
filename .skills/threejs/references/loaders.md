# Three.js 加载器

## 快速开始

```javascript
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// 加载 GLTF 模型
const loader = new GLTFLoader();
loader.load("model.glb", (gltf) => {
  scene.add(gltf.scene);
});

// 加载纹理
const textureLoader = new THREE.TextureLoader();
const texture = textureLoader.load("texture.jpg");
```

## 加载管理器（LoadingManager）

协调多个加载器并跟踪进度。

```javascript
const manager = new THREE.LoadingManager();

// 回调
manager.onStart = (url, loaded, total) => {
  console.log(`Started loading: ${url}`);
};

manager.onLoad = () => {
  console.log("All assets loaded!");
  startGame();
};

manager.onProgress = (url, loaded, total) => {
  const progress = (loaded / total) * 100;
  console.log(`Loading: ${progress.toFixed(1)}%`);
  updateProgressBar(progress);
};

manager.onError = (url) => {
  console.error(`Error loading: ${url}`);
};

// 加载器使用管理器
const textureLoader = new THREE.TextureLoader(manager);
const gltfLoader = new GLTFLoader(manager);

// 加载资源
textureLoader.load("texture1.jpg");
textureLoader.load("texture2.jpg");
gltfLoader.load("model.glb");
// onLoad 在所有加载完成后触发
```

## 纹理加载

### TextureLoader

```javascript
const loader = new THREE.TextureLoader();

// 回调风格
loader.load(
  "texture.jpg",
  (texture) => {
    // onLoad
    material.map = texture;
    material.needsUpdate = true;
  },
  undefined, // onProgress - 图片加载不支持
  (error) => {
    // onError
    console.error("Error loading texture", error);
  },
);

// 同步风格（返回纹理，异步加载）
const texture = loader.load("texture.jpg");
material.map = texture;
```

### 纹理配置

```javascript
const texture = loader.load("texture.jpg", (tex) => {
  // 色彩空间（对颜色准确性很重要）
  tex.colorSpace = THREE.SRGBColorSpace; // 颜色/反照率贴图
  // tex.colorSpace = THREE.LinearSRGBColorSpace;  // 数据贴图（法线、粗糙度）

  // 包裹模式
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  // ClampToEdgeWrapping, RepeatWrapping, MirroredRepeatWrapping

  // 重复/偏移
  tex.repeat.set(2, 2);
  tex.offset.set(0.5, 0.5);
  tex.rotation = Math.PI / 4;
  tex.center.set(0.5, 0.5);

  // 过滤
  tex.minFilter = THREE.LinearMipmapLinearFilter; // 默认
  tex.magFilter = THREE.LinearFilter; // 默认
  // NearestFilter - 像素化
  // LinearFilter - 平滑
  // LinearMipmapLinearFilter - 带 mipmap 平滑

  // 各向异性过滤（斜角更清晰）
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();

  // 翻转 Y（标准纹理通常需要）
  tex.flipY = true;

  tex.needsUpdate = true;
});
```

### CubeTextureLoader

用于环境贴图和天空盒。

```javascript
const loader = new THREE.CubeTextureLoader();

// 加载 6 个面
const cubeTexture = loader.load([
  "px.jpg",
  "nx.jpg", // positive/negative X
  "py.jpg",
  "ny.jpg", // positive/negative Y
  "pz.jpg",
  "nz.jpg", // positive/negative Z
]);

// 用作背景
scene.background = cubeTexture;

// 用作环境贴图
scene.environment = cubeTexture;
material.envMap = cubeTexture;
```

### HDR/EXR 加载

```javascript
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { EXRLoader } from "three/addons/loaders/EXRLoader.js";

// HDR
const rgbeLoader = new RGBELoader();
rgbeLoader.load("environment.hdr", (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = texture;
  scene.background = texture;
});

// EXR
const exrLoader = new EXRLoader();
exrLoader.load("environment.exr", (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = texture;
});
```

### PMREMGenerator

为 PBR 生成预过滤环境贴图。

```javascript
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

new RGBELoader().load("environment.hdr", (texture) => {
  const envMap = pmremGenerator.fromEquirectangular(texture).texture;

  scene.environment = envMap;
  scene.background = envMap;

  texture.dispose();
  pmremGenerator.dispose();
});
```

## GLTF/GLB 加载

Web 最常见的 3D 格式。

```javascript
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const loader = new GLTFLoader();

loader.load("model.glb", (gltf) => {
  // 加载的场景
  const model = gltf.scene;
  scene.add(model);

  // 动画
  const animations = gltf.animations;
  if (animations.length > 0) {
    const mixer = new THREE.AnimationMixer(model);
    animations.forEach((clip) => {
      mixer.clipAction(clip).play();
    });
  }

  // 相机（如果有）
  const cameras = gltf.cameras;

  // 资源信息
  console.log(gltf.asset); // 版本、生成器等

  // 来自 Blender 等的用户数据
  console.log(gltf.userData);
});
```

### GLTF with Draco 压缩

```javascript
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(
  "https://www.gstatic.com/draco/versioned/decoders/1.5.6/",
);
dracoLoader.preload();

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

gltfLoader.load("compressed-model.glb", (gltf) => {
  scene.add(gltf.scene);
});
```

### GLTF with KTX2 纹理

```javascript
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";

const ktx2Loader = new KTX2Loader();
ktx2Loader.setTranscoderPath(
  "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/basis/",
);
ktx2Loader.detectSupport(renderer);

const gltfLoader = new GLTFLoader();
gltfLoader.setKTX2Loader(ktx2Loader);

gltfLoader.load("model-with-ktx2.glb", (gltf) => {
  scene.add(gltf.scene);
});
```

### 处理 GLTF 内容

```javascript
loader.load("model.glb", (gltf) => {
  const model = gltf.scene;

  // 启用阴影
  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  // 查找特定网格
  const head = model.getObjectByName("Head");

  // 调整材质
  model.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material.envMapIntensity = 0.5;
    }
  });

  // 居中并缩放
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  model.position.sub(center);
  const maxDim = Math.max(size.x, size.y, size.z);
  model.scale.setScalar(1 / maxDim);

  scene.add(model);
});
```

## 其他模型格式

### OBJ + MTL

```javascript
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";

const mtlLoader = new MTLLoader();
mtlLoader.load("model.mtl", (materials) => {
  materials.preload();

  const objLoader = new OBJLoader();
  objLoader.setMaterials(materials);
  objLoader.load("model.obj", (object) => {
    scene.add(object);
  });
});
```

### FBX

```javascript
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

const loader = new FBXLoader();
loader.load("model.fbx", (object) => {
  // FBX 通常比例较大
  object.scale.setScalar(0.01);

  // 动画
  const mixer = new THREE.AnimationMixer(object);
  object.animations.forEach((clip) => {
    mixer.clipAction(clip).play();
  });

  scene.add(object);
});
```

### STL

```javascript
import { STLLoader } from "three/addons/loaders/STLLoader.js";

const loader = new STLLoader();
loader.load("model.stl", (geometry) => {
  const material = new THREE.MeshStandardMaterial({ color: 0x888888 });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
});
```

### PLY

```javascript
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";

const loader = new PLYLoader();
loader.load("model.ply", (geometry) => {
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
});
```

## 异步/Promise 加载

### Promise 化加载器

```javascript
function loadModel(url) {
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });
}

// 用法
async function init() {
  try {
    const gltf = await loadModel("model.glb");
    scene.add(gltf.scene);
  } catch (error) {
    console.error("Failed to load model:", error);
  }
}
```

### 加载多个资源

```javascript
async function loadAssets() {
  const [modelGltf, envTexture, colorTexture] = await Promise.all([
    loadGLTF("model.glb"),
    loadRGBE("environment.hdr"),
    loadTexture("color.jpg"),
  ]);

  scene.add(modelGltf.scene);
  scene.environment = envTexture;
  material.map = colorTexture;
}

// 辅助函数
function loadGLTF(url) {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(url, resolve, undefined, reject);
  });
}

function loadRGBE(url) {
  return new Promise((resolve, reject) => {
    new RGBELoader().load(
      url,
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        resolve(texture);
      },
      undefined,
      reject,
    );
  });
}

function loadTexture(url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, resolve, undefined, reject);
  });
}
```

## 缓存

### 内置缓存

```javascript
// 启用缓存
THREE.Cache.enabled = true;

// 清空缓存
THREE.Cache.clear();

// 手动缓存管理
THREE.Cache.add("key", data);
THREE.Cache.get("key");
THREE.Cache.remove("key");
```

### 自定义资源管理器

```javascript
class AssetManager {
  constructor() {
    this.textures = new Map();
    this.models = new Map();
    this.gltfLoader = new GLTFLoader();
    this.textureLoader = new THREE.TextureLoader();
  }

  async loadTexture(key, url) {
    if (this.textures.has(key)) {
      return this.textures.get(key);
    }

    const texture = await new Promise((resolve, reject) => {
      this.textureLoader.load(url, resolve, undefined, reject);
    });

    this.textures.set(key, texture);
    return texture;
  }

  async loadModel(key, url) {
    if (this.models.has(key)) {
      return this.models.get(key).clone();
    }

    const gltf = await new Promise((resolve, reject) => {
      this.gltfLoader.load(url, resolve, undefined, reject);
    });

    this.models.set(key, gltf.scene);
    return gltf.scene.clone();
  }

  dispose() {
    this.textures.forEach((t) => t.dispose());
    this.textures.clear();
    this.models.clear();
  }
}

// 用法
const assets = new AssetManager();
const texture = await assets.loadTexture("brick", "brick.jpg");
const model = await assets.loadModel("tree", "tree.glb");
```

## 从不同来源加载

### Data URL / Base64

```javascript
const loader = new THREE.TextureLoader();
const texture = loader.load("data:image/png;base64,iVBORw0KGgo...");
```

### Blob URL

```javascript
async function loadFromBlob(blob) {
  const url = URL.createObjectURL(blob);
  const texture = await loadTexture(url);
  URL.revokeObjectURL(url);
  return texture;
}
```

### ArrayBuffer

```javascript
// 从 fetch
const response = await fetch("model.glb");
const buffer = await response.arrayBuffer();

// 用加载器解析
const loader = new GLTFLoader();
loader.parse(buffer, "", (gltf) => {
  scene.add(gltf.scene);
});
```

### 自定义路径/URL

```javascript
// 设置基础路径
loader.setPath("assets/models/");
loader.load("model.glb"); // 从 assets/models/model.glb 加载

// 设置资源路径（用于模型中引用的纹理）
loader.setResourcePath("assets/textures/");

// 自定义 URL 修改器
manager.setURLModifier((url) => {
  return `https://cdn.example.com/${url}`;
});
```

## 错误处理

```javascript
// 优雅回退
async function loadWithFallback(primaryUrl, fallbackUrl) {
  try {
    return await loadModel(primaryUrl);
  } catch (error) {
    console.warn(`Primary failed, trying fallback: ${error}`);
    return await loadModel(fallbackUrl);
  }
}

// 重试逻辑
async function loadWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await loadModel(url);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

// 超时
async function loadWithTimeout(url, timeout = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Loading timed out");
    }
    throw error;
  }
}
```

## 性能优化建议

1. **使用压缩格式**：DRACO 用于几何体，KTX2/Basis 用于纹理
2. **渐进加载**：加载时显示占位符
3. **懒加载**：仅加载需要的内容
4. **使用 CDN**：更快的资源交付
5. **启用缓存**：`THREE.Cache.enabled = true`

```javascript
// 带占位符的渐进加载
const placeholder = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshBasicMaterial({ wireframe: true }),
);
scene.add(placeholder);

loadModel("model.glb").then((gltf) => {
  scene.remove(placeholder);
  scene.add(gltf.scene);
});
```

## 参见

- `references/textures.md` —— 纹理配置
- `references/animation.md` —— 播放加载的动画
- `references/materials.md` —— 加载模型的材质
