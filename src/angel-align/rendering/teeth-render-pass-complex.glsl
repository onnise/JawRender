#version 300 es
precision highp float;
precision highp int;

// Input from the post-process's simple vertex shader. It gives us the
// texture coordinate for the current pixel on the screen.
in vec2 vUV;

// The single output from this shader: the final color of the pixel.
out vec4 fragColor;


//----- UNIFORMS & SAMPLERS -----//

// G-Buffer Inputs: Data textures from the first rendering pass.
uniform sampler2D gBufferPosition; // Contains world-space position of the fragment
uniform sampler2D gBufferNormal;   // Contains world-space normal of the fragment
uniform sampler2D gBufferData;     // Contains miscellaneous data, like our GeometryType ID

// Texture Inputs for Material Properties
uniform sampler2D diffuseMap;  // The main color texture for the teeth
uniform sampler2D reflectMap;  // The spherical environment map for reflections


//----- LIGHTING & SCENE UNIFORMS -----//

// Point Lights (passed from the JavaScript side)
#define LIGHTS_COUNT 3
struct PointLight {
    vec3 position;
    vec3 color;
};
uniform PointLight pointLights[LIGHTS_COUNT];

// Material & Scene Properties (passed from the JavaScript side)
uniform vec3 diffuse;                  // A base color multiplier, usually vec3(1,1,1)
uniform float opacity;                 // The final transparency
uniform vec3 ambientLightColor;        // The scene's base ambient light color
uniform float ambientReflectionFactor; // How much the ambient light is affected by reflections
uniform float selfIllumination;        // How much the object glows on its own (0.0 for none)
uniform float glossiness;              // Controls the "spread" of highlights (0.0 = rough, 1.0 = smooth)
uniform float reflectivity;            // Controls the intensity of environment reflections
uniform float shineFactor;             // An overall multiplier for the specular highlight intensity
uniform vec3 cameraPosition;           // The camera's position in world space


//----- CONSTANTS -----//
const float TEETH_GEOMETRY_TYPE = 2.0;


//----- LIGHTING FUNCTION (Ported & adapted for our pipeline) -----//
vec3 Lighting(vec3 diffuseColor, vec3 worldNormal, vec3 worldPosition, vec3 viewDir) {
    // These factors are ported directly from your original shader's logic
    float RoughnessFactor = 2.1 * pow(100.0, glossiness);
    float RoughnessRoot = 13.0 - 10.0 * glossiness;
    float AmbientReflection = reflectivity * reflectivity * sqrt(glossiness) * ambientReflectionFactor;
    float AmbientReflectionRoot = sqrt(1.0 - AmbientReflection);
    float HighLightFactor = reflectivity * sqrt(glossiness) * shineFactor;
    
    vec3 DiffuseLight = ambientLightColor;
    vec3 HighLight = vec3(0.0);

    // Loop through all lights to accumulate their effects
    for (int i = 0; i < LIGHTS_COUNT; i++) {
        vec3 lightDir = normalize(pointLights[i].position - worldPosition);

        // Standard diffuse lighting (Lambertian)
        DiffuseLight += max(dot(worldNormal, lightDir), 0.0) * pointLights[i].color;

        // Specular highlight calculation (Blinn-Phong style)
        vec3 halfDir = normalize(lightDir + viewDir);
        float highLightValue = max(dot(worldNormal, halfDir), 0.001);

        // This unique highlight falloff is preserved from your original shader
        float tempV = 1.0 / max(pow(highLightValue, RoughnessFactor), 0.001);
        HighLight += pointLights[i].color * pow(RoughnessRoot, 1.0 - tempV) * tempV;
    }
    
    vec3 SpecularValue = vec3(1.0); // This can be replaced with a specular map lookup if needed

    // Calculate the reflection vector needed to sample the spherical reflection map
    vec3 reflectDir = reflect(-viewDir, worldNormal);

    // This sphere-mapping UV transformation logic is preserved from the original.
    // It remaps the reflection vector to correctly sample your spherical `reflectMap`.
    if (reflectDir.z < 0.0) {
        reflectDir.xy *= 2.0 / length(reflectDir.xy) - 1.0;
    }
    vec3 ReflectionColor = texture(reflectMap, vec2(0.5, 0.5) - reflectDir.xy * 0.25).rgb;
    
    // Combine diffuse color with diffuse lighting, and mix in self-illumination
    vec3 fColor = mix(diffuseColor * DiffuseLight, diffuseColor, selfIllumination);
    // Apply the environmental reflection on top
    fColor *= mix(vec3(1.0), vec3(AmbientReflectionRoot) + ReflectionColor * AmbientReflection, SpecularValue);
    
    // Add the final specular highlights
    vec3 ResultingColor = fColor + (HighLight * HighLightFactor * SpecularValue);
    
    return ResultingColor;
}


//----- MAIN EXECUTION -----//
void main() {
    // 1. IDENTIFY THE PIXEL
    // Read the GeometryType ID from our G-Buffer (it's in the red channel of gBufferData)
    float geoID = texture(gBufferData, vUV).r;

    // 2. DISCARD IF NOT A TOOTH
    // If this pixel does not belong to a tooth, stop processing immediately.
    // This is the core of deferred rendering and lets other passes handle it.
    if (abs(geoID - TEETH_GEOMETRY_TYPE) > 0.1) {
        discard;
    }
    
    // 3. GATHER DATA FOR THIS PIXEL
    // Since this is a tooth pixel, we proceed. Read its world-space data from the G-Buffer.
    vec3 worldPosition = texture(gBufferPosition, vUV).xyz;
    vec3 worldNormal = normalize(texture(gBufferNormal, vUV).xyz);
    vec3 viewDir = normalize(cameraPosition - worldPosition);

    // Get the base color from the teeth texture and multiply by the uniform color
    vec3 texelColor = texture(diffuseMap, vUV).rgb;
    vec3 diffuseColor = diffuse * texelColor;
    
    // 4. CALCULATE FINAL COLOR
    // Pass all the gathered data into our lighting function
    vec3 outgoingLight = Lighting(diffuseColor, worldNormal, worldPosition, viewDir);
    
    // 5. OUTPUT
    // Write the final calculated color and opacity to the screen.
    fragColor = vec4(outgoingLight, opacity);
}