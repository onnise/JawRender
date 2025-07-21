import {
  SceneLoader,
  TransformNode,
  ShaderMaterial,
  Color3,
  Effect,
  Texture,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import JSZip from 'jszip';

const createJawShaderMaterial = (scene, alpha = 1.0) => {
  const vertexShader = document.getElementById("jawShader-vertex")?.textContent;
  const fragmentShader = document.getElementById("jawShader-fragment")?.textContent;
  
  if (!vertexShader || !fragmentShader) {
    console.error("Could not find shader <script> tags in the HTML.");
    return null;
  }

  if (!Effect.ShadersStore["jawShaderVertexShader"]) {
    Effect.ShadersStore["jawShaderVertexShader"] = vertexShader;
    Effect.ShadersStore["jawShaderFragmentShader"] = fragmentShader;
  }

  const shaderMat = new ShaderMaterial("jawShader_" + Math.random(), scene, {
    vertex: "jawShader", fragment: "jawShader",
  }, {
    attributes: ["position", "normal", "uv"],
    uniforms: ["worldViewProjection", "world", "color", "alpha"],
    samplers: ["diffuseTexture"],
    needAlphaBlending: true
  });

  shaderMat.setColor3("color", new Color3(1.0, 1.0, 1.0));
  shaderMat.setFloat("alpha", alpha);
  shaderMat.backFaceCulling = false;

  const noMipmaps = true;
  const defaultWhiteTexture = new Texture(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/wcAAwAB/epv2AAAAABJRU5ErkJggg==",
    scene, noMipmaps, false, Texture.NEAREST_SAMPLINGMODE
  );
  shaderMat.setTexture("diffuseTexture", defaultWhiteTexture);
  
  return shaderMat;
};

// --- CORRECTED LOGIC IS HERE ---
const processAndOrganizeMeshes = (meshes, scene) => {
  const allMeshes = meshes.filter(mesh => mesh.geometry);
  const rootNodeFromGltf = meshes[0]?.parent || meshes[0];
  const modelRoot = new TransformNode("ModelRoot", scene);
  
  // 1. Define all possible groups your models might have.
  const groups = {
    Full: new TransformNode("FullModelGroup", scene),
    Upper: new TransformNode("UpperJawGroup", scene),
    Lower: new TransformNode("LowerJawGroup", scene),
    IdealTeeth: new TransformNode("IdealTeethGroup", scene),
    OriginalTeeth: new TransformNode("OriginalTeethGroup", scene),
    Brackets: new TransformNode("BracketsGroup", scene),
  };

  // 2. Create ONE unique material for each group that needs a slider.
  const materials = {
    Upper: createJawShaderMaterial(scene),
    Lower: createJawShaderMaterial(scene),
    IdealTeeth: createJawShaderMaterial(scene),
    OriginalTeeth: createJawShaderMaterial(scene),
    Brackets: createJawShaderMaterial(scene),
    Default: createJawShaderMaterial(scene), // Fallback material
  };
  
  // 3. Parent all groups to the master root.
  Object.values(groups).forEach(group => group.parent = modelRoot);

  // Process and sort each mesh.
  allMeshes.forEach(mesh => {
    mesh.setEnabled(true);
    mesh.isVisible = true;

    const name = mesh.name.toLowerCase();
    
    // 4. Assign the mesh to a group AND give it that group's specific material.
    if (name.includes('ideal')) {
      mesh.parent = groups.IdealTeeth;
      mesh.material = materials.IdealTeeth;
    } else if (name.includes('original')) {
      mesh.parent = groups.OriginalTeeth;
      mesh.material = materials.OriginalTeeth;
    } else if (name.includes('bracket')) {
      mesh.parent = groups.Brackets;
      mesh.material = materials.Brackets;
    } else if (name.includes('ideal') || name.includes('target')) {
      mesh.parent = groups.IdealTeeth;
      mesh.material = materials.IdealTeeth;
    } else if (name.includes('original') || name.includes('initial')) {
      mesh.parent = groups.OriginalTeeth;
      mesh.material = materials.OriginalTeeth;
    } else if (name.includes('bracket') || name.includes('brace') || name.includes('wire')) {
      mesh.parent = groups.Brackets;
      mesh.material = materials.Brackets;
    } 
  
    // We now check for ALL possible upper jaw names in one condition.
    else if (name.includes('upper') || name.includes('maxilla') || name.includes('gumu') || name.includes('teethu') || name.includes('max')) {
      mesh.parent = groups.Upper;
      mesh.material = materials.Upper;
    } 
    // We do the same for all lower jaw names.
    else if (name.includes('lower') || name.includes('mandible') || name.includes('guml') || name.includes('teethl') || name.includes('mand')) {
      mesh.parent = groups.Lower;
      mesh.material = materials.Lower;
    } else {
      // Unsorted meshes go to the Full group and get the Default material
      mesh.parent = groups.Full;
      mesh.material = materials.Default;
    }
  });

  return { ...groups, MasterRoot: modelRoot };
};


// The rest of the file remains the same...
const loadGlbFromData = async (glbData, scene, onModelLoadedCallback) => {
  let objectURL = null;
  try {
    objectURL = URL.createObjectURL(glbData);
    const result = await SceneLoader.ImportMeshAsync(null, "", objectURL, scene, null, ".glb");
    URL.revokeObjectURL(objectURL);

    const organizedModels = processAndOrganizeMeshes(result.meshes, scene);
    if (onModelLoadedCallback) onModelLoadedCallback(organizedModels);
  } catch (error) {
    console.error("Failed to load GLB data:", error);
    alert(`Error loading GLB data. The file may be corrupt.\nDetails: ${error.message}`);
  }
};

const loadPublishedCase = async (file, scene, onModelLoadedCallback) => {
  try {
    const zip = await JSZip.loadAsync(file);
    const glbEntry = zip.file(/\.glb$/i)[0];
    if (!glbEntry) throw new Error("No .glb file found inside the .ztcad archive.");
    const glbBlob = await glbEntry.async('blob');
    await loadGlbFromData(glbBlob, scene, onModelLoadedCallback);
  } catch (error) {
    console.error("Failed to load published case:", error);
    alert(`Error loading .ztcad file.\nDetails: ${error.message}`);
  }
};

const loadModel = async (file, scene, onModelLoadedCallback) => {
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  if (fileExtension === 'ztcad') {
    await loadPublishedCase(file, scene, onModelLoadedCallback);
  } else if (fileExtension === 'glb') {
    await loadGlbFromData(file, scene, onModelLoadedCallback);
  } else {
    alert('Unsupported file type. Please select a .ztcad or .glb file.');
  }
};

export const initializeCaseLoader = (scene, inputId, onModelLoadedCallback) => {
  const fileInput = document.getElementById(inputId);
  if (!fileInput) return;
  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    loadModel(file, scene, onModelLoadedCallback);
    event.target.value = '';
  };
  fileInput.addEventListener('change', handleFileChange);
  return () => fileInput.removeEventListener('change', handleFileChange);
};