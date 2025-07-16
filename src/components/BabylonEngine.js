import {
  Engine,
  Scene,
  ArcRotateCamera,
  HemisphericLight,
  Vector3,
  Color3
} from '@babylonjs/core';

export const initBabylon = (canvas) => {
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);
  scene.clearColor = Color3.FromHexString('#F0F0FF');

  const camera = new ArcRotateCamera(
    'camera',
    Math.PI / 2,   // azimuth
    Math.PI / 3,   // elevation
    200,           // radius
    new Vector3(0, 0, 0),
    scene
  );

  camera.attachControl(canvas, true);
  camera.wheelDeltaPercentage = 0.02;

  new HemisphericLight('light', new Vector3(1, 1, 0), scene);

  return { engine, scene, camera };
};
