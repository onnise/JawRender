// Vertex Shader
#version 300 es
layout(location = 0) in vec3 VertexPosition;
layout(location = 1) in vec2 VertexTexCoords;
out vec2 TexCoords;
void main() {
    TexCoords = VertexTexCoords;
    gl_Position = vec4(VertexPosition, 1.0);
}


// Fragment shader
#version 300 es
precision highp float;
out vec4 FragColor;
in vec2 TexCoords;
uniform sampler2D gPosition;
uniform sampler2D gNormal;
uniform sampler2D texNoise;
uniform vec3 Samples[64];
uniform mat4 ProjectionMatrix;
uniform vec4 Viewport;
int kernelSize = 16;
uniform float Radius;
uniform float Bias;
uniform float StepRange;
void main() {
    vec2 noiseScale = vec2(Viewport.z / 4.0, Viewport.w / 4.0);
    vec2 coord = gl_FragCoord.xy / Viewport.zw;
    vec4 position = texture(gPosition, coord);
    vec3 fragPos = position.xyz;
    vec3 normal = normalize(texture(gNormal, coord).rgb);
    vec3 randomVec = normalize(texture(texNoise, coord*noiseScale).xyz);
    vec3 tangent = normalize(randomVec - normal * dot(randomVec, normal));
    vec3 bitangent = cross(normal, tangent);
    mat3 TBN = mat3(tangent, bitangent, normal);
    float occlusion = 0.0;
    for (int i = 0; i < kernelSize; ++i) {
        vec3 samplePos = TBN * Samples[i];
        samplePos = fragPos + samplePos*Radius;
        vec4 offset = vec4(samplePos, 1.0);
        offset = ProjectionMatrix*offset;
        offset.xyz /= offset.w;
        offset.x = (offset.x * 0.5 + 0.5)*Viewport[2] + Viewport[0];
        offset.y = (offset.y * 0.5 + 0.5)*Viewport[3] + Viewport[1];
        offset.z = offset.z * 0.5 + 0.5;                                                         
        //offset.xyz = offset.xyz * 0.5 + 0.5;
        
        vec4 samplePosition = texture(gPosition, offset.xy / Viewport.zw);
        float sampleDepth = samplePosition.z;
        float rangeCheck = smoothstep(0.0, 1.0, Radius / abs(fragPos.z - sampleDepth));
        bool isDifferent = position.w*samplePosition.w > 0.0 ? false : true;
        float step = isDifferent ? StepRange : 1.0;
        occlusion += (sampleDepth >= samplePos.z + Bias ? step : 0.0) * rangeCheck;
    }
    occlusion = 1.0 - (occlusion / float(kernelSize));
    if (occlusion < 0.0)                                                                         
    occlusion = 0.0;
    FragColor = vec4(occlusion);
}
