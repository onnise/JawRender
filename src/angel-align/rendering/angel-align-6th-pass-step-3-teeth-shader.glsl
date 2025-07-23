// Vertex Shader
#version 100
precision highp float;
precision highp int;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
varying vec4 ecPosition;
varying vec3 ecNormal;
varying vec2 vUv;
varying float clipDistance;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
uniform mat4 invertViewMatrix;
uniform bool enableClipPlane;
uniform vec4 clipPlane;
void main() {
    vUv = uv;
    vec3 objectNormal = normalize(normal);
    ecNormal = normalMatrix * objectNormal;
    ecPosition = modelViewMatrix * vec4(position, 1.0);
    clipDistance = 1.0;
    if (enableClipPlane) {
        vec4 modelCoordVertex = invertViewMatrix * ecPosition;
        clipDistance = dot(clipPlane, modelCoordVertex);
    }
    gl_Position = projectionMatrix * ecPosition;
}

// Fragment Shader
#version 100
precision highp float;
precision highp int;
varying vec4 ecPosition;
varying vec3 ecNormal;
varying vec2 vUv;
varying float clipDistance;
uniform sampler2D diffuseMap;
uniform sampler2D reflectMap;
uniform sampler2D SSAOTexture;
#define LIGHTS_COUNT 3																																					  
struct PointLight {
    vec3 position;
    vec3 color;
};
uniform PointLight pointLights[LIGHTS_COUNT];
uniform vec3 diffuse;
uniform float opacity;
uniform vec3 ambientLightColor;
uniform float ambientReflectionFactor;
uniform float selfIllumination;
uniform float glossiness;
uniform float reflectivity;
uniform float shineFactor;
uniform vec4 viewport;
uniform vec3 occlusionColor;
uniform float minOcclusion;
uniform vec4 mergeColor;
vec2 translateFromCCUVs(vec2 uv) {
    return vec2(uv.x, (1.0 - uv.y*0.9) + 0.05);
}
bool isnan(float val) {
    return (val < 0.0 || 0.0 < val || val == 0.0) ? false : true;
}
vec3 Lighting(vec3 diffuseColor, vec3 normal) {
    float RoughnessFactor = 2.1 * pow(100.0, glossiness);
    float RoughnessRoot = 13.0 - 10.0 * glossiness;
    float AmbientReflection = reflectivity * reflectivity * sqrt(glossiness) * ambientReflectionFactor;
    float AmbientReflectionRoot = sqrt(1.0 - AmbientReflection);
    float HighLightFactor = reflectivity * sqrt(glossiness) * shineFactor;
    vec3 DiffuseLight = ambientLightColor;
    vec3 HighLight = vec3(0.0);
    for (int i = 0; i < LIGHTS_COUNT; i++) {
        PointLight pointLight = pointLights[i];
        DiffuseLight += max(dot(normal, normalize(pointLight.position)), 0.0) * pointLight.color;
        float highLightValue = max(dot(normalize(reflect(pointLight.position - ecPosition.xyz, normal)), normalize(ecPosition.xyz)), 0.001);
        float tempV = 1.0 / max(pow(highLightValue, RoughnessFactor), 0.001);
        HighLight += pointLight.color * pow(RoughnessRoot, 1.0 - tempV) * tempV;
    }
    vec3 SpecularValue = vec3(1.0);
    vec3 ReflectNormal = normalize(reflect(ecPosition.xyz, normal));
    if (ReflectNormal.z < 0.0)																																					
    ReflectNormal.xy *= 2.0 / length(ReflectNormal.xy) - 1.0;
    vec3 ReflectionColor = texture2D(reflectMap, vec2(0.5, 0.5) - ReflectNormal.xy * 0.25).rgb;
    vec3 fColor = mix(diffuseColor.rgb * DiffuseLight, diffuseColor.rgb, selfIllumination);
    fColor *= mix(vec3(1.0), vec3(AmbientReflectionRoot) + ReflectionColor * AmbientReflection, SpecularValue);
    vec3 ResultingColor = fColor + (HighLight * HighLightFactor * SpecularValue);
    return ResultingColor;
}
void main() {
    if (clipDistance < 0.0)																																						
    discard;
    if (gl_FrontFacing) {
        vec3 texelColor = texture2D(diffuseMap, vUv).xyz;
        vec3 diffuseColor = diffuse*texelColor;
        float fAlpha = mergeColor.w;
        diffuseColor = diffuseColor*(1.0 - fAlpha) + mergeColor.xyz*fAlpha;
        vec3 normal = normalize(ecNormal);
        vec3 outgoingLight = Lighting(diffuseColor, normal);
        vec2 coord = (gl_FragCoord.xy - viewport.xy) / viewport.zw;
        float ambientOcclusion = texture2D(SSAOTexture, coord).r;
        if (occlusionColor.x >= 0.0) {
            if (ambientOcclusion < minOcclusion)																																	
            ambientOcclusion = minOcclusion;
            outgoingLight = outgoingLight * ambientOcclusion + (1.0 - ambientOcclusion)*occlusionColor;
        }
        gl_FragColor = vec4(outgoingLight, opacity);
    }

}
