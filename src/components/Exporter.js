// src/Exporter.js

import { GLTF2Export } from '@babylonjs/serializers/glTF';
import { STLExport } from '@babylonjs/serializers/stl';

/**
 * Exports the specified nodes (meshes) as a GLB file.
 * @param {Scene} scene - The Babylon.js scene object.
 * @param {Mesh[]} nodes - An array of meshes to export.
 * @param {string} fileName - The desired name for the downloaded file.
 */
export const exportToGLB = async (scene, nodes, fileName) => {
  try {
    const glbData = await GLTF2Export.GLBAsync(scene, fileName, {
        shouldExportNode: (node) => nodes.includes(node)
    });
    
    glbData.downloadFiles();
    console.log(`${fileName} has been exported successfully.`);

  } catch (error) {
    console.error("Error exporting to GLB:", error);
    alert(`GLB Export Failed:\n${error.message}`);
  }
};

/**
 * Exports the specified meshes as an STL file.
 * @param {Scene} scene - The Babylon.js scene object (unused by this function but kept for consistency).
 * @param {Mesh[]} meshes - An array of meshes to export.
 * @param {string} fileName - The desired name for the downloaded file.
 */
export const exportToSTL = (scene, meshes, fileName) => {
  try {
    // --- THIS IS THE FINAL, ROBUST FIX FOR STL ---
    
    // The STLExport.CreateSTL function is known to have some quirks with transformations.
    // A more reliable method is to use a direct call that specifies all parameters clearly.
    // The key is the final parameter `doNotBakeTransform`, which MUST be false.

    const options = {
      // We are passing an array of all meshes from the PlayerViewer.
      // This tells the exporter to bake their world transformation into the vertices.
      doNotBakeTransform: false,
      // We want to export all meshes provided, not just visible ones.
      exportOnlyVisible: false,
    };
    
    STLExport.CreateSTL(meshes, true, fileName, true, options.exportOnlyVisible, options.doNotBakeTransform);
    
    console.log(`${fileName}.stl has been exported successfully.`);
  } catch (error) {
    console.error("Error exporting to STL:", error);
    alert(`STL Export Failed:\n${error.message}`);
  }
};