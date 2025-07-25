
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
    // Force the engine to create a WebGL2 context
    const engine = new Engine(canvas, true, { "xrCompatible": false, "antialias": true }, true);

    const scene = new Scene(engine);
    scene.clearColor = Color3.FromHexString('#F0F0FF');

    const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 150, Vector3.Zero(), scene);
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 20;
    camera.upperRadiusLimit = 500;
    camera.wheelDeltaPercentage = 0.01;

    // --- THIS IS THE MISSING PART ---
    // Create the G-Buffer with 3 float textures
    const gBuffer = new MultiRenderTarget(
      "gBuffer",
      { width: engine.getRenderWidth(), height: engine.getRenderHeight() },
      3, // 3 output textures
      scene,
      {
        generateMipMaps: false,
        generateDepthBuffer: true,
        types: [ Constants.TEXTURETYPE_FLOAT,
           Constants.TEXTURETYPE_FLOAT,
            Constants.TEXTURETYPE_FLOAT ],
        samplingModes: [
           Constants.TEXTURE_NEAREST_SAMPLINGMODE,
            Constants.TEXTURE_NEAREST_SAMPLINGMODE,
             Constants.TEXTURE_NEAREST_SAMPLINGMODE ]
      }
    );

    // Attach the G-Buffer to the scene object so PlayerViewer can find it
    scene.gBuffer = gBuffer;

    // Redirect all scene rendering into our G-Buffer
    scene.customRenderTargets.push(gBuffer);
    // --- END OF MISSING PART ---

    return { engine, scene, camera };
};