import { useEffect, useState } from 'react';
import { Animated, PanResponder } from 'react-native';

/**
 * Deslizar hacia abajo para cerrar una bottom sheet -- las hojas de este
 * proyecto (TriageSheet, el formulario de InfraestructuraScreen) ya tenían
 * la barrita visual de "agarre" pero nada reaccionaba al arrastre, solo la
 * X que se agregó después servía para cerrar. PanResponder (no
 * react-native-gesture-handler: esa librería está instalada pero nunca se
 * configuró GestureHandlerRootView en la app, y mezclarla con el <Modal>
 * nativo de RN tiene problemas conocidos de propagación) + Animated, mismo
 * API que ya usa Toast.tsx.
 *
 * `visible` reinicia la posición cada vez que la hoja se vuelve a abrir --
 * el <Modal> de RN no desmonta el contenido al ocultarse, así que sin esto
 * la segunda apertura heredaría el desplazamiento de cuando se cerró.
 */
export function useSwipeDismiss(onClose: () => void, visible: boolean, dismissThreshold = 100) {
  const translateY = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    if (visible) translateY.setValue(0);
  }, [visible, translateY]);

  const panResponder = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) translateY.setValue(gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > dismissThreshold || gesture.vy > 1.2) {
          Animated.timing(translateY, { toValue: 800, duration: 200, useNativeDriver: true }).start(() => {
            translateY.setValue(0);
            onClose();
          });
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      },
    })
  )[0];

  return { translateY, handlePanHandlers: panResponder.panHandlers };
}
