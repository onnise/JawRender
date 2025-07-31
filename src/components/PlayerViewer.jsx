
import React, { useEffect, useRef, useCallback, useState } from "react";
import { setupGUI } from "./GUIControls";
import { initializeCaseLoader } from "./ModelLoader";
import { exportToGLB, exportToSTL } from "./Exporter";
import ExportDrawer from "./ExportDrawer";
import { 
    Engine, Scene, Vector3, ArcRotateCamera, HemisphericLight, 
    DirectionalLight, Color4, StandardMaterial, Color3, 
    MultiRenderTarget, Constants, PostProcess, Effect, Texture
} from "@babylonjs/core";

// Import all required shaders
import gumsRenderShader from '../angel-align/rendering/gums-render-pass.glsl?raw';
import teethRenderShader from '../angel-align/rendering/teeth-render-pass-complex.glsl?raw';

const PlayerViewer = () => {
    // React Refs for Babylon.js objects
    const canvasRef = useRef(null);
    const engineRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const modelsRef = useRef(null);
    const activeModelRef = useRef(null);
    const guiTextureRef = useRef(null);
    const gBufferRef = useRef(null);
    const gumsPostProcessRef = useRef(null);
    const teethPostProcessRef = useRef(null);

    // Component State
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [useAdvancedShaders, setUseAdvancedShaders] = useState(false);

    // Effect to load shader code into Babylon's ShaderStore
    useEffect(() => {
        // Standard vertex shader for post-processing
        const postProcessVertexShader = `#version 300 es
        precision highp float;
        in vec3 position;
        in vec2 uv;
        out vec2 vUV;
        void main() {
            vUV = uv;
            gl_Position = vec4(position, 1.0);
        }`;

        if (gumsRenderShader) {
            Effect.ShadersStore["gumsRenderVertexShader"] = postProcessVertexShader;
            Effect.ShadersStore["gumsRenderFragmentShader"] = `#version 300 es\n${gumsRenderShader.replace(/#version 300 es/g, '').trim()}`;
            console.log("Gums render shader loaded.");
        }
        if (teethRenderShader) {
            Effect.ShadersStore["teethRenderComplexVertexShader"] = postProcessVertexShader;
            Effect.ShadersStore["teethRenderComplexFragmentShader"] = `#version 300 es\n${teethRenderShader.replace(/#version 300 es/g, '').trim()}`;
            console.log("Complex teeth render shader loaded.");
        }
    }, []);

    // Cleanup function for models and rendering resources
    const cleanupPreviousModel = useCallback(() => {
        if (gumsPostProcessRef.current) gumsPostProcessRef.current.dispose();
        if (teethPostProcessRef.current) teethPostProcessRef.current.dispose();
        if (gBufferRef.current) gBufferRef.current.dispose();
        if (guiTextureRef.current) guiTextureRef.current.dispose(); 
        if (modelsRef.current?.MasterRoot) modelsRef.current.MasterRoot.dispose(false, true); 

        gumsPostProcessRef.current = null;
        teethPostProcessRef.current = null;
        gBufferRef.current = null;
        guiTextureRef.current = null;
        modelsRef.current = null;
        activeModelRef.current = null;
        setIsModelLoaded(false);
    }, []);

    // Function to show/hide parts of the model
    const showModel = useCallback((type) => {
        const models = modelsRef.current;
        const camera = cameraRef.current;
        if (!models || !camera) return;

        Object.keys(models).forEach(key => {
            if (models[key]?.setEnabled && key !== 'MasterRoot' && key !== 'allMeshes') {
                models[key].setEnabled(false);
            }
        });

        let targetModel = models.Full || models.MasterRoot;
        if (type === 'Upper' && models.Upper) {
            models.Upper.setEnabled(true);
            targetModel = models.Upper;
        } else if (type === 'Lower' && models.Lower) {
            models.Lower.setEnabled(true);
            targetModel = models.Lower;
        } else if (type === 'Full') {
            ['Upper', 'Lower', 'IdealTeeth', 'OriginalTeeth', 'Brackets', 'Full'].forEach(key => {
                if (models[key]?.setEnabled) models[key].setEnabled(true);
            });
            targetModel = models.MasterRoot || models.Full;
        }
        activeModelRef.current = targetModel;

        if (targetModel && camera) {
            setTimeout(() => {
                try {
                    const boundingInfo = targetModel.getBoundingInfo();
                    const center = boundingInfo.boundingBox.centerWorld;
                    const size = boundingInfo.boundingBox.maximumWorld.subtract(boundingInfo.boundingBox.minimumWorld);
                    const maxSize = Math.max(size.x, size.y, size.z);
                    const distance = maxSize > 0 ? maxSize * 2 : 150;
                    camera.setPosition(new Vector3(distance, distance * 0.5, distance));
                    camera.setTarget(center);
                } catch (error) { 
                    camera.setPosition(new Vector3(100, 50, 100));
                    camera.setTarget(Vector3.Zero());
                }
            }, 100);
        }
    }, []);

    // Export Functions
    const handleExport = useCallback((exportFunction) => {
        if (!activeModelRef.current) {
            alert('No model loaded to export');
            return;
        }
        exportFunction(activeModelRef.current, sceneRef.current);
    }, []);
    
    const handleExportGLB = useCallback(() => {
        handleExport(exportToGLB);
    }, [handleExport]);
    
    const handleExportSTL = useCallback(() => {
        handleExport(exportToSTL);
    }, [handleExport]);

    // Setup G-Buffer for Deferred Rendering
    const setupGBuffer = useCallback((scene, engine) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const renderWidth = Math.max(canvas.clientWidth || 800, 800);
        const renderHeight = Math.max(canvas.clientHeight || 600, 600);

        // Dispose any existing G-Buffer to prevent memory leaks
        if (gBufferRef.current) {
            console.log("Disposing existing G-Buffer before creating a new one");
            gBufferRef.current.dispose();
            gBufferRef.current = null;
        }

        const gBuffer = new MultiRenderTarget("gBuffer", 
            { width: renderWidth, height: renderHeight }, 3, scene, {
            generateMipMaps: false,
            generateDepthBuffer: true,
            types: [Constants.TEXTURETYPE_FLOAT, Constants.TEXTURETYPE_FLOAT, Constants.TEXTURETYPE_FLOAT],
            samplingModes: [Constants.TEXTURE_NEAREST_SAMPLINGMODE, Constants.TEXTURE_NEAREST_SAMPLINGMODE, Constants.TEXTURE_NEAREST_SAMPLINGMODE]
        });

        // Critical fix: G-Buffer should render meshes that are visible to it
        gBuffer.layerMask = 0x20000000;
        
        // Add debug logging for G-Buffer rendering
        gBuffer.onBeforeRenderObservable.add(() => {
            console.log("G-Buffer render start - clearing buffers");
            engine.clear(new Color4(0, 0, 0, 0), true, true, true);
        });

        gBuffer.onAfterRenderObservable.add(() => {
            console.log("G-Buffer render complete");
        });

        // Explicitly set the reference
        gBufferRef.current = gBuffer;
        console.log(`G-Buffer created: ${renderWidth}x${renderHeight}, layer mask: 0x20000000`);
        console.log(`G-Buffer textures count: ${gBuffer.textures?.length}`);
        console.log("G-Buffer reference set:", !!gBufferRef.current);
        return gBuffer;
    }, []);

    // Setup both post-processing passes
    const setupAdvancedShaders = useCallback((scene, camera, gBuffer, engine) => {
        if (!gBuffer || !Effect.ShadersStore["gumsRenderFragmentShader"] || !Effect.ShadersStore["teethRenderComplexFragmentShader"]) {
            console.error("Aborting shader setup: A required shader is not in the ShaderStore.");
            return null;
        }
        
        // Ensure G-Buffer is properly referenced
        if (!gBufferRef.current && gBuffer) {
            console.log("Setting G-Buffer reference in setupAdvancedShaders");
            gBufferRef.current = gBuffer;
        }

        // Add G-Buffer debug visualization
        const debugGBuffer = () => {
            console.log("=== G-Buffer Debug Info ===");
            console.log("G-Buffer size:", gBuffer.getSize());
            console.log("G-Buffer textures:", gBuffer.textures?.length);
            if (gBuffer.textures) {
                gBuffer.textures.forEach((tex, i) => {
                    console.log(`Texture ${i}:`, tex.getSize(), tex.isReady());
                });
            }
            
            // Check if any meshes are on the G-Buffer layer
            let meshCount = 0;
            scene.meshes.forEach(mesh => {
                if (mesh.layerMask & 0x20000000) {
                    meshCount++;
                    console.log(`G-Buffer mesh: ${mesh.name}, material: ${mesh.material?.name || 'none'}`);
                }
            });
            console.log(`Total meshes on G-Buffer layer: ${meshCount}`);
        };
        
        // Debug after a short delay to ensure everything is set up
        setTimeout(debugGBuffer, 2000);
        
        // Also debug immediately when a model is loaded
        scene.onAfterRenderObservable.addOnce(() => {
            setTimeout(() => {
                console.log("=== Post-Model Load Debug ===");
                debugGBuffer();
            }, 500);
        });

    // --- Define common resources ---
    const pointLights = [
        { position: new Vector3(100, 200, -150), color: new Color3(0.9, 0.8, 0.7) },
        { position: new Vector3(-80, -100, 100), color: new Color3(0.5, 0.5, 0.8) },
        { position: new Vector3(0, -150, -100), color: new Color3(0.4, 0.4, 0.4) },
    ];
    const loadTexture = (path, noMipMap = true) => new Texture(`/src/angel-align/rendering/${path}`, scene, noMipMap);

    // --- LOAD TEXTURES ---
    const gumDiffuseTex = loadTexture("angel-align-texture-gums-diffuse.png");
    const gumSpecularTex = loadTexture("angel-align-6th-pass-step-2-gums-texture-specular.png");
    const teethDiffuseTex = loadTexture("angel-align-texture-teeth-diffuse.png");
    const teethReflectTex = loadTexture("angel-align-texture-reflection.png");

    // --- CAMERA VALIDATION ---
    console.log("Camera validation:", {
        exists: !!camera,
        name: camera?.name,
        type: camera?.constructor?.name,
        isReady: camera?.isReady?.(),
        postProcesses: camera?.postProcesses?.length || 0,
        _postProcesses: camera?._postProcesses?.length || 0
    });

    // --- GUMS PASS SETUP ---
    try {
        const uniforms = ["cameraPosition", "ambientLightColor", "diffuse", "opacity", "glossiness", "shineFactor", "pointLights"];
        const samplers = ["gBufferPosition", "gBufferNormal", "gBufferData", "diffuseMap", "specularMap"];

        const gumsPass = new PostProcess("gumsRender", "gumsRender", uniforms, samplers, 1.0, null, Constants.TEXTURE_BILINEAR_SAMPLINGMODE, engine);
        console.log("Gums PostProcess created:", gumsPass ? 'SUCCESS' : 'FAILED');
        console.log("Gums PostProcess name:", gumsPass?.name);
        console.log("Gums PostProcess isReady:", gumsPass?.isReady());
        
        // Store the reference first
        gumsPostProcessRef.current = gumsPass;
        
        // Wait for the post-process to be ready before attaching
        if (gumsPass) {
            // Set up onApply first to ensure textures are properly bound
            gumsPass.onApply = (effect) => {
                // Set samplers (textures)
                effect.setTexture("gBufferPosition", gBuffer.textures[0]);
                effect.setTexture("gBufferNormal", gBuffer.textures[1]);
                effect.setTexture("gBufferData", gBuffer.textures[2]);
                effect.setTexture("diffuseMap", gumDiffuseTex);
                effect.setTexture("specularMap", gumSpecularTex);

                // Set uniforms
                effect.setVector3("cameraPosition", camera.position);
                effect.setVector3("ambientLightColor", new Vector3(0.2, 0.2, 0.25));
                effect.setVector3("diffuse", new Vector3(1.0, 1.0, 1.0));
                effect.setFloat("opacity", 1.0);
                effect.setFloat("glossiness", 0.3);
                effect.setFloat("shineFactor", 0.8);

                pointLights.forEach((light, i) => {
                    effect.setVector3(`pointLights[${i}].position`, light.position);
                    effect.setVector3(`pointLights[${i}].color`, light.color);
                });
            };
            
            // Force compile the shader to ensure it's ready
            gumsPass.updateEffect();
            
            // Now attach the post-process
            const gumsAttachResult = camera.attachPostProcess(gumsPass);
            console.log("Attached Gums PostProcess");
            console.log("Gums attachment result:", gumsAttachResult);
        } else {
            console.error("Gums PostProcess creation failed - gumsPass is null");
        }
        console.log("Camera post-processes count:", camera.postProcesses?.length || 0);
        console.log("Camera _postProcesses count:", camera._postProcesses?.length || 0);
        console.log("Camera object keys:", Object.keys(camera).filter(k => k.includes('post')));

        console.log("Gums pass configured.");

    } catch (e) {
        console.error("Failed to set up gums pass:", e);
    }

    // --- TEETH PASS SETUP ---
    try {
        const teethUniforms = ["cameraPosition", "diffuse", "opacity", "ambientLightColor", "ambientReflectionFactor", "selfIllumination", "glossiness", "reflectivity", "shineFactor", "pointLights"];
        const teethSamplers = ["gBufferPosition", "gBufferNormal", "gBufferData", "diffuseMap", "reflectMap"];

        const teethPass = new PostProcess("teethRender", "teethRenderComplex", teethUniforms, teethSamplers, 1.0, null, Constants.TEXTURE_BILINEAR_SAMPLINGMODE, engine);
        console.log("Teeth PostProcess created:", teethPass ? 'SUCCESS' : 'FAILED');
        console.log("Teeth PostProcess name:", teethPass?.name);
        console.log("Teeth PostProcess isReady:", teethPass?.isReady());
        
        // Store the reference first
        teethPostProcessRef.current = teethPass;
        
        // This is critical for chaining post-processes
        teethPass.alphaMode = Constants.ALPHA_COMBINE;
        
        // Wait for the post-process to be ready before attaching
        if (teethPass) {
            // Set up onApply first to ensure textures are properly bound
            teethPass.onApply = (effect) => {
                // Set samplers (textures)
                effect.setTexture("gBufferPosition", gBuffer.textures[0]);
                effect.setTexture("gBufferNormal", gBuffer.textures[1]);
                effect.setTexture("gBufferData", gBuffer.textures[2]);
                effect.setTexture("diffuseMap", teethDiffuseTex);
                effect.setTexture("reflectMap", teethReflectTex);

                // Set uniforms
                effect.setVector3("cameraPosition", camera.position);
                effect.setVector3("diffuse", new Vector3(1.0, 1.0, 1.0));
                effect.setFloat("opacity", 1.0);
                effect.setVector3("ambientLightColor", new Vector3(0.2, 0.2, 0.2));
                effect.setFloat("ambientReflectionFactor", 1.0);
                effect.setFloat("selfIllumination", 0.0);
                effect.setFloat("glossiness", 0.7);
                effect.setFloat("reflectivity", 0.5);
                effect.setFloat("shineFactor", 0.8);

                pointLights.forEach((light, i) => {
                    effect.setVector3(`pointLights[${i}].position`, light.position);
                    effect.setVector3(`pointLights[${i}].color`, light.color);
                });
            };
            
            // Force compile the shader to ensure it's ready
            teethPass.updateEffect();
            
            // Now attach the post-process
            const teethAttachResult = camera.attachPostProcess(teethPass);
            console.log("Attached Teeth PostProcess");
            console.log("Teeth attachment result:", teethAttachResult);
        } else {
            console.error("Teeth PostProcess creation failed - teethPass is null");
        }
        console.log("Camera post-processes count after teeth:", camera.postProcesses?.length || 0);
        console.log("Camera _postProcesses count after teeth:", camera._postProcesses?.length || 0);
        console.log("Teeth pass configured.");
    } catch(e) {
        console.error("Failed to set up teeth pass:", e);
    }

}, []);

    // Handle useAdvancedShaders state changes
    useEffect(() => {
        const scene = sceneRef.current;
        const camera = cameraRef.current;
        const engine = engineRef.current;
        
        if (!scene || !camera || !engine) return;
        
        console.log("=== ADVANCED SHADERS STATE CHANGE ===");
        console.log("useAdvancedShaders:", useAdvancedShaders);
        console.log("Model loaded:", !!modelsRef.current);
        
        if (useAdvancedShaders) {
            // Enable advanced shaders
            if (!gBufferRef.current) {
                console.log("Creating G-Buffer...");
                const gBuffer = setupGBuffer(scene, engine);
                if (gBuffer) {
                    // Store the G-Buffer reference properly
                    gBufferRef.current = gBuffer;
                    
                    // Only setup post-processes if a model is already loaded
                    if (modelsRef.current) {
                        console.log("Setting up advanced shaders with loaded model...");
                        setupAdvancedShaders(scene, camera, gBuffer, engine);
                        console.log("Advanced shaders setup complete.");
                        console.log("Final camera post-processes count:", camera.postProcesses?.length || 0);
                        console.log("Final camera _postProcesses count:", camera._postProcesses?.length || 0);
                        console.log("Final camera _postProcesses array:", camera._postProcesses);
                    } else {
                        console.log("G-Buffer created, waiting for model to load before setting up post-processes...");
                    }
                }
            } else {
                console.log("G-Buffer already exists, ensuring post-processes are attached...");
                // If model is loaded, ensure post-processes are properly set up
                if (modelsRef.current) {
                    console.log("Model is loaded, ensuring post-processes are properly set up...");
                    
                    // Force cleanup of any existing post-processes to avoid duplicates
                    if (gumsPostProcessRef.current) {
                        camera.detachPostProcess(gumsPostProcessRef.current);
                        gumsPostProcessRef.current.dispose();
                        gumsPostProcessRef.current = null;
                    }
                    if (teethPostProcessRef.current) {
                        camera.detachPostProcess(teethPostProcessRef.current);
                        teethPostProcessRef.current.dispose();
                        teethPostProcessRef.current = null;
                    }
                    
                    // Set up fresh post-processes
                    setupAdvancedShaders(scene, camera, gBufferRef.current, engine);
                    console.log("Post-processes recreated. Camera post-processes:", camera.postProcesses?.length || 0);
                    console.log("Gums PostProcess attached:", !!gumsPostProcessRef.current);
                    console.log("Teeth PostProcess attached:", !!teethPostProcessRef.current);
                } else {
                    console.log("G-Buffer exists but model not loaded yet, waiting for model load...");
                }
                console.log("Advanced shaders enabled. Camera post-processes:", camera.postProcesses?.length || 0);
            }
        } else {
            // Disable advanced shaders
            console.log("Disabling advanced shaders...");
            
            // Dispose post-processes to remove them from camera
            if (gumsPostProcessRef.current) {
                gumsPostProcessRef.current.dispose();
                gumsPostProcessRef.current = null;
            }
            if (teethPostProcessRef.current) {
                teethPostProcessRef.current.dispose();
                teethPostProcessRef.current = null;
            }
            console.log("Post-processes disposed. Camera post-processes:", camera.postProcesses?.length || 0);
            
            // Note: We keep the G-Buffer and post-process objects for potential re-use
            // They will be cleaned up when the component unmounts
        }
        
        console.log("=== ADVANCED SHADERS STATE CHANGE END ===");
    }, [useAdvancedShaders, setupGBuffer, setupAdvancedShaders]);

    // Main Initialization Effect
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const engine = new Engine(canvas, true, { antialias: true, stencil: true, preserveDrawingBuffer: false });
        engineRef.current = engine;
        const scene = new Scene(engine);
        sceneRef.current = scene;
        scene.clearColor = new Color4(1.0, 1.0, 1.0, 1.0); // A darker background for contrast

        const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 150, Vector3.Zero(), scene);
        cameraRef.current = camera;
        camera.layerMask = 0xFFFFFFFF; // Allow camera to see all layers
        camera.attachControl(canvas, true);
        camera.lowerRadiusLimit = 20;
        camera.upperRadiusLimit = 500;
        camera.wheelDeltaPercentage = 0.01;

        // Add basic lighting for standard materials
        const hemisphericLight = new HemisphericLight("hemisphericLight", new Vector3(0, 1, 0), scene);
        hemisphericLight.intensity = 0.7;
        hemisphericLight.diffuse = new Color3(1, 1, 1);
        hemisphericLight.specular = new Color3(1, 1, 1);

        const directionalLight = new DirectionalLight("directionalLight", new Vector3(-1, -1, -1), scene);
        directionalLight.intensity = 0.8;
        directionalLight.diffuse = new Color3(1, 1, 1);
        directionalLight.specular = new Color3(1, 1, 1);

        // Advanced shaders setup is now handled by the useAdvancedShaders useEffect

        const onModelLoaded = (loadedModels) => {
            console.log("=== MODEL LOADED CALLBACK DEBUG ===");
            console.log("Model loaded, processing...");
            console.log("Advanced shaders enabled:", useAdvancedShaders);
            console.log("Loaded models keys:", Object.keys(loadedModels));
            setIsLoading(false);
            setLoadError(null);

            // Clean up any old resources before loading new ones
            cleanupPreviousModel(); 
            modelsRef.current = loadedModels;

            if (loadedModels.allMeshes) {
                console.log(`Processing ${loadedModels.allMeshes.length} meshes with advanced shaders: ${useAdvancedShaders}`);
                console.log("Mesh details:");
                loadedModels.allMeshes.forEach((mesh, index) => {
                    console.log(`  Mesh ${index}: ${mesh.name}, GeometryType: ${mesh.metadata?.GeometryType}, Material: ${mesh.material?.name || 'NONE'}`);
                });
                loadedModels.allMeshes.forEach((mesh) => {
                    if (!mesh.geometry) return;
                    mesh.setEnabled(true);

                    if (useAdvancedShaders) {
                        // Critical fix: Meshes need to be on G-Buffer layer AND visible to main camera
                        mesh.layerMask = 0x30000000; // Both 0x10000000 (main) and 0x20000000 (G-Buffer)
                        
                        // Ensure mesh has the G-Buffer material from ModelLoader
                        if (!mesh.material || !mesh.material.name.includes('gBufferMaterial')) {
                            console.warn(`Mesh ${mesh.name} missing G-Buffer material, using default`);
                        } else {
                            console.log(`Mesh ${mesh.name} has G-Buffer material: ${mesh.material.name}`);
                        }
                    } else {
                        mesh.layerMask = 0x10000000;
                        const material = new StandardMaterial(`basicMat_${mesh.name}`, scene);
                        material.diffuseColor = new Color3(0.9, 0.9, 0.95);
                        material.specularColor = new Color3(0.3, 0.3, 0.3);
                        mesh.material = material;
                        console.log(`Set basic material for mesh: ${mesh.name}`);
                    }
                });
            }

            guiTextureRef.current = setupGUI({ camera, models: loadedModels, showModel, activeModelRef, onOpenExportDrawer: () => setIsDrawerOpen(true) });
            setIsModelLoaded(true);
            showModel("Full");
            
            console.log("=== MODEL PROCESSING COMPLETE ===");
            console.log("Total meshes in scene:", scene.meshes.length);
            console.log("Meshes on main layer (0x10000000):", scene.meshes.filter(m => m.layerMask & 0x10000000).length);
            console.log("Meshes on G-Buffer layer (0x20000000):", scene.meshes.filter(m => m.layerMask & 0x20000000).length);
            console.log("Meshes on both layers (0x30000000):", scene.meshes.filter(m => (m.layerMask & 0x30000000) === 0x30000000).length);
            console.log("Camera post-processes attached:", camera.postProcesses?.length || 0);
            
            // Debug post-process refs state
            console.log("Post-process refs state:");
            console.log("  useAdvancedShaders:", useAdvancedShaders);
            console.log("  gBufferRef.current:", !!gBufferRef.current);
            console.log("  gumsPostProcessRef.current:", !!gumsPostProcessRef.current);
            console.log("  teethPostProcessRef.current:", !!teethPostProcessRef.current);
            
            // CRITICAL FIX: Always set up advanced shaders after model is fully loaded
            if (useAdvancedShaders) {
                // First, ensure we have a valid G-Buffer
                if (!gBufferRef.current) {
                    console.log("Creating G-Buffer after model load...");
                    const gBuffer = setupGBuffer(scene, engine);
                    if (gBuffer) {
                        console.log("G-Buffer created successfully after model load");
                        // Store the reference explicitly
                        gBufferRef.current = gBuffer;
                    } else {
                        console.error("Failed to create G-Buffer after model load");
                    }
                }
                
                // Now set up post-processes with the confirmed G-Buffer
                if (gBufferRef.current) {
                    console.log("Model loaded with advanced shaders enabled - setting up post-processes now...");
                    // Force cleanup of any existing post-processes
                    if (gumsPostProcessRef.current) {
                        camera.detachPostProcess(gumsPostProcessRef.current);
                        gumsPostProcessRef.current.dispose();
                        gumsPostProcessRef.current = null;
                    }
                    if (teethPostProcessRef.current) {
                        camera.detachPostProcess(teethPostProcessRef.current);
                        teethPostProcessRef.current.dispose();
                        teethPostProcessRef.current = null;
                    }
                    
                    // Set up fresh post-processes
                    setupAdvancedShaders(scene, camera, gBufferRef.current, engine);
                    
                    // Verify post-processes are attached
                    console.log("Post-processes setup after model load. Camera post-processes:", camera.postProcesses?.length || 0);
                    console.log("Camera _postProcesses:", camera._postProcesses?.length || 0);
                    console.log("Gums PostProcess attached:", !!gumsPostProcessRef.current);
                    console.log("Teeth PostProcess attached:", !!teethPostProcessRef.current);
                } else {
                    console.error("Cannot set up post-processes - G-Buffer is not available");
                }
            } else {
                console.log("Advanced shaders disabled - skipping post-process setup");
            }
            
            console.log("=== MODEL LOADED CALLBACK DEBUG END ===");
        };

        const loaderCleanup = initializeCaseLoader(scene, 'ztcadLoaderInput', onModelLoaded, setIsLoading, setLoadError);

        engine.runRenderLoop(() => { 
            if (scene.isReady()) {
                if (useAdvancedShaders && gBufferRef.current) {
                    // First render to G-Buffer (without post-processing)
                    const originalPostProcesses = camera.postProcesses ? camera.postProcesses.slice() : [];
                    camera.postProcesses = [];
                    scene.render(false, gBufferRef.current);
                    
                    // Restore post-processing chain for main render
                    camera.postProcesses = originalPostProcesses;
                    
                    // Then render main scene with post-processing
                    scene.render();
                } else {
                    // Normal rendering without advanced shaders
                    scene.render();
                }
            }
        });
        const handleResize = () => engine.resize();
        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
            loaderCleanup();
            if (engineRef.current) {
                engineRef.current.dispose();
            }
        };
    }, [useAdvancedShaders, cleanupPreviousModel, setupGBuffer, setupAdvancedShaders, showModel]);

    // ... (return statement with JSX remains the same) ...
    return (
        <div style={{ position: 'relative', width: '100%', height: '100vh', backgroundColor: '#f0f0f0' }}>
            <ExportDrawer 
                isOpen={isDrawerOpen} 
                onClose={() => setIsDrawerOpen(false)} 
                onExportGLB={handleExportGLB} 
                onExportSTL={handleExportSTL} 
            />

            <input 
                type="file" 
                id="ztcadLoaderInput" 
                accept=".ztcad,.glb" 
                style={{ display: 'none' }} 
            />

            {isLoading && (
                <div style={{
                    position: 'absolute', zIndex: 100, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', 
                    background: 'rgba(0,0,0,0.8)', color: 'white', padding: '20px', borderRadius: '8px', textAlign: 'center'
                }}>
                    <div>Loading model...</div>
                    <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.7 }}>Please wait while the 3D model is processed</div>
                </div>
            )}

            {loadError && (
                <div style={{
                    position: 'absolute', zIndex: 100, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', 
                    background: 'rgba(220,20,60,0.95)', color: 'white', padding: '20px', borderRadius: '8px', textAlign: 'center',
                    maxWidth: '400px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>Error</div>
                    <div style={{ fontSize: '14px', marginBottom: '15px' }}>{loadError}</div>
                    <button onClick={() => setLoadError(null)} style={{ background: 'white', color: '#dc143c', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Dismiss</button>
                </div>
            )}

            {!isModelLoaded && !isLoading && !loadError && (
                <div style={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10, textAlign: 'center',
                    background: 'rgba(255,255,255,0.95)', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                    <div style={{ marginBottom: '20px', fontSize: '18px', color: '#333' }}>inbraket Playerviewer</div>
                    <button onClick={() => document.getElementById('ztcadLoaderInput')?.click()} style={{ 
                            background: 'linear-gradient(135deg, #007acc, #005a9e)', color: 'white', border: 'none', borderRadius: '12px', 
                            padding: '15px 25px', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '16px', fontWeight: 'bold',
                            boxShadow: '0 4px 12px rgba(0,122,204,0.3)', transition: 'all 0.2s ease', margin: '0 auto'
                        }} title="Load .ztcad or .glb file"
                        onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,122,204,0.4)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,122,204,0.3)'; }}>
                        <span style={{ marginRight: '10px' }}>🦷</span> Load 3D Model
                    </button>
                    <div style={{ marginTop: '15px', fontSize: '12px', color: '#666' }}>Supports .ztcad and .glb files</div>
                    <div style={{ marginTop: '10px' }}>
                        <label style={{ fontSize: '14px', color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <input type="checkbox" checked={useAdvancedShaders} onChange={(e) => {
                                const enabled = e.target.checked;
                                console.log("=== ENABLE ANGEL ALIGN DEBUG ===");
                                console.log("Advanced Shaders enabled:", enabled);
                                console.log("Current scene meshes:", sceneRef.current?.meshes?.length || 0);
                                console.log("Current model loaded:", isModelLoaded);
                                console.log("G-Buffer ref:", gBufferRef.current ? 'EXISTS' : 'NULL');
                                console.log("Gums post-process ref:", gumsPostProcessRef.current ? 'EXISTS' : 'NULL');
                                console.log("Teeth post-process ref:", teethPostProcessRef.current ? 'EXISTS' : 'NULL');
                                if (cameraRef.current) {
                                    console.log("Camera post-processes:", cameraRef.current.postProcesses?.length || 0);
                                }
                                setUseAdvancedShaders(enabled);
                                console.log("=== ENABLE ANGEL ALIGN DEBUG END ===");
                            }} style={{ marginRight: '8px' }} />
                            Enable Angel Align Advanced Shaders
                        </label>
                    </div>
                </div>
            )}

            {isModelLoaded && (
                <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10 }}>
                    <button onClick={() => document.getElementById('ztcadLoaderInput')?.click()} style={{ 
                            background: 'rgba(255,255,255,0.9)', border: '2px solid #007acc', borderRadius: '8px', padding: '10px', cursor: 'pointer', 
                            display: 'flex', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }} title="Load another model">
                        <span style={{ fontSize: '20px' }}>🦷</span>
                    </button>
                </div>
            )}

            <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: "100%", height: "100%", outline: 'none', display: 'block' }} />

            {process.env.NODE_ENV === 'development' && (
                <div style={{
                    position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.7)', color: 'white',
                    padding: '8px', borderRadius: '4px', fontSize: '10px', zIndex: 5
                }}>
                    Engine: {engineRef.current ? 'OK' : 'NOT_READY'} | Scene: {sceneRef.current ? 'OK' : 'NOT_READY'} | Model: {isModelLoaded ? 'LOADED' : 'NONE'} | Shaders: {useAdvancedShaders ? 'ADVANCED' : 'BASIC'}
                </div>
            )}
        </div>
    );
};

export default PlayerViewer;