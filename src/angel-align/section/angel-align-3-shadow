// Vertex
#version 100                                                                                  
attribute vec3 position;
void main() {
    gl_Position = vec4(position, 1.0);
}


// Fragment
#version 100                                                                                                          
precision highp float;
uniform sampler2D depthTexture;
uniform vec2 resolution;
uniform float smoothRadius;
void main (void) {
    float sigma = 0.60 * smoothRadius;
    float smoothSigma = -1.0 / (2.0 * pow(sigma, 2.0));
    vec4 textureColor = texture2D(depthTexture, gl_FragCoord.xy/ resolution);
    float color = 0.0;
    float smoothMultiply = 0.0;
    int R = int(smoothRadius);
    for(int y = -8; y<8; y++) {
        for(int x = -8; x<8; x++) {
            float fY = float(y);
            float fX = float(x);
            float radius2 = fY*fY + fX*fX;
            smoothMultiply += exp(radius2*smoothSigma);
            color += texture2D(depthTexture, (gl_FragCoord.xy - vec2(fX, fY)) / resolution).r * exp(radius2 * smoothSigma);
        }

    }
    smoothMultiply = 1.0 / smoothMultiply;
    float shadow = color * smoothMultiply;
    gl_FragColor = vec4(shadow, 0.0, 0.0, 1.0);
}
