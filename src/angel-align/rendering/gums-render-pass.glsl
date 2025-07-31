// --- gums-render-pass.glsl ---

// FRAGMENT SHADER ONLY (Post-Process)
#version 300 es
precision highp float;

// Built-in from Babylon.js post-process runner
in vec2 vUV;
out vec4 fragColor;

// G-Buffer Inputs (containing WORLD-space data)
uniform sampler2D gBufferPosition;
uniform sampler2D gBufferNormal;
uniform sampler2D gBufferData;

// Gums Texture Inputs
uniform sampler2D diffuseMap;
uniform sampler2D specularMap;

// Material & Lighting Uniforms
#define LIGHTS_COUNT 3
struct PointLight {
    vec3 position;
    vec3 color;
};
uniform PointLight pointLights[LIGHTS_COUNT];

uniform vec3 diffuse; // Base material color
uniform float opacity;
uniform vec3 ambientLightColor;
uniform float glossiness; // Controls the shininess
uniform float shineFactor;  // Controls the intensity of the shine

// This uniform is provided automatically by Babylon.js for post-processes
// It contains the camera's position in WORLD space.
uniform vec3 cameraPosition; 


// --- MAIN FUNCTION --- //
void main() {
    // Read the GeometryType ID from our G-Buffer (stored in the R channel)
    float geoID = texture(gBufferData, vUV).r;

    // Discard any pixel that is not a gum (ID is approx 1.0)
    // This allows the scene's clearColor to show through.
    if (abs(geoID - 1.0) > 0.1) {
        discard;
    }

    // --- This is a gum pixel, proceed with WORLD SPACE lighting ---

    // 1. Read fragment data from the G-Buffer
    vec3 worldPosition = texture(gBufferPosition, vUV).xyz;
    vec3 worldNormal = normalize(texture(gBufferNormal, vUV).xyz);
    
    // 2. Define material properties
    vec3 materialDiffuseColor = texture(diffuseMap, vUV).rgb * diffuse;
    vec3 materialSpecularColor = texture(specularMap, vUV).rgb;

    // 3. Initialize lighting with ambient light
    vec3 finalColor = materialDiffuseColor * ambientLightColor;

    // 4. Calculate vectors needed for lighting (all in WORLD SPACE)
    vec3 viewDir = normalize(cameraPosition - worldPosition);

    // 5. Loop through lights and add their contribution
    for (int i = 0; i < LIGHTS_COUNT; i++) {
        // Light direction vector
        vec3 lightDir = normalize(pointLights[i].position - worldPosition);

        // Diffuse component (Lambertian)
        float NdotL = max(dot(worldNormal, lightDir), 0.0);
        vec3 diffuseComponent = materialDiffuseColor * pointLights[i].color * NdotL;

        // Specular component (Blinn-Phong)
        vec3 halfDir = normalize(lightDir + viewDir);
        float NdotH = max(dot(worldNormal, halfDir), 0.0);
        
        // Use glossiness to control the power of the specular highlight
        float specularPower = exp2(glossiness * 10.0 + 1.0); // Map 0-1 glossiness to a useful pow range
        float specularFactor = pow(NdotH, specularPower);
        
        // Use shineFactor to control the brightness of the highlight
        vec3 specularComponent = materialSpecularColor * pointLights[i].color * specularFactor * shineFactor * 5.0; // Boosted for effect

        // Add to final color
        finalColor += diffuseComponent + specularComponent;
    }

    // 6. Set the final fragment color
    fragColor = vec4(finalColor, opacity);
}