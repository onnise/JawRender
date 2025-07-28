
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

    return { engine, scene, camera };
};
