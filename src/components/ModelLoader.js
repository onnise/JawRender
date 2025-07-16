import {
  SceneLoader,
  TransformNode,
  ShaderMaterial,
  Color3,
  Effect,
  Texture,
  Vector3
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import JSZip from 'jszip';


// Note: JSZip library must be included in your index.html via a <script> tag for this to work.

/**
 * Creates the custom shader material by reading GLSL code directly from script tags in the HTML.
 * This is more robust than relying on element names.
 */
const createJawShaderMaterial = (scene, alpha = 1.0) => {
  // Read shader code from the DOM
  const vertexShader = document.getElementById("jawShader-vertex")?.textContent;
  const fragmentShader = document.getElementById("jawShader-fragment")?.textContent;

  if (!vertexShader || !fragmentShader) {
    console.error("Could not find shader <script> tags in the HTML. Check the element IDs.");
    return null;
  }

  // Store shaders in Babylon's shader store, allowing them to be referenced by name.
  Effect.ShadersStore["jawShaderVertexShader"] = vertexShader;
  Effect.ShadersStore["jawShaderFragmentShader"] = fragmentShader;

  const shaderMat = new ShaderMaterial("jawShader", scene, {
    vertex: "jawShader", // Reference the shader by the name given to the store
    fragment: "jawShader",
  }, {
    attributes: ["position", "normal", "uv"],
    uniforms: ["worldViewProjection", "world", "color", "alpha"], // 'world' is needed for correct lighting
    samplers: ["diffuseTexture"], // Must declare samplers used by the shader
    needAlphaBlending: true
  });

  shaderMat.setColor3("color", new Color3(1.0, 1.0, 1.0));
  shaderMat.setFloat("alpha", alpha);
  shaderMat.backFaceCulling = false;

  return shaderMat;
};

/**
 * Standardized processor that takes any array of loaded meshes, applies materials,
 * and organizes them into a consistent hierarchy (Full, Upper, Lower).
 */
const processAndOrganizeMeshes = (meshes, scene) => {
  const allMeshes = meshes.filter(mesh => mesh.geometry);
  const rootNode = meshes[0]?.parent || meshes[0];

  const upperJawGroup = new TransformNode("UpperJawGroup", scene);
  const lowerJawGroup = new TransformNode("LowerJawGroup", scene);
  const fullGroup = new TransformNode("FullModelGroup", scene);

  const masterShaderMaterial = createJawShaderMaterial(scene);
  if (!masterShaderMaterial) {
    console.error("Aborting mesh processing: Shader material could not be created.");
    return {};
  }
  
  // A cache to create unique material instances for meshes with different textures
  const materialCache = new Map();

  allMeshes.forEach(mesh => {
    const name = mesh.name.toLowerCase();
    const originalMaterial = mesh.material;
    let newMaterial = masterShaderMaterial;

    if (originalMaterial && originalMaterial.diffuseTexture) {
      const textureUrl = originalMaterial.diffuseTexture.url;
      if (materialCache.has(textureUrl)) {
        newMaterial = materialCache.get(textureUrl);
      } else {
        newMaterial = masterShaderMaterial.clone(`${masterShaderMaterial.name}_${textureUrl}`);
        newMaterial.setTexture("diffuseTexture", originalMaterial.diffuseTexture);
        materialCache.set(textureUrl, newMaterial);
      }
    }
    
    mesh.material = newMaterial;
    mesh.setEnabled(true);
    mesh.isVisible = true;

    if (name.includes('upper') || name.includes('gumu') || name.includes('teethu')) {
      mesh.parent = upperJawGroup;
    } else if (name.includes('lower') || name.includes('guml') || name.includes('teethl')) {
      mesh.parent = lowerJawGroup;
    } else {
      if(mesh.parent !== rootNode){
         mesh.parent = fullGroup;
      }
    }
  });

  // Parent the groups correctly to the model's root transform
  if (rootNode) {
    fullGroup.parent = rootNode;
  }
  
  upperJawGroup.parent = fullGroup;
  lowerJawGroup.parent = fullGroup;

  // Return the organized structure for the GUI to interact with
  return { Upper: upperJawGroup, Lower: lowerJawGroup, Full: fullGroup };
};

/**
 * Handles the user's file selection, unzips the .ztcad, corrects the axis, 
 * loads the model, and then calls the processing function.
 */
const loadPublishedCase = async (event, scene, onModelLoadedCallback) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const zip = await JSZip.loadAsync(file);
    let glbFile = null;
    let tcadFile = null;

    zip.forEach((_, zipEntry) => {
      const entryName = zipEntry.name.toLowerCase();
      if (entryName.endsWith('.glb')) glbFile = zipEntry;
      if (entryName.endsWith('.tcad')) tcadFile = zipEntry;
    });

    if (!glbFile) throw new Error("Published case is invalid: No .glb file found.");
    
    // Read metadata to check for Z-up coordinate system
    let upAxis = 'Y';
    if (tcadFile) {
      const tcadContent = await tcadFile.async('string');
      if (tcadContent.toUpperCase().includes('Z')) {
        upAxis = 'Z';
      }
    }

    const glbData = await glbFile.async('uint8array');
    const blob = new Blob([glbData], { type: "model/gltf-binary" });
    const objectURL = URL.createObjectURL(blob);
    
    // Load the GLB data from the in-memory blob
    const result = await SceneLoader.ImportMeshAsync(null, '', objectURL, scene, null, '.glb');
    URL.revokeObjectURL(objectURL);

    const rootNode = result.meshes[0];
    if (rootNode && upAxis === 'Z') {
      // Apply rotation to convert Z-up to Babylon's Y-up system
      rootNode.rotation.x = -Math.PI / 2;
    }
    
    // Process the newly loaded meshes to apply materials and organize them
    const organizedModels = processAndOrganizeMeshes(result.meshes, scene);
    
    // **Crucially, call the callback to notify the React component that we are done**
    if (onModelLoadedCallback) {
        onModelLoadedCallback(organizedModels);
    }
    
  } catch (error) {
    console.error("Failed to load published case:", error);
    alert(`Error loading case: ${error.message}`);
  }
};

/**
 * Main exported function. Initializes the file loader UI by attaching event listeners
 * and accepts a callback function to bridge communication back to the React component.
 */
export const initializeCaseLoader = (scene, buttonId, inputId, onModelLoadedCallback) => {
  const loadButton = document.getElementById(buttonId);
  const fileInput = document.getElementById(inputId);

  if (!loadButton || !fileInput) {
    console.error("Loader initialization failed: Could not find UI elements. Check IDs.");
    return;
  }

  const handleClick = () => fileInput.click();
  const handleFileChange = (event) => loadPublishedCase(event, scene, onModelLoadedCallback);

  loadButton.addEventListener('click', handleClick);
  fileInput.addEventListener('change', handleFileChange);

  // Return a cleanup function to be called when the component unmounts
  return () => {
    loadButton.removeEventListener('click', handleClick);
    fileInput.removeEventListener('change', handleFileChange);
  };
};