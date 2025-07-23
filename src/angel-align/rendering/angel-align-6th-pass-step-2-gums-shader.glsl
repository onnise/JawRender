// Vertex Shader
#version 100
precision highp float;
precision highp int;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
attribute vec4 tangent;
varying vec4 ecPosition;
varying vec3 ecNormal;
varying vec3 binormal;
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
    vec3 transformed = vec3(position);
    vec3 objectNormal = vec3(normal);
    vec3 tan = normalMatrix * normalize(tangent.xyz);
    ecNormal = normalMatrix * normalize(objectNormal);
    binormal = cross(ecNormal, tan);
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
varying vec3 binormal;
varying vec2 vUv;
varying float clipDistance;
uniform sampler2D diffuseMap;
uniform sampler2D reflectMap;
uniform sampler2D specularMap;
uniform sampler2D normalMap;
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
uniform bool enableTexture;
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
    vec3 SpecularValue = texture2D(specularMap, vUv).rgb;
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
        vec3 normal = normalize(ecNormal);
        if (enableTexture) {
            float normalMapIntencity = 0.7;
            float normalMapSpecularIntencity = 0.6;
            vec3 crossNormal = cross(binormal, normal);
            vec3 bump = texture2D(normalMap, vUv).rgb;
            vec2 bumpM = (bump.xy * 2.0 - vec2(1.0));
            normal = normalize(binormal * bumpM.x * normalMapIntencity +                                                                                                                
            crossNormal* bumpM.y * normalMapIntencity +                                                                                                                             
            normal * bump.z);
        }
        vec3 outgoingLight = Lighting(diffuseColor, normal);
        gl_FragColor = vec4(outgoingLight, opacity);
    }

}
