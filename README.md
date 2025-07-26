#  Orthodontic 3D Shader player (React + Vite + Babylon.js)

A real-time 3D model player for orthodontic cases using React, Babylon.js, and GLSL shaders. This project loads `.glb` or `.ztcad` files and renders them with a custom shader pipeline using G-Buffers and PostProcess passes.

---

##  Tech Stack

-  **Vite** – blazing-fast dev server
-  **React** – UI framework
-  **Babylon.js** – 3D engine
-  **GLSL shaders** – Custom shader pipeline
-  **JSZip** – Zip file parsing for `.ztcad` format

---

##  Required Dependencies

This project requires the following NPM packages:

```bash
npm install
```
## Behind the scenes, package.json includes:


// (not actual code, just for reference)
"dependencies": {
  "@babylonjs/core": "^6.x",
  "@babylonjs/loaders": "^6.x",
  "jszip": "^3.x",
  "react": "^18.x",
  "react-dom": "^18.x"
},
"devDependencies": {
  "@vitejs/plugin-react": "^4.x",
  "vite": "^5.x"
}

##  Getting Started

## 1. Clone the repository
```bash

git clone https://github.com/leapodonte/PlayerV-0.git
cd PlayerV-0
```
2. Switch to Shader Branch (for latest shader debugging)
```bash


git checkout shader-debug
```
## 4. Install all dependencies
```bash

npm install
```
## 4. Start local development server
```bash

npm run dev
```
Then open your browser at:
```bash

http://localhost:5173
```
## How It Works
This viewer allows you to upload .glb or .ztcad files and visualize them using real-time GPU shaders. The pipeline includes:

 Pass 1: GBuffer Generation
GLSL Shader: angel-align-1st-pass-shader.glsl

Output: gPosition, gNormal, and gColor (geometry ID)

 Pass 2: Gums Shader PostProcess
GLSL Shader: gums-render-pass.glsl

Renders only gum parts based on ID from GBuffer

 This stage produces a screen where only gums are visible, all other pixels are discarded.

## Project Structure
```bash
src/
├── BabylonEngine.js           # Babylon Engine + GBuffer setup
├── ModelLoader.js             # GLB/ZTCAD loading, shader assignment
├── PlayerViewer.jsx           # Viewer canvas, post-process setup
├── shaderUtils.js             # Shader parser utility
└── angel-align/
    └── rendering/
        └── angel-align-1st-pass-shader.glsl
 ```    
## Shader Compatibility Notes
 This project uses WebGL 2 (#version 300 es in GLSL)

 Do not mix WebGL 1 shaders (#version 100) — will cause runtime errors

 Babylon Engine initialized with WebGL 2 context

## Contributing
A dedicated branch shader-debug has been created for shader pipeline development. If you'd like to help, check out:

🔗 https://github.com/leapodonte/PlayerV-0/tree/shader-debug

You can clone, fork, or make pull requests directly into this branch.



