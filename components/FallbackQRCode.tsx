import React from 'react';
import Svg, { Rect, Image, Defs, ClipPath, G } from 'react-native-svg';

interface FallbackQRCodeProps {
    width: number;
    height: number;
}

const IMAGE_0_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAQAElEQVR4AeydvY9c5RXGfUcxyh/AktSpYgclHQjZzL1jIQElEnaZSCQSBVJSQufdCupEAilRUtAgYwqooNq5d9wh6MCiQYIKwVo0UNB4Js8rr9Gy3vWcd/a98379Vu/xfvjMOef5nbvPjPdjPDnHCwQgUC0BDKDa1SMcAufOYQBcBRComAAGUPHykV43AaceA3AUCAhUSgADqHTxyIaAI4ABOAoEBColgAFUunhk103gvnoM4D4JXkOgQgIYQIVLRzIE7hPAAO6T4DUEKiSAAVS4dCTXTeCoegzgKA3ehkBlBDCAyhaOXAgcJYABHKXB2xCojAAGUNnCkVs3gePqMYDjRHgfAhURwAAqWjZSIXCcAAZwnAjvQ6AiAhhARctGat0ETlKPAZxEhY9BoBICGEAli0YmBE4igAGcRIWPQaASAhhAJYtGZt0ETlOPAZxGho9DoAICGEAFS0YiBE4jgAGcRoaPQ6ACAhhABUtGYt0EHqYeA3gYHf4OAoUTwAAKXzDyIPAwAhjAw+jwdxAonAAGUPiCkVc3gXXqkzSA+Xz+nOKNvu+Hvu9Xmcegl9f39/efXbeMUH8vXjcUJm6heouso92z/5BAH1IrKQO4devW73ThLpqm+VDxquaeKnI/09Vq9dpkMvlI2fadxi0ISmqvVr2OjRixfyuwAHnJXCi6l3zp7t27X0rT04pSz8xplNY/jyxwOXL94OXFhP0Hp7q+YBIGoId8v9e95Fvrxy0jQ1r/owv+wohqktirVR/7t5Lyy7NkR79QtPxf6eH+DQ37iKKW84hM4B2nvRbBp+l0DNj/aXTG/3h0A9Dyn5fMPypqO3+S4B2nvRbBZ/39GPD/Gg==";

const IMAGE_1_BASE64 = "data:image/png;base64,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";

export const FallbackQRCode: React.FC<FallbackQRCodeProps> = ({ width, height }) => {
    // SVG viewBox is 0 0 136 136
    // Image 0 Calculations: 
    // Base SVG width 136. 
    // Target Image 0 effective width approx 169.
    // Target Image 0 effective x approx -16.5.
    // These values make it cover the 136x136 area centered.

    // Image 1 Calculations:
    // Clip Rect: x=40, y=40, w=56, h=56.
    // Target Image 1 effective width approx 90.8.
    // Target Image 1 effective x approx 18.7.
    // Target Image 1 effective y approx 24.3.

    return (
        <Svg width={width} height={height} viewBox="0 0 136 136" fill="none">
            <Defs>
                <ClipPath id="clip1">
                    <Rect x="40" y="40" width="56" height="56" />
                </ClipPath>
            </Defs>

            {/* Background Image - Covers the area */}
            <Image
                x="-16.53"
                y="-16.53"
                width="169.06"
                height="169.06"
                preserveAspectRatio="none"
                href={IMAGE_0_BASE64}
            />

            {/* Foreground Image - Clipped to center box */}
            <G clipPath="url(#clip1)">
                <Image
                    x="18.71"
                    y="24.28"
                    width="90.8"
                    height="90.8"
                    preserveAspectRatio="none"
                    href={IMAGE_1_BASE64}
                />
            </G>
        </Svg>
    );
};
