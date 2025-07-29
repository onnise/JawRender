import {
    Engine, Scene, Vector3, ArcRotateCamera,
    MultiRenderTarget, Constants, Color3, Color4
} from '@babylonjs/core';

export const initBabylon = (canvas) => {
    const engine = new Engine(canvas, true, { "xrCompatible": false, "antialias": true }, true);
    const scene = new Scene(engine);
    scene.clearColor = Color3.FromHexString('#F0F0FF');

    const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 150, Vector3.Zero(), scene);
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 20;
    camera.upperRadiusLimit = 500;
    camera.wheelDeltaPercentage = 0.01;

    const gBuffer = new MultiRenderTarget("gBuffer", { width: engine.getRenderWidth(), height: engine.getRenderHeight() }, 3, scene, {
        generateMipMaps: false,
        generateDepthBuffer: true,
        types: [Constants.TEXTURETYPE_FLOAT, Constants.TEXTURETYPE_FLOAT, Constants.TEXTURETYPE_FLOAT],
        samplingModes: [Constants.TEXTURE_NEAREST_SAMPLINGMODE, Constants.TEXTURE_NEAREST_SAMPLINGMODE, Constants.TEXTURE_NEAREST_SAMPLINGMODE]
    });
    scene.gBuffer = gBuffer;
    gBuffer.onBeforeRenderObservable.add(() => {
        engine.clear(new Color4(0, 0, 0, 0), true, true, true);
    });
    scene.customRenderTargets.push(gBuffer);

    return { engine, scene, camera };
};