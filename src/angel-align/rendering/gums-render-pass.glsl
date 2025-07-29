// FRAGMENT SHADER ONLY (Post-Process)
#version 300 es
precision highp float;

// Built-in from Babylon.js post-process runner
in vec2 vUV;

// The single output to the screen
out vec4 fragColor;

//----- UNIFORMS & SAMPLERS -----//
// G-Buffer Inputs from Pass 1
uniform sampler2D gBufferPosition;
uniform sampler2D gBufferNormal;
uniform sampler2D gBufferData;

// Gums Texture Inputs
uniform sampler2D diffuseMap;
uniform sampler2D reflectMap;
uniform sampler2D specularMap;
uniform sampler2D normalMap;

// Lighting & Material Inputs
#define LIGHTS_COUNT 3
struct PointLight {
    vec3 position;
    vec3 color;
};
uniform PointLight pointLights[LIGHTS_COUNT];
uniform vec3 diffuse;
uniform float opacity;
uniform vec3 ambientLightColor;
uniform float selfIllumination;
uniform float glossiness;
uniform float reflectivity;
uniform float shineFactor;
uniform bool enableTexture; // Converted to float for compatibility

//----- FUNCTIONS (Converted from original shader) -----//
// This is the full lighting function from your shader, adapted for GLSL 300
vec3 Lighting(vec3 diffuseColor, vec3 normal, vec3 ecPosition) {
    float RoughnessFactor = 2.1 * pow(100.0, glossiness);
    float RoughnessRoot = 13.0 - 10.0 * glossiness;
    float AmbientReflection = reflectivity * reflectivity * sqrt(glossiness); // Simplified ambient
    float AmbientReflectionRoot = sqrt(1.0 - AmbientReflection);
    float HighLightFactor = reflectivity * sqrt(glossiness) * shineFactor;
    
    vec3 DiffuseLight = ambientLightColor;
    vec3 HighLight = vec3(0.0);
    
    for (int i = 0; i < LIGHTS_COUNT; i++) {
        PointLight pointLight = pointLights[i];
        DiffuseLight += max(dot(normal, normalize(pointLight.position)), 0.0) * pointLight.color;
        
        vec3 reflectedLight = reflect(pointLight.position - ecPosition, normal);
        vec3 viewDir = normalize(ecPosition); // In eye-space, view is from origin
        float highLightValue = max(dot(normalize(reflectedLight), viewDir), 0.001);

        float tempV = 1.0 / max(pow(highLightValue, RoughnessFactor), 0.001);
        HighLight += pointLight.color * pow(RoughnessRoot, 1.0 - tempV) * tempV;
    }

    vec3 SpecularValue = texture(specularMap, vUV).rgb;
    vec3 ReflectNormal = normalize(reflect(ecPosition, normal));
    if (ReflectNormal.z < 0.0) {
      ReflectNormal.xy *= 2.0 / length(ReflectNormal.xy) - 1.0;
    }

    vec3 ReflectionColor = texture(reflectMap, vec2(0.5, 0.5) - ReflectNormal.xy * 0.25).rgb;
    vec3 fColor = mix(diffuseColor * DiffuseLight, diffuseColor, selfIllumination);
    fColor *= mix(vec3(1.0), vec3(AmbientReflectionRoot) + ReflectionColor * AmbientReflection, SpecularValue);
    vec3 ResultingColor = fColor + (HighLight * HighLightFactor * SpecularValue);
    
    return ResultingColor;
}

//----- MAIN FUNCTION -----//
void main() {
    // Read the GeometryType ID from our G-Buffer (stored in the R channel of gBufferData)
    float geoID = texture(gBufferData, vUV).r;

    // Discard any pixel that is not a gum (ID is approx 1.0)
    if (abs(geoID - 1.0) > 0.1) {
        discard;
    }

    // This is a gum pixel, proceed with rendering.
    vec3 ecPosition = texture(gBufferPosition, vUV).xyz;
    vec3 ecNormal = texture(gBufferNormal, vUV).xyz;
    
    vec3 texelColor = texture(diffuseMap, vUV).rgb;
    vec3 diffuseColor = diffuse * texelColor;
    vec3 finalNormal = normalize(ecNormal);

    // Normal mapping is a bit complex in screen space, we can add it later.
    // The key is to correctly transform the normal map's tangents. For now, we skip it.

    vec3 outgoingLight = Lighting(diffuseColor, finalNormal, ecPosition);
    fragColor = vec4(outgoingLight, opacity);
    //fragColor = vec4(0.0, 1.0, 0.0, 1.0); 
}