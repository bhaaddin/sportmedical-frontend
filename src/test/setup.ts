/* Adds the DOM matchers (toBeInTheDocument, toHaveTextContent, ...) to
   vitest's expect. Without this they exist but throw at the call site. */
import '@testing-library/jest-dom/vitest';
