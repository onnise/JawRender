// --- START OF FILE BabylonEngine.js ---

import { 
    Engine, 
    Scene, 
    Vector3,
    ArcRotateCamera, 
    MultiRenderTarget,
    Constants,
    Color3
} from '@babylonjs/core';

export const initBabylon = (canvas) => {
    // Force the engine to create a WebGL2 context, required by your #version 300 es shaders
    const engine = new Engine(canvas, true, { "xrCompatible": false, "antialias": true }, true);
    
    const scene = new Scene(engine);
    // Set a background color for consistency
    scene.clearColor = Color3.FromHexString('#F0F0FF'); 

    const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 150, Vector3.Zero(), scene);
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 20;
    camera.upperRadiusLimit = 500;
    camera.wheelDeltaPercentage = 0.01;

    // Create the G-Buffer with 3 float textures to match your shader's outputs
    const gBuffer = new MultiRenderTarget(
      "gBuffer", 
      { width: engine.getRenderWidth(), height: engine.getRenderHeight() }, 
      3, // 3 output textures: gPosition, gNormal, gColor
      scene, 
      {
        generateMipMaps: false, 
        types: [
            Constants.TEXTURETYPE_FLOAT,
            Constants.TEXTURETYPE_FLOAT,
            Constants.TEXTURETYPE_FLOAT,
        ],
        samplingModes: [
            Constants.TEXTURE_NEAREST_SAMPLINGMODE,
            Constants.TEXTURE_NEAREST_SAMPLINGMODE,
            Constants.TEXTURE_NEAREST_SAMPLINGMODE,
        ]
      }
    );

    // Make the G-Buffer accessible on the scene for post-processes
    scene.gBuffer = gBuffer;

    // This critical line redirects all scene rendering into our G-Buffer textures
    scene.customRenderTargets.push(gBuffer);

    return { engine, scene, camera };
};