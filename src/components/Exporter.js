// Exporter.js (Updated for specific mesh exporting)
import { GLTF2Export } from "@babylonjs/serializers/glTF";
import { STLExport } from "@babylonjs/serializers/stl";

// Helper function for triggering STL download
function CreateDownload(data, fileName) {
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

class Exporter {
    /**
     * @param {Scene} scene The Babylon.js scene.
     * @param {string} fileName The name of the file to download.
     * @param {Node[]} [targetNodes] Optional array of nodes (meshes or transform nodes) to export. If null, exports visible scene.
     */
    static exportGLB(scene, fileName, targetNodes = null) {
        console.log("Starting GLB export...");
        
        const options = {
            // If targetNodes are provided, export them. Otherwise, use the previous filtering logic.
            shouldExportNode: (node) => {
                if (targetNodes) {
                    // Check if the node is one of the targets or a descendant of a target.
                    return targetNodes.some(target => node === target || node.isDescendantOf(target));
                }
                // Default behavior: export everything except lights and skybox.
                return node.name !== 'skyBox' && node.name !== 'hdrSkyBox' && node.getClassName() !== 'Light';
            }
        };

        GLTF2Export.GLBAsync(scene, fileName, options).then((glb) => {
            glb.downloadFiles();
            console.log("GLB export process initiated.");
        }).catch((error) => {
            console.error("Error during GLB export:", error);
        });
    }

    /**
     * @param {Scene} scene The Babylon.js scene.
     * @param {string} fileName The name of the file to download.
     * @param {TransformNode} [targetGroup] Optional TransformNode to export. If null, exports all visible meshes.
     */
    static exportSTL(scene, fileName, targetGroup = null) {
        console.log("Starting STL export...");
        let meshesToExport;

        if (targetGroup) {
            // If a specific group (like upperJawGroup) is provided, get all its child meshes.
            // The `true` argument ensures it gets descendants at all levels.
            meshesToExport = targetGroup.getChildMeshes(true);
        } else {
            // Default behavior: get all meshes in the scene, excluding the skybox.
            meshesToExport = scene.meshes.filter(mesh =>
                mesh.name !== 'skyBox' &&
                mesh.name !== 'hdrSkyBox'
            );
        }

        if (meshesToExport.length === 0) {
            console.error("No valid meshes found to export for STL.");
            return;
        }

        try {
            // STLExport.CreateSTL correctly handles an array of meshes. [1]
            const stlData = STLExport.CreateSTL(meshesToExport, true); 
            CreateDownload(stlData, fileName);
            console.log("STL export process initiated.");
        } catch (error) {
            console.error("Error during STL export:", error);
        }
    }
}

export default Exporter;