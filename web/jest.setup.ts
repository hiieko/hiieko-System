import '@testing-library/jest-dom';

/**
 * jsdom does not implement `matchMedia`, which the responsive helpers of the
 * web app rely on. The default result is "not a mobile viewport" so the
 * desktop layout is the one under test.
 */
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
