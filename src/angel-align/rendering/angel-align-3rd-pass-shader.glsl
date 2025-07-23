// Vertex shader
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
uniform sampler2D SSAOInput;
uniform vec4 Viewport;
uniform int PixelRange;
void main() {
    vec2 coord = gl_FragCoord.xy / Viewport.zw;
    vec2 texelSize = 1.0 / vec2(textureSize(SSAOInput, 0));
    float result = 0.0;
    for (int x = -PixelRange; x < PixelRange; ++x) {
        for (int y = -PixelRange; y < PixelRange; ++y) {
            vec2 offfset = vec2(float(x), float(y)) * texelSize;
            result += texture(SSAOInput, coord + offfset).r;
        }

    }
    FragColor = vec4(result / (2.0*float(PixelRange) * 2.0*float(PixelRange)));
}
