// --- START OF FILE PlayerViewer.jsx ---

import React, { useEffect, useRef, useCallback, useState } from "react"; 
import { initBabylon } from "./BabylonEngine";
import { setupGUI } from "./GUIControls"; 
import { initializeCaseLoader } from "./ModelLoader";
import { exportToGLB, exportToSTL } from "./Exporter";
import ExportDrawer from "./ExportDrawer"; 
import { Vector3, PostProcess, Effect, Texture } from "@babylonjs/core";

import gumsShaderCode from '../angel-align/rendering/angel-align-6th-pass-step-2-gums-shader.glsl?raw';
import { parseShaderFile } from "./shaderUtils";

const PlayerViewer = () => {
  const canvasRef = useRef(null);
  const activeModelRef = useRef(null); 
  const modelsRef = useRef(null);
  const cameraRef = useRef(null);
  const sceneRef = useRef(null);
  const guiTextureRef = useRef(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    // This shader's only job is to display the contents of a G-Buffer texture.
    // const gBufferDebugShader = `
    //     #version 300 es
    //     precision highp float;
    //     in vec2 vUV;
    //     out vec4 fragColor;
    //     uniform sampler2D textureSampler;

    //     void main() {
    //         vec3 data = texture(textureSampler, vUV).rgb;
    //         // The 0.5 * 0.5 logic correctly remaps normal vectors to visible colors
    //         fragColor = vec4(data * 0.5 + 0.5, 1.0);
    //     }
    // `;
    // Effect.ShadersStore["gBufferDebugFragmentShader"] = gBufferDebugShader;

    
    if (!gumsShaderCode) return;
    
    const parsedGumsShader = parseShaderFile(gumsShaderCode);
    if (!parsedGumsShader) {
      setLoadError("Could not parse Gums Shader file.");
      return;
    }

    // Adapt the Gums material shader into a post-process fragment shader
    let adaptedFragmentShader = parsedGumsShader.fragment;
    
    // Replace varyings with G-Buffer samplers
    adaptedFragmentShader = adaptedFragmentShader.replace(/varying\s+vec4\s+ecPosition;/g, "uniform sampler2D gBufferPosition;");
    adaptedFragmentShader = adaptedFragmentShader.replace(/varying\s+vec3\s+ecNormal;/g, "uniform sampler2D gBufferNormal;");
    adaptedFragmentShader = adaptedFragmentShader.replace(/varying\s+vec2\s+vUv;/g, ""); // vUV is built-in
    
    // Add new sampler for GeometryType
    adaptedFragmentShader = "uniform sampler2D gBufferData;\n" + adaptedFragmentShader;

    // Replace varying usages with texture lookups
    adaptedFragmentShader = adaptedFragmentShader.replace(/\becPosition\b/g, "texture2D(gBufferPosition, vUV)");
    adaptedFragmentShader = adaptedFragmentShader.replace(/\becNormal\b/g, "texture2D(gBufferNormal, vUV).rgb");
    adaptedFragmentShader = adaptedFragmentShader.replace(/\bvUv\b/g, "vUV");

    // Add logic to discard pixels that are not gums
    const mainFuncBody = `
        if (clipDistance < 0.0) discard;

        // Read GeometryType from gBufferData (stored in R channel)
        float geoID = texture2D(gBufferData, vUV).r;

        // Discard if NOT a gum pixel (ID is approx 1.0)
        if (abs(geoID - 1.0) > 0.1) {
            discard;
        }

        // --- Original Shader Logic Starts Here ---
        if (gl_FrontFacing) {
            vec3 texelColor = texture2D(diffuseMap, vUV).xyz;
            vec3 diffuseColor = diffuse*texelColor;
            vec3 normal = normalize(texture2D(gBufferNormal, vUV).rgb); // simplified normal
            
            // Note: Normal mapping part is simplified/removed as it's much more complex in post-process
            
            vec3 outgoingLight = Lighting(diffuseColor, normal);
            gl_FragColor = vec4(outgoingLight, opacity);
        }
    `;
    
    
    adaptedFragmentShader = adaptedFragmentShader.replace(/void\s+main\s*\([^)]*\)\s*\{(.|\n)*?\}/g, "void main() {" + mainFuncBody + "}");
    
    Effect.ShadersStore["gumsRenderFragmentShader"] = adaptedFragmentShader;


  }, []);

  const cleanupPreviousModel = useCallback(() => {
    if (guiTextureRef.current) {
      guiTextureRef.current.dispose(); guiTextureRef.current = null;
    }
    if (modelsRef.current && modelsRef.current.MasterRoot) {
      modelsRef.current.MasterRoot.dispose(false, true);
    }
    modelsRef.current = null;
    activeModelRef.current = null;
    setIsModelLoaded(false); 
  }, []);

  const showModel = useCallback((type) => {
    const models = modelsRef.current;
    const cam = cameraRef.current;
    if (!models || !cam) return;
    
    Object.keys(models).forEach(key => {
      if(models[key] && models[key].setEnabled && key !== 'MasterRoot') models[key].setEnabled(false);
    });
    if (models.Full) models.Full.setEnabled(true);
    let targetModel = models.Full;

    if (type === 'Upper' && models.Upper) {
      models.Upper.setEnabled(true); targetModel = models.Upper;
    } else if (type === 'Lower' && models.Lower) {
      models.Lower.setEnabled(true); targetModel = models.Lower;
    } else if (type === 'Full') {
        Object.keys(models).forEach(key => {
            if(models[key] && models[key].setEnabled && key !== 'MasterRoot') models[key].setEnabled(true);
        });
        targetModel = models.Full;
    }
    activeModelRef.current = targetModel;
    if (activeModelRef.current) {
      setTimeout(() => {
        try {
          cam.setPosition(new Vector3(0, 0, 150));
          cam.setTarget(activeModelRef.current.position || Vector3.Zero());
        } catch (error) { console.error("Camera positioning error:", error); }
      }, 50);
    }
  }, []);
  
  const handleExport = useCallback((exportFunction) => {
    if (!sceneRef.current || !modelsRef.current) { return; }
    let meshesToExport = [];
    const groups = ['Upper', 'Lower', 'IdealTeeth', 'OriginalTeeth', 'Brackets', 'Full'];
    groups.forEach(name => {
      if (modelsRef.current[name]) meshesToExport.push(...modelsRef.current[name].getChildMeshes(false));
    });
    if (meshesToExport.length > 0) { exportFunction(meshesToExport); }
    setIsDrawerOpen(false);
  }, []);
  
  const handleExportGLB = useCallback(() => {
    handleExport(meshes => exportToGLB(sceneRef.current, meshes, "exported_model.glb"));
  }, [handleExport]);
  
  const handleExportSTL = useCallback(() => {
    handleExport(meshes => exportToSTL(sceneRef.current, meshes, "exported_model.stl"));
  }, [handleExport]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const { engine, scene, camera } = initBabylon(canvas);
    sceneRef.current = scene;
    cameraRef.current = camera;
    
    const gBuffer = scene.gBuffer;
    if (gBuffer) {
        console.log("G-Buffer found. Setting up visualization post-process.");



    //     const debugPass = new PostProcess("gBufferDebug", "gBufferDebug", [], ["textureSampler"], 1.0, camera);
    //     debugPass.onApply = (effect) => {
           
    //         effect.setTexture("textureSampler", gBuffer.textures[2]);
    //     };
    // } else {
    //     console.error("G-Buffer not found! Check BabylonEngine.js is creating it.");
    // }

      const ASSET_PATH = "/assets/"; // Make sure your texture assets are here
        const gumDiffuseTex = new Texture(ASSET_PATH + "angel-align-texture-gums-diffuse.png", scene);
        const gumReflectTex = new Texture(ASSET_PATH + "angel-align-texture-re-reflection.png", scene);
        const gumSpecularTex = new Texture(ASSET_PATH + "angel-align-6th-pass-step-2-gums-texture-specular.png", scene);
        const gumNormalTex = new Texture(ASSET_PATH + "angel-align-texture-re-gums-normal.png", scene);

        // Create the new post-process for rendering the gums
        const gumsPass = new PostProcess("gumsRender", "gumsRender", 
            [/* shader uniform names */ "opacity", "diffuse", "ambientLightColor", "glossiness", "reflectivity", "shineFactor" /* ...etc... */ ], 
            [/* sampler names */ "gBufferPosition", "gBufferNormal", "gBufferData", "diffuseMap", "reflectMap", "specularMap", "normalMap"],
        1.0, camera);

        // Dummy light data for now
        const pointLights = [
            { position: new Vector3(100, 200, 100), color: new Color3(0.8, 0.8, 0.7) },
            { position: new Vector3(-100, -50, -50), color: new Color3(0.5, 0.5, 0.6) },
            { position: new Vector3(0, -100, 100), color: new Color3(0.4, 0.4, 0.4) },
        ];
        
        gumsPass.onApply = (effect) => {
            // Bind G-Buffer textures
            effect.setTexture("gBufferPosition", gBuffer.textures[0]);
            effect.setTexture("gBufferNormal", gBuffer.textures[1]);
            effect.setTexture("gBufferData", gBuffer.textures[2]);

            // Bind Gum textures
            effect.setTexture("diffuseMap", gumDiffuseTex);
            effect.setTexture("reflectMap", gumReflectTex);
            effect.setTexture("specularMap", gumSpecularTex);
            effect.setTexture("normalMap", gumNormalTex);

            // Set other uniforms (using hardcoded values from a typical PBR material)
            effect.setFloat("opacity", 1.0);
            effect.setVector3("diffuse", new Vector3(1.0, 1.0, 1.0));
            effect.setVector3("ambientLightColor", new Vector3(0.2, 0.2, 0.2));
            effect.setFloat("glossiness", 0.5);
            effect.setFloat("reflectivity", 0.8);
            effect.setFloat("shineFactor", 1.0);
            effect.setBool("enableTexture", true);

            // Pass light data (note: this part is complex, simplified here)
            // You'd typically pack this data into arrays.
            effect.setVector3("pointLights[0].position", pointLights[0].position);
            effect.setVector3("pointLights[0].color", pointLights[0].color.toVector3());
            effect.setVector3("pointLights[1].position", pointLights[1].position);
            effect.setVector3("pointLights[1].color", pointLights[1].color.toVector3());
            effect.setVector3("pointLights[2].position", pointLights[2].position);
            effect.setVector3("pointLights[2].color", pointLights[2].color.toVector3());
        };

    } else {
        console.error("G-Buffer not found! Cannot set up Gums Render Pass.");
    }



    const onModelLoaded = (loadedModels) => {
      setLoadError(null);
      setIsLoading(false);
      requestAnimationFrame(() => {
        try {
          cleanupPreviousModel();
          modelsRef.current = loadedModels;
          guiTextureRef.current = setupGUI({ 
            camera, models: loadedModels, showModel,
            activeModelRef, onOpenExportDrawer: () => setIsDrawerOpen(true)
          });
          setIsModelLoaded(true);
          showModel("Full");
        } catch (error) {
          console.error("Error processing loaded model:", error);
          setLoadError("Failed to process loaded model");
        }
      });
    };
    
    const loaderCleanup = initializeCaseLoader(scene, 'ztcadLoaderInput', onModelLoaded, setIsLoading, setLoadError);
    engine.runRenderLoop(() => { if (scene && !scene.isDisposed) scene.render(); });
    const resize = () => { if(engine) engine.resize(); };
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      if (loaderCleanup) loaderCleanup();
      cleanupPreviousModel();
      if(engine) engine.dispose();
    };
  }, [cleanupPreviousModel, showModel]); // Simplified dependencies for clarity

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ExportDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} onExportGLB={handleExportGLB} onExportSTL={handleExportSTL} />
      <input type="file" id="ztcadLoaderInput" accept=".ztcad,.glb" style={{ display: 'none' }} />
      {isLoading && <div style={{position: 'absolute', zIndex:10, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background:'rgba(0,0,0,0.8)', color:'white', padding:'20px', borderRadius:'8px'}}>Loading model...</div>}
      {loadError && <div style={{position: 'absolute', zIndex:10, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background:'rgba(255,0,0,0.9)', color:'white', padding:'20px', borderRadius:'8px', textAlign:'center'}}><div>{loadError}</div><button onClick={() => setLoadError(null)}>Dismiss</button></div>}
      {!isModelLoaded && !isLoading && <div style={{position: 'absolute', top: 10, left: 10, zIndex: 1}}><button onClick={() => document.getElementById('ztcadLoaderInput')?.click()} style={{ background: '#fff', border: '1px solid #ccc', borderRadius: '8px', padding: '8px', cursor: 'pointer', display: 'flex' }} title="Load Published Case"><img src="/assets/open.png" alt="Load Case" style={{ width: '35px', height: '35px' }} /></button></div>}
      <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: "100%", height: "100%", outline: 'none' }} />
    </div>
  );
};

export default PlayerViewer;