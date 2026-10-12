export const fragmentShader =`// reference from https://youtu.be/vM8M4QloVL0?si=CKD5ELVrRm3GjDnN
varying vec3 vNormal;
varying vec3 eyeVector;
uniform float atmOpacity;
uniform float atmPowFactor;
uniform float atmMultiplier;
uniform vec3 atmTint;

void main() {
    // Starting from the atmosphere edge, dotP would increase from 0 to 1
    // clamp: pow() of a negative base is NaN, which bloom would smear across the frame
    float dotP = max(dot( vNormal, eyeVector ), 0.0);
    // This factor is to create the effect of a realistic thickening of the atmosphere coloring
    float factor = pow(dotP, atmPowFactor) * atmMultiplier;
    // Adding in a bit of dotP to the color to make it whiter while thickening
    vec3 atmColor = atmTint + vec3(dotP / 4.5);
    // use atmOpacity to control the overall intensity of the atmospheric color
    gl_FragColor = vec4(atmColor, atmOpacity) * factor;

    // (optional) colorSpace conversion for output
    gl_FragColor = linearToOutputTexel( gl_FragColor );
}`

// credit: https://franky-arkon-digital.medium.com/make-your-own-earth-in-three-js-8b875e281b1e