// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  // Fase 2 de la auditoría frontend: cada color, fontSize y borderRadius
  // debe salir de theme/andi.ts, no ser un literal suelto. Esto detecta
  // nuevos literales que se agreguen después de la auditoría -- no
  // reemplaza el barrido que ya se hizo a mano, solo evita que vuelva a
  // acumularse. 'warn', no 'error': un literal nuevo no debe romper el
  // build, solo visibilizarse en el lint.
  {
    files: ["src/screens/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    // MascotAndi.tsx es una ilustración (ver Fase 2, punto 3 de la
    // auditoría): sus colores son parte del dibujo, no del design system.
    ignores: ["src/components/ciudadano/MascotAndi.tsx"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: "Literal[value=/^#([0-9A-Fa-f]{3}){1,2}$/]",
          message: "Color hex literal: usa un token de theme/andi.ts (andiColors/ANDI_COLORS) en vez de un hex suelto.",
        },
        {
          selector: "Property[key.name=/^(fontSize|borderRadius)$/] > Literal",
          message: "fontSize/borderRadius literal: usa el token más cercano de theme/andi.ts (andiType/ANDI_TYPE, andiRadius/ANDI_RADIUS) en vez de un número suelto.",
        },
      ],
    },
  },
]);
