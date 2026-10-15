// Adapted from Animate UI's Button primitive:
// https://animate-ui.com/r/primitives-buttons-button.json
// Styling belongs to the host site; this button does not need the optional asChild slot.
// License: ../../LICENSE
import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react';

type ButtonProps = HTMLMotionProps<'button'> & {
  hoverScale?: number;
  tapScale?: number;
};

function Button({ hoverScale = 1.05, tapScale = 0.95, ...props }: ButtonProps) {
  const reducedMotion = useReducedMotion();

  return <motion.button
    whileTap={reducedMotion ? undefined : { scale: tapScale }}
    whileHover={reducedMotion ? undefined : { scale: hoverScale }}
    {...props}
  />;
}

export { Button, type ButtonProps };
